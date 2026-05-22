import { Request, Response, NextFunction } from 'express';
import { BAIT_ROUTES, ATTACK_SIGNATURES } from '../config/security';
import { CryptoService } from '../services/cryptoService';
import fs from 'fs';
import path from 'path';

const LOG_FILE_PATH = path.join(process.cwd(), 'security_audit.jsonl');

export const honeypotInterceptor = (req: Request, res: Response, next: NextFunction): void => {
    // Si la ruta no está en nuestro radar de cebos, continuar con flujo normal seguro
    if (!BAIT_ROUTES.includes(req.path)) {
        return next();
    }

    // Extracción defensiva de IP manejando proxies reversos (Cloudflare/Nginx)
    const rawIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'UNKNOWN_IP';
    const clientIp = Array.isArray(rawIp) ? rawIp[0] : rawIp.split(',')[0].trim();

    const rawPayload = JSON.stringify(req.body || {}) + JSON.stringify(req.query || {});
    let detectedThreat = 'SUSPICIOUS_SCANNER';

    // Clasificación determinista de amenazas (Sanitización pasiva)
    if (ATTACK_SIGNATURES.SQL_INJECTION.test(rawPayload) || ATTACK_SIGNATURES.SQL_INJECTION.test(req.path)) {
        detectedThreat = 'SQL_INJECTION';
    } else if (ATTACK_SIGNATURES.PATH_TRAVERSAL.test(req.path)) {
        detectedThreat = 'PATH_TRAVERSAL';
    } else if (ATTACK_SIGNATURES.XSS_ATTACK.test(rawPayload)) {
        detectedThreat = 'XSS_ATTACK';
    }

    const logEntryRaw = {
        timestamp: new Date().toISOString(),
        ip: clientIp,
        method: req.method,
        path: req.path,
        headers: req.headers,
        payload: rawPayload,
        detectedThreat
    };

    try {
        // Firmar el log criptográficamente antes de escribirlo en disco
        const signedLog = CryptoService.signLog(logEntryRaw);

        // Escribir en formato JSON Lines (.jsonl) de forma síncrona/segura
        fs.appendFileSync(LOG_FILE_PATH, JSON.stringify(signedLog) + '\n', 'utf8');
        console.warn(`[⚠️ THREAT DETECTED] Type: ${detectedThreat} | Origin: ${clientIp} | Signed Log Written.`);
    } catch (error: any) {
        console.error(`[❌ SYSTEM ERROR] Failed to write secure log: ${error.message}`);
    }

    // Tarpitting conceptual o respuesta disuasoria: devolvemos un error de autenticación realista
    // Nunca dejamos que la petición continúe hacia el backend real.
    res.status(401).json({
        error: "Unauthorized",
        message: "Authentication credentials are required or invalid."
    });
};