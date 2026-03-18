import "dotenv/config";
import crypto from "node:crypto";
import { readFileSync } from "node:fs";

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

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Extrai blocos "[ ... ] entry" do log do webhook.
 * No seu arquivo, o JSON começa numa linha que é literalmente "[" e termina numa linha "] entry".
 */
function extractEntryBlocks(logText: string): string[] {
  const lines = logText.split(/\r?\n/);
  const blocks: string[] = [];

  let collecting = false;
  let buf: string[] = [];

  for (const line of lines) {
    if (!collecting) {
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

function safeParseArray(block: string): MetaEntry[] | null {
  try {
    const parsed = JSON.parse(block);
    return Array.isArray(parsed) ? (parsed as MetaEntry[]) : null;
  } catch {
    return null;
  }
}

function blockHasInboundMessages(entry: MetaEntry[]) {
  for (const e of entry) {
    for (const ch of e.changes || []) {
      const v = ch.value || {};
      if (Array.isArray(v.messages) && v.messages.length > 0) return true;
    }
  }
  return false;
}

function blockHasStatuses(entry: MetaEntry[]) {
  for (const e of entry) {
    for (const ch of e.changes || []) {
      const v = ch.value || {};
      if (Array.isArray(v.statuses) && v.statuses.length > 0) return true;
    }
  }
  return false;
}

function computeSignature(appSecret: string, rawBody: Buffer) {
  const hmac = crypto.createHmac("sha256", appSecret);
  const digest = hmac.update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

async function main() {
  const file = getArg("--file");
  const url = getArg("--url") ?? "http://localhost:4000/";
  const mode = (getArg("--only") ?? "all") as "all" | "inbound" | "statuses";
  const delayMs = Number(getArg("--delay-ms") ?? "50");
  const max = getArg("--max") ? Number(getArg("--max")) : null;
  const dryRun = hasFlag("--dry-run");
  const noSign = hasFlag("--no-signature");

  if (!file) {
    throw new Error(
      "Usage: tsx --env-file=.env scripts/replay-webhook-http.ts --file /path/to/webhook.txt --url http://localhost:4000/ [--only inbound|statuses|all] [--delay-ms 50] [--max N] [--dry-run]"
    );
  }

  const appSecret = process.env.WA_APP_SECRET ?? "";
  if (!noSign && !appSecret) {
    throw new Error("Missing WA_APP_SECRET in env (required to sign X-Hub-Signature-256). Use --no-signature only in dev.");
  }

  const logText = readFileSync(file, "utf8");
  const blocks = extractEntryBlocks(logText);
  console.log(`[replay-http] blocks_found=${blocks.length} url=${url} only=${mode} dryRun=${dryRun} delayMs=${delayMs}`);

  let considered = 0;
  let sent = 0;
  let skipped = 0;
  let parseFailed = 0;
  let ok = 0;
  let notOk = 0;

  for (const block of blocks) {
    if (max !== null && sent >= max) break;

    const entryArr = safeParseArray(block);
    if (!entryArr) {
      parseFailed += 1;
      continue;
    }

    const hasInbound = blockHasInboundMessages(entryArr);
    const hasSt = blockHasStatuses(entryArr);

    if (mode === "inbound" && !hasInbound) {
      skipped += 1;
      continue;
    }
    if (mode === "statuses" && !hasSt) {
      skipped += 1;
      continue;
    }
    if (mode === "all" && !hasInbound && !hasSt) {
      skipped += 1;
      continue;
    }

    considered += 1;

    // Payload mínimo aceito pelo server.ts (ele lê req.body.entry)
    const bodyObj = { entry: entryArr };
    const bodyStr = JSON.stringify(bodyObj);
    const raw = Buffer.from(bodyStr, "utf8");

    if (dryRun) {
      sent += 1;
      continue;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (!noSign) {
      headers["X-Hub-Signature-256"] = computeSignature(appSecret, raw);
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: bodyStr,
    });

    sent += 1;

    if (res.ok) ok += 1;
    else notOk += 1;

    if (delayMs > 0) await sleep(delayMs);
  }

  console.log("[replay-http] done", {
    blocks: blocks.length,
    considered,
    sent,
    skipped,
    parseFailed,
    ok,
    notOk,
  });
}

main().catch((err) => {
  console.error("[replay-http] fatal:", err);
  process.exit(1);
});

