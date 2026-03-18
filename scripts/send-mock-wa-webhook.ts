import "dotenv/config";
import crypto from "node:crypto";

function getArg(name: string) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) return null;
  return process.argv[idx + 1] ?? null;
}

function computeSignature(appSecret: string, rawBody: Buffer) {
  const hmac = crypto.createHmac("sha256", appSecret);
  const digest = hmac.update(rawBody).digest("hex");
  return `sha256=${digest}`;
}

function normalizeWaId(input: string) {
  const digits = input.replace(/\D/g, "");
  // Se vier 11 dígitos (DDD+numero BR), assume DDI 55
  if (digits.length === 11 && !digits.startsWith("55")) return `55${digits}`;
  return digits;
}

async function main() {
  const url =
    getArg("--url") ??
    process.env.WEBHOOK_URL ??
    "http://localhost:4000/";
  const fromInput = getArg("--from") ?? "21999110013";
  const fromRaw = normalizeWaId(fromInput); // cliente (wa_id/sourceId)
  const text = getArg("--text") ?? "não sou mais eu o síndico";
  const profileName = getArg("--name") ?? "Mock - 21999110013";

  // Use defaults reais do teu log pra inbox existir no DB
  const phoneNumberId =
    getArg("--phone-number-id") ??
    process.env.WA_PHONE_NUMBER_ID ??
    "966766673181183";
  const displayPhoneNumber =
    getArg("--display-phone-number") ??
    process.env.WA_DISPLAY_PHONE_NUMBER ??
    "552121536448";

  const tsSec = Math.floor(Date.now() / 1000);
  const messageId = getArg("--message-id") ?? `wamid.MOCK.${tsSec}.${Math.random().toString(16).slice(2)}`;

  const bodyObj = {
    entry: [
      {
        id: `mock-entry-${Date.now()}`,
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: displayPhoneNumber,
                phone_number_id: phoneNumberId,
              },
              contacts: [
                {
                  profile: { name: profileName },
                  wa_id: fromRaw,
                },
              ],
              messages: [
                {
                  from: fromRaw,
                  id: messageId,
                  timestamp: String(tsSec),
                  text: { body: text },
                  type: "text",
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const bodyStr = JSON.stringify(bodyObj);
  const raw = Buffer.from(bodyStr, "utf8");

  const appSecret = process.env.WA_APP_SECRET;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (appSecret) {
    headers["X-Hub-Signature-256"] = computeSignature(appSecret, raw);
  } else {
    console.warn("[mock] WA_APP_SECRET não está definido. Enviando sem assinatura (isso só funciona se o webhook aceitar sem secret).");
  }

  const res = await fetch(url, {
    method: "POST",
    headers,
    body: bodyStr,
  });

  const txt = await res.text().catch(() => "");
  console.log("[mock] sent", {
    url,
    from: fromRaw,
    messageId,
    status: res.status,
    ok: res.ok,
    responseText: txt?.slice(0, 500) || null,
  });
}

main().catch((err) => {
  console.error("[mock] fatal:", err);
  process.exit(1);
});

