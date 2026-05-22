import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const LOG_FILE_PATH = path.join(process.cwd(), 'security_audit.jsonl');
const SECRET = process.env.HMAC_SECRET;

if (!SECRET) {
    console.error("[❌] Error: HMAC_SECRET variable missing in environment.");
    process.exit(1);
}

if (!fs.existsSync(LOG_FILE_PATH)) {
    console.log("[i] No security logs found to verify yet.");
    process.exit(0);
}

console.log("[*] Initializing cryptographic integrity audit on security logs...\n");

const lines = fs.readFileSync(LOG_FILE_PATH, 'utf8').trim().split('\n');
let integrityCompromised = false;

lines.forEach((line, index) => {
    if (!line) return;

    try {
        const logEntry = JSON.parse(line);
        const { hmac, ...rawEntry } = logEntry;

        // Recalcular el hash de forma determinista usando la clave del sistema
        const calculatedHmac = crypto
            .createHmac('sha256', SECRET)
            .update(JSON.stringify(rawEntry))
            .digest('hex');

        if (calculatedHmac === hmac) {
            console.log(`[✅ LOG #${index + 1}] INTEGRITY VERIFIED. Sello criptográfico intacto.`);
        } else {
            console.error(`[🚨 CRITICAL ALERT - LOG #${index + 1}] INTEGRITY BREACHED! El registro fue modificado u offline tampering detectado.`);
            integrityCompromised = true;
        }
    } catch (err) {
        console.error(`[❌ LOG #${index + 1}] Error parsing log entry (Corrupt line structure).`);
        integrityCompromised = true;
    }
});

console.log("\n--------------------------------------------------");
if (integrityCompromised) {
    console.error("[🚨 AUDIT FAILED] Warning: Log file has been altered or corrupted!");
    process.exit(1);
} else {
    console.log("[🔒 AUDIT SUCCESS] All logs structurally and cryptographically intact.");
    process.exit(0);
}