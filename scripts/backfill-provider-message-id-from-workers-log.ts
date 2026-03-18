import { execSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { prisma } from "../lib/prisma";

function getArg(name: string) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function hasFlag(name: string) {
  return process.argv.includes(name);
}

type BackfillRow = {
  messageId: string;
  providerMessageId: string;
  line: string;
};

type Report = {
  dryRun: boolean;
  source: string;
  database: {
    urlPresent: boolean;
    host: string | null;
    port: number | null;
    database: string | null;
    schema: string | null;
  };
  extracted: number;
  uniqueMessageIds: number;
  updated: number;
  skippedAlreadyHasProvider: number;
  skippedNonPending: number;
  missingInDb: number;
  invalidProvider: number;
  samples: {
    updated: Array<{ id: string; providerMessageId: string }>;
    missingInDb: Array<{ id: string; providerMessageId: string }>;
    skippedAlreadyHasProvider: Array<{ id: string; providerMessageId: string }>;
    skippedNonPending: Array<{ id: string; providerMessageId: string; status: string }>;
    invalidProvider: Array<{ id: string; providerMessageId: string }>;
  };
};

function getDatabaseInfo(): Report["database"] {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return { urlPresent: false, host: null, port: null, database: null, schema: null };
  }
  try {
    const u = new URL(raw);
    const schema = u.searchParams.get("schema");
    return {
      urlPresent: true,
      host: u.hostname || null,
      port: u.port ? Number(u.port) : null,
      database: u.pathname?.replace(/^\//, "") || null,
      schema,
    };
  } catch {
    return { urlPresent: true, host: null, port: null, database: null, schema: null };
  }
}

function readWorkersLogText(): { text: string; source: string } {
  const file = getArg("--file");
  const dockerService = getArg("--docker-service") ?? getArg("--docker");
  if (!file && !dockerService) {
    throw new Error("Missing --file or --docker-service");
  }
  if (file) {
    return { text: readFileSync(file, "utf8"), source: `file:${file}` };
  }
  const svc = dockerService!;
  const text = execSync(`docker compose logs --no-color ${svc}`, { encoding: "utf8" });
  return { text, source: `docker:${svc}` };
}

function extractBackfillRows(logText: string): BackfillRow[] {
  const rows: BackfillRow[] = [];
  const lines = logText.split("\n");

  // Example:
  // [ProcessSendMessage] Message cmltqwa4u... sent successfully (provider: wamid.HBg...)
  const re = /\[ProcessSendMessage\] Message ([a-z0-9]+) sent successfully \(provider:\s*([^)]+)\)/i;
  for (const line of lines) {
    const m = line.match(re);
    if (!m) continue;
    const messageId = m[1]!.trim();
    const providerMessageId = m[2]!.trim();
    rows.push({ messageId, providerMessageId, line });
  }
  return rows;
}

async function main() {
  const dryRun = hasFlag("--dry-run");
  const outPath = getArg("--out");
  const limitRaw = getArg("--limit");
  const limit = limitRaw ? Math.max(1, Number(limitRaw)) : null;

  const { text, source } = readWorkersLogText();
  const extracted = extractBackfillRows(text);

  const byMessageId = new Map<string, BackfillRow>();
  for (const row of extracted) {
    // keep last occurrence (usually same provider id anyway)
    byMessageId.set(row.messageId, row);
  }

  const report: Report = {
    dryRun,
    source,
    database: getDatabaseInfo(),
    extracted: extracted.length,
    uniqueMessageIds: byMessageId.size,
    updated: 0,
    skippedAlreadyHasProvider: 0,
    skippedNonPending: 0,
    missingInDb: 0,
    invalidProvider: 0,
    samples: {
      updated: [],
      missingInDb: [],
      skippedAlreadyHasProvider: [],
      skippedNonPending: [],
      invalidProvider: [],
    },
  };

  let processed = 0;

  for (const row of byMessageId.values()) {
    if (limit !== null && processed >= limit) break;
    processed += 1;

    const providerMessageId = row.providerMessageId;
    if (!providerMessageId.startsWith("wamid.")) {
      report.invalidProvider += 1;
      if (report.samples.invalidProvider.length < 10) {
        report.samples.invalidProvider.push({ id: row.messageId, providerMessageId });
      }
      continue;
    }

    const msg = await prisma.chatMessage.findUnique({
      where: { id: row.messageId },
      select: { id: true, providerMessageId: true, status: true },
    });

    if (!msg) {
      report.missingInDb += 1;
      if (report.samples.missingInDb.length < 10) {
        report.samples.missingInDb.push({ id: row.messageId, providerMessageId });
      }
      continue;
    }

    if (msg.providerMessageId) {
      report.skippedAlreadyHasProvider += 1;
      if (report.samples.skippedAlreadyHasProvider.length < 10) {
        report.samples.skippedAlreadyHasProvider.push({ id: row.messageId, providerMessageId });
      }
      continue;
    }

    if (msg.status !== "pending") {
      report.skippedNonPending += 1;
      if (report.samples.skippedNonPending.length < 10) {
        report.samples.skippedNonPending.push({
          id: row.messageId,
          providerMessageId,
          status: msg.status,
        });
      }
      continue;
    }

    if (!dryRun) {
      await prisma.chatMessage.update({
        where: { id: row.messageId },
        data: { providerMessageId, status: "sent" },
      });
    }

    report.updated += 1;
    if (report.samples.updated.length < 10) {
      report.samples.updated.push({ id: row.messageId, providerMessageId });
    }
  }

  if (outPath) {
    writeFileSync(outPath, JSON.stringify(report, null, 2));
  }

  console.log(JSON.stringify(report, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => {});
  });

