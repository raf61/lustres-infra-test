import "dotenv/config";
import { readFileSync } from "node:fs";

import { HandleInboundUseCase } from "../chat/application/handle-inbound.usecase";
import { HandleStatusUseCase, type InboundStatus } from "../chat/application/handle-status.usecase";
import { PrismaInboxRepository } from "../chat/infra/repositories/prisma-inbox-repository";
import { PrismaContactRepository } from "../chat/infra/repositories/prisma-contact-repository";
import { PrismaContactInboxRepository } from "../chat/infra/repositories/prisma-contact-inbox-repository";
import { PrismaConversationRepository } from "../chat/infra/repositories/prisma-conversation-repository";
import { PrismaMessageRepository } from "../chat/infra/repositories/prisma-message-repository";
import { getBullMQBroadcaster } from "../chat/infra/events/bullmq-broadcaster";
import type { InboundMessage } from "../chat/domain/message";

type MetaEntry = {
  id?: string;
  changes?: Array<{
    field?: string;
    value?: any;
  }>;
};

function getArg(name: string) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

function parseWindow() {
  const sinceRaw = getArg("--since");
  const untilRaw = getArg("--until");
  const since = sinceRaw ? new Date(sinceRaw) : null;
  const until = untilRaw ? new Date(untilRaw) : null;
  if (sinceRaw && Number.isNaN(since!.getTime())) throw new Error("Invalid --since");
  if (untilRaw && Number.isNaN(until!.getTime())) throw new Error("Invalid --until");
  return { since, until };
}

function inWindow(date: Date, since: Date | null, until: Date | null) {
  if (since && date < since) return false;
  if (until && date > until) return false;
  return true;
}

/**
 * O webhook imprime: console.log(JSON.stringify(entry, null, 2), 'entry')
 * Então no log fica um bloco JSON multi-linha seguido de " entry".
 */
function extractEntryBlocks(logText: string): string[] {
  const lines = logText.split(/\r?\n/);
  const blocks: string[] = [];

  let collecting = false;
  let buf: string[] = [];

  for (const line of lines) {
    if (!collecting) {
      // O arquivo também tem linhas como "[webhook-listener] ..." e "[dotenv@...]".
      // No seu log, o JSON de entry começa numa linha que é literalmente "[".
      if (line.trim() === "[") {
        collecting = true;
        buf = [line];
      }
      continue;
    }

    buf.push(line);

    // fim: linha que contém "] entry" (pode ser "] entry" ou "] entry" com espaços)
    if (/\]\s*entry\s*$/.test(line.trim()) || /]\s*entry\s*$/.test(line)) {
      // remover o sufixo ' entry' da última linha
      const last = buf[buf.length - 1];
      buf[buf.length - 1] = last.replace(/\s*entry\s*$/, "");
      blocks.push(buf.join("\n"));
      collecting = false;
      buf = [];
    }
  }

  return blocks;
}

function normalizeInboundMessages(entryValue: any): InboundMessage[] {
  const metadata = entryValue?.metadata || {};
  const contact = entryValue?.contacts?.[0];
  const profileName = contact?.profile?.name;

  const messages = Array.isArray(entryValue?.messages) ? entryValue.messages : [];
  const filtered = messages.filter((m: any) => m.type !== "reaction");

  return filtered.map((m: any) => {
    const base: InboundMessage = {
      id: m.id,
      from: m.from,
      timestamp: m.timestamp,
      type: m.type,
      phoneNumberId: metadata?.phone_number_id,
      displayPhoneNumber: metadata?.display_phone_number,
      inReplyTo: m.context?.id,
      profileName,
    };

    if (m.type === "text") {
      base.text = m.text?.body;
    } else {
      // fallback simples: tenta extrair caption/texto
      base.caption = m[m.type]?.caption;
      base.text = m.text?.body;
      base.mediaId = m[m.type]?.id;
      base.mediaMimeType = m[m.type]?.mime_type;
      base.mediaFilename = m[m.type]?.filename;
    }

    return base;
  });
}

