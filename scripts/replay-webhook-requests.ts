import "dotenv/config";
import { readFileSync } from "node:fs";
import crypto from "node:crypto";

const WEBHOOK_URL = "https://v8kckkswowgcsw0ckkgkw8kg.72.60.57.233.sslip.io/";
const LOG_FILE = "/home/rafael/Downloads/webhook-z48sk84s4w4gkcgw4ckgs0ss-134257165102-all-logs-2026-03-02-18-12-25.txt";
const APP_SECRET = process.env.WA_APP_SECRET;

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

function generateSignature(body: string, secret: string) {
    const hmac = crypto.createHmac("sha256", secret);
    return "sha256=" + hmac.update(body).digest("hex");
}

async function main() {
    if (!APP_SECRET) {
        console.warn("[replay] ⚠️ WA_APP_SECRET missing! Requests might be rejected unless in dev mode.");
    }

    console.log(`[replay] Reading log file: ${LOG_FILE}`);
    const logText = readFileSync(LOG_FILE, "utf8");
    const blocks = extractEntryBlocks(logText);
    console.log(`[replay] Found ${blocks.length} entry blocks.`);

    let success = 0;
    let failed = 0;

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];
        let entryJson;
        try {
            entryJson = JSON.parse(block);
        } catch (e) {
            console.error(`[replay] Failed to parse block ${i}:`, e);
            continue;
        }

        const bodyObj = {
            object: "whatsapp_business_account",
            entry: entryJson
        };

        const bodyString = JSON.stringify(bodyObj);
        const headers: Record<string, string> = {
            "Content-Type": "application/json",
        };

        if (APP_SECRET) {
            headers["X-Hub-Signature-256"] = generateSignature(bodyString, APP_SECRET);
        }

        console.log(`[replay] Sending block ${i + 1}/${blocks.length}...`);

        try {
            const response = await fetch(WEBHOOK_URL, {
                method: "POST",
                headers,
                body: bodyString
            });

            if (response.ok) {
                success++;
                console.log(`[replay] ✅ Block ${i + 1} OK (${response.status})`);
            } else {
                failed++;
                const text = await response.text();
                console.error(`[replay] ❌ Block ${i + 1} FAILED (${response.status}): ${text}`);
            }
        } catch (e: any) {
            failed++;
            console.error(`[replay] ❌ Block ${i + 1} ERROR:`, e.message);
        }

        // Delay to avoid hitting DB connection limit again during replay
        await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`\n[replay] FINISHED: SUCCESS=${success}, FAILED=${failed}`);
}

main().catch(console.error);
