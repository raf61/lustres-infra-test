import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";

type ParsedInbound = {
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  profileName: string | null;
  id: string;
  from: string | null;
  timestampSec: number | null;
  type: string | null;
  text: string | null;
  inReplyToExternalId: string | null;
  raw: any;
};

type ParsedStatus = {
  phoneNumberId: string | null;
  displayPhoneNumber: string | null;
  id: string;
  status: string | null;
  timestampSec: number | null;
  recipientId: string | null;
  errors: any[] | null;
  pricing: any | null;
  raw: any;
};

type ParsedWebhookLog = {
  meta: {
    generatedAt: string;
    sourceFile: string;
    since: string | null;
    until: string | null;
    blocksFound: number;
  };
  inbound: ParsedInbound[];
  statuses: ParsedStatus[];
  stats: {
    inboundCount: number;
    statusCount: number;
    uniqueInboundIds: number;
    uniqueStatusIds: number;
    phoneNumberIds: Record<string, number>;
  };
};

function getArg(name: string) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
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

function inWindowSeconds(tsSec: number | null, since: Date | null, until: Date | null) {
  if (tsSec === null) return true;
  const dt = new Date(tsSec * 1000);
  if (since && dt < since) return false;
  if (until && dt > until) return false;
  return true;
}

/**
 * Extrai blocos "[ ... ] entry" do log.
 */
function extractEntryBlocks(logText: string): string[] {
  const lines = logText.split(/\r?\n/);
  const blocks: string[] = [];

  let collecting = false;
  let buf: string[] = [];

  for (const line of lines) {
    if (!collecting) {
      // O arquivo também tem linhas como "[webhook-listener] ...".
      // No nosso log, o JSON de entry começa numa linha que é literalmente "[".
      if (line.trim() === "[") {
        collecting = true;
        buf = [line];
      }
      continue;
    }

    buf.push(line);

    if (/\]\s*entry\s*$/.test(line.trim()) || /]\s*entry\s*$/.test(line)) {
      const last = buf[buf.length - 1];
      buf[buf.length - 1] = last.replace(/\s*entry\s*$/, "");
      blocks.push(buf.join("\n"));
      collecting = false;
      buf = [];
    }
  }

  return blocks;
}

function safeJsonParse(block: string): any[] | null {
  try {
    const parsed = JSON.parse(block);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function toNumberOrNull(v: any): number | null {
  if (v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

async function main() {
  const file = getArg("--file");
  const dockerService = getArg("--docker-service") ?? getArg("--docker");
  const out = getArg("--out") ?? "webhook-parsed.json";
  if (!file) {
    if (!dockerService) {
      throw new Error(
        "Usage: tsx --env-file=.env scripts/parse-webhook-log.ts --file /path/to/webhook.log --out webhook-parsed.json [--since ISO] [--until ISO]\n" +
          "   or: tsx --env-file=.env scripts/parse-webhook-log.ts --docker-service webhook --out webhook-parsed.json [--since ISO] [--until ISO]"
      );
    }
  }

  const { since, until } = parseWindow();
  const logText = file
    ? readFileSync(file, "utf8")
    : execSync(`docker compose logs --no-color ${dockerService}`, { encoding: "utf8" });
  const blocks = extractEntryBlocks(logText);

  const inbound: ParsedInbound[] = [];
  const statuses: ParsedStatus[] = [];

  for (const block of blocks) {
    const entry = safeJsonParse(block);
    if (!entry) continue;

    for (const e of entry) {
      const changes = Array.isArray(e?.changes) ? e.changes : [];
      for (const change of changes) {
        const value = change?.value || {};
        const metadata = value?.metadata || {};
        const phoneNumberId = metadata?.phone_number_id ?? null;
        const displayPhoneNumber = metadata?.display_phone_number ?? null;
        const contact = value?.contacts?.[0];
        const profileName = contact?.profile?.name ?? null;

        // inbound messages
        if (Array.isArray(value?.messages) && value.messages.length > 0) {
          for (const m of value.messages) {
            if (m?.type === "reaction") continue;
            const id = m?.id;
            if (!id) continue;

            const tsSec = toNumberOrNull(m?.timestamp);
            if (!inWindowSeconds(tsSec, since, until)) continue;

            const type = m?.type ?? null;
            const text = type === "text" ? m?.text?.body ?? null : null;
            const caption = type && type !== "text" ? m?.[type]?.caption ?? null : null;
            const inReplyToExternalId = m?.context?.id ?? null;

            inbound.push({
              phoneNumberId,
              displayPhoneNumber,
              profileName,
              id,
              from: m?.from ?? null,
              timestampSec: tsSec,
              type,
              text: (text ?? caption) ?? null,
              inReplyToExternalId,
              raw: { metadata, contact, message: m },
            });
          }
        }

        // statuses
        if (Array.isArray(value?.statuses) && value.statuses.length > 0) {
          for (const st of value.statuses) {
            const id = st?.id;
            if (!id) continue;
            const tsSec = toNumberOrNull(st?.timestamp);
            if (!inWindowSeconds(tsSec, since, until)) continue;

            statuses.push({
              phoneNumberId,
              displayPhoneNumber,
              id,
              status: st?.status ?? null,
              timestampSec: tsSec,
              recipientId: st?.recipient_id ?? null,
              errors: Array.isArray(st?.errors) ? st.errors : null,
              pricing: st?.pricing ?? null,
              raw: { metadata, status: st },
            });
          }
        }
      }
    }
  }

  const uniqueInboundIds = new Set(inbound.map((m) => m.id));
  const uniqueStatusIds = new Set(statuses.map((s) => s.id));
  const phoneNumberIds: Record<string, number> = {};
  for (const m of inbound) {
    if (m.phoneNumberId) phoneNumberIds[m.phoneNumberId] = (phoneNumberIds[m.phoneNumberId] || 0) + 1;
  }
  for (const s of statuses) {
    if (s.phoneNumberId) phoneNumberIds[s.phoneNumberId] = (phoneNumberIds[s.phoneNumberId] || 0) + 1;
  }

  const parsed: ParsedWebhookLog = {
    meta: {
      generatedAt: new Date().toISOString(),
      sourceFile: file ?? `docker:${dockerService}`,
      since: since ? since.toISOString() : null,
      until: until ? until.toISOString() : null,
      blocksFound: blocks.length,
    },
    inbound,
    statuses,
    stats: {
      inboundCount: inbound.length,
      statusCount: statuses.length,
      uniqueInboundIds: uniqueInboundIds.size,
      uniqueStatusIds: uniqueStatusIds.size,
      phoneNumberIds,
    },
  };

  writeFileSync(out, JSON.stringify(parsed, null, 2), "utf8");

  console.log(
    `[parse] blocks=${blocks.length} inbound=${inbound.length} (unique ${uniqueInboundIds.size}) statuses=${statuses.length} (unique ${uniqueStatusIds.size}) out=${out}`
  );
  console.log(`[parse] phone_number_id distribution:`, phoneNumberIds);
}

main().catch((err) => {
  console.error("[parse] fatal:", err);
  process.exit(1);
});

