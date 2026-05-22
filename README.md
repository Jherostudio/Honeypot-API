# 🍯 ShadowREST Core - Active API Honeypot

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![TypeScript](https://img.shields.io/badge/typescript-%5E5.9.3-blue)
![Security](https://img.shields.io/badge/security-HMAC%20Signed%20Logs-green)

An active, high-fidelity REST API Honeypot designed by **Jhero Studio**. It simulates a vulnerable backend infrastructure to attract, detect, and securely log malicious traffic patterns (like automated vulnerability scanners and targeted exploitation attempts) without exposing any real assets.

## 🚀 Key Features

### 1. Zero-Execution Architecture (Tarpitting)
The honeypot intercepts malicious payloads at the edge. By returning realistic HTTP error responses (e.g., `401 Unauthorized`), it deceives attackers into believing they are interacting with a real, vulnerable API, effectively wasting their time and resources (tarpitting) while preventing any code execution on the underlying system.

### 2. Cryptographic Immutability (Anti-Forensics)
Log tampering is a common post-exploitation technique. Every threat detected by the honeypot is cryptographically signed using an HMAC-SHA256 signature before being written to disk (`security_audit.jsonl`). This guarantees the forensic integrity of the audit trail.

### 3. Deterministic Threat Classification
Passively sanitizes and classifies incoming payloads using highly optimized deterministic attack signatures:
- `SQL_INJECTION`: Detects boolean-based, UNION-based, and error-based injection attempts.
- `PATH_TRAVERSAL`: Detects directory climbing (`../`) attempts.
- `XSS_ATTACK`: Detects malicious script injection attempts.

## 🛠️ Installation & Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/Jherostudio/Honeypot-API.git
   cd Honeypot-API
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure your environment:
   Create a `.env` file in the root directory and define a strong HMAC secret:
   ```env
   PORT=8080
   HMAC_SECRET="your_super_strong_cryptographic_secret_here"
   ```

4. Run the Honeypot (Development Mode):
   ```bash
   npm run dev
   ```

## 🚨 Simulating an Attack

You can test the detection mechanisms by simulating an attack locally. Open a new terminal and fire a payload:

```bash
# Simulating a SQL Injection Attack on the login endpoint
curl -X POST http://localhost:8080/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d "{\"username\": \"admin\", \"password\": \"' OR '1'='1\"}"
```

**Expected Result:** 
The API will return a standard `401 Unauthorized` response to the client, but internally, the server will log the threat and append it to `security_audit.jsonl` with a cryptographic signature.

## 🔎 Forensic Log Auditing

To prove the integrity of your security logs and ensure no attacker has modified them, run the forensic verification script:

```bash
npm run audit-logs
```

**Output Example:**
```text
[*] Initializing cryptographic integrity audit on security logs...

[✅ LOG #1] INTEGRITY VERIFIED. Sello criptográfico intacto.

--------------------------------------------------
[🔒 AUDIT SUCCESS] All logs structurally and cryptographically intact.
```
If an attacker modifies a single byte of the log file, the audit script will trigger a `CRITICAL ALERT`, flagging the breach.

## 🏗️ Architecture

- `src/server.ts`: The Express.js entry point and global error handler.
- `src/middlewares/interceptor.ts`: The core engine that intercepts, classifies, and tarpits malicious requests.
- `src/config/security.ts`: Defines the bait routes and Regex signatures for threat detection.
- `src/services/cryptoService.ts`: Handles the HMAC-SHA256 signing logic.
- `src/utils/verifyLogs.ts`: The forensic validation script.

## 📄 License

MIT License. Developed with 🖤 by [Jhero Studio](https://github.com/Jherostudio).