function extractStatuses(entryValue: any): InboundStatus[] {
  const statuses = Array.isArray(entryValue?.statuses) ? entryValue.statuses : [];
  return statuses.map((st: any) => ({
    id: st.id,
    status: st.status,
    timestamp: st.timestamp,
    recipientId: st.recipient_id,
    conversationId: st.conversation?.id,
    errors: st.errors,
  }));
}

async function main() {
  const file = getArg("--file");
  if (!file) {
    throw new Error(
      "Usage: tsx --env-file=.env scripts/replay-webhook-log.ts --file /path/to/webhook.log [--only inbound|statuses|all] [--dry-run] [--since ISO] [--until ISO]"
    );
  }

  const only = (getArg("--only") ?? "all") as "all" | "inbound" | "statuses";
  const dryRun = hasFlag("--dry-run");
  const { since, until } = parseWindow();

  const logText = readFileSync(file, "utf8");
  const blocks = extractEntryBlocks(logText);
  console.log(`[replay] blocks_found=${blocks.length} only=${only} dryRun=${dryRun}`);

  // deps iguais ao webhook server
  const inboxRepo = new PrismaInboxRepository();
  const contactRepo = new PrismaContactRepository();
  const contactInboxRepo = new PrismaContactInboxRepository();
  const convRepo = new PrismaConversationRepository();
  const messageRepo = new PrismaMessageRepository();
  const broadcaster = getBullMQBroadcaster();

  const handleInbound = new HandleInboundUseCase(
    inboxRepo,
    contactRepo,
    contactInboxRepo,
    convRepo,
    messageRepo,
    broadcaster
  );
  const handleStatus = new HandleStatusUseCase(messageRepo, broadcaster);

  let inboundTotal = 0;
  let statusTotal = 0;
  let inboundExecuted = 0;
  let statusExecuted = 0;

  for (const block of blocks) {
    let entry: MetaEntry[];
    try {
      entry = JSON.parse(block);
    } catch (e: any) {
      console.warn("[replay] failed_to_parse_block:", e?.message || String(e));
      continue;
    }

    for (const e of entry) {
      const changes = e.changes || [];
      for (const change of changes) {
        const value = change.value || {};

        // inbound messages
        if ((only === "all" || only === "inbound") && Array.isArray(value.messages) && value.messages.length > 0) {
          const msgs = normalizeInboundMessages(value);

          // aplica filtro de janela baseado no timestamp do WhatsApp (segundos)
          const windowed = msgs.filter((m) => {
            const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000) : null;
            if (!ts) return true;
            return inWindow(ts, since, until);
          });

          inboundTotal += windowed.length;
          if (windowed.length === 0) continue;

          if (dryRun) {
            console.log(`[replay] inbound would_process=${windowed.length}`);
          } else {
            const r = await handleInbound.execute(windowed);
            inboundExecuted += windowed.length;
            console.log("[replay] inbound_result", r);
          }
        }

        // statuses
        if ((only === "all" || only === "statuses") && Array.isArray(value.statuses) && value.statuses.length > 0) {
          const sts = extractStatuses(value);
          const windowed = sts.filter((s) => {
            const ts = s.timestamp ? new Date(Number(s.timestamp) * 1000) : null;
            if (!ts) return true;
            return inWindow(ts, since, until);
          });
          statusTotal += windowed.length;
          if (windowed.length === 0) continue;

          if (dryRun) {
            console.log(`[replay] statuses would_process=${windowed.length}`);
          } else {
            await handleStatus.execute(windowed);
            statusExecuted += windowed.length;
          }
        }
      }
    }
  }

  console.log(
    `[replay] inbound_total=${inboundTotal} statuses_total=${statusTotal} inbound_executed=${inboundExecuted} statuses_executed=${statusExecuted}`
  );
}

main().catch((err) => {
  console.error("[replay] fatal:", err);
  process.exit(1);
});

