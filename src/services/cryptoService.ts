import crypto from 'crypto';

export interface LogEntry {
    timestamp: string;
    ip: string;
    method: string;
    path: string;
    headers: Record<string, any>;
    payload: string;
    detectedThreat: string;
    hmac?: string;
}

export class CryptoService {
    // Cambiamos a leer directamente process.env en la función por si dotenv tarda en cargar
    public static signLog(entry: Omit<LogEntry, 'hmac'>): LogEntry {
        const secret = process.env.HMAC_SECRET;

        if (!secret) {
            console.error("[❌ CRYPTO ERROR] HMAC_SECRET is undefined in process.env!");
            throw new Error('[CRITICAL] HMAC_SECRET environment variable is missing.');
        }

        const logString = JSON.stringify(entry);

        const hmac = crypto
            .createHmac('sha256', secret)
            .update(logString)
            .digest('hex');

        return { ...entry, hmac };
    }
}