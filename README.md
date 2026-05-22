# Honeypot API - Active REST API Security Intelligence System

Professional honeypot application for capturing and analyzing malicious API traffic patterns. This project demonstrates advanced cybersecurity concepts including threat detection, cryptographic log signing, and secure payload analysis.

## 🎯 Purpose

This honeypot is designed to:
- **Attract attackers** with fake endpoints that appear vulnerable
- **Capture attack metadata** without executing malicious code
- **Analyze threat patterns** to classify attack types
- **Log evidence** with tamper-proof HMAC signatures for forensic analysis

## 🏗 Project Architecture

```
honeypot-api/
├── src/
│   ├── index.ts                 # Express app entry point
│   ├── types/
│   │   └── index.ts            # TypeScript interfaces
│   ├── services/
│   │   ├── auditLogger.ts       # HMAC-signed logging system
│   │   └── threatAnalyzer.ts    # Attack pattern detection
│   ├── middlewares/
│   │   └── honeypotCapture.ts   # Request interception & metadata extraction
│   ├── controllers/
│   │   └── honeypotHandlers.ts  # Fake endpoint response handlers
│   ├── routes/
│   │   └── index.ts             # Route definitions
│   └── utils/
│       └── crypto.ts            # HMAC-SHA256 utilities
├── config/
├── logs/                        # JSONL audit logs
├── package.json
├── tsconfig.json
└── .env.example
```

## 🔒 Security Design

### 1. **No Code Execution**
- Attacker payloads are **only analyzed as strings**
- Never passed to `eval()`, `exec()`, or shell commands
- No database queries executed with user input
- Pattern matching only - completely sandboxed

### 2. **Tamper-Proof Logs**
Each log entry includes an **HMAC-SHA256 signature** computed from:
- Attack metadata (IP, method, path, headers)
- Threat analysis results
- A secret key stored in `HMAC_SECRET`

**Forensic Guarantee:** If an attacker accesses the server and modifies logs, the HMAC will no longer match the modified data. This proves tampering.

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "timestamp": "2026-05-21T19:15:44.452Z",
  "attack": {
    "sourceIp": "192.168.1.100",
    "method": "POST",
    "path": "/api/v1/auth/login",
    "body": "username=admin' OR '1'='1&password=anything"
  },
  "analysis": {
    "type": "SQL_INJECTION",
    "severity": "HIGH",
    "confidence": 85,
    "indicators": ["SQL_INJECTION_SYNTAX_DETECTED"]
  },
  "hmac": "a3f2d1e8c9b4f7e2a1d5c6b9f3e7a1d4b8c2f5e9a3d7b1c4f8e2a5d9c3f7b1",
  "honeypotVersion": "1.0.0"
}
```

### 3. **Threat Classification**

Attacks are detected via pattern matching:

- **SQL_INJECTION**: Detects `OR '1'='1`, `UNION SELECT`, `DROP TABLE`, etc.
- **PATH_TRAVERSAL**: Detects `../` sequences and directory escape attempts
- **COMMAND_INJECTION**: Detects shell metacharacters and command syntax
- **XSS_ATTEMPT**: Detects `<script>`, `javascript:`, event handlers
- **SCANNER**: Detects known vulnerability scanner signatures (sqlmap, nmap, etc.)
- **BRUTEFORCE**: Targets on `/login` and `/auth` endpoints
- **CREDENTIAL_STUFFING**: Similar to bruteforce pattern

## 🚀 Getting Started

### Prerequisites
- Node.js 16+
- npm or yarn

### Installation

```bash
# Navigate to project
cd honeypot-api

# Install dependencies
npm install

# Copy and configure environment
cp .env.example .env

# Edit .env with a strong HMAC_SECRET
# Example: Generate with: openssl rand -hex 32
nano .env
```

### Running the Honeypot

**Development** (with auto-reload):
```bash
npm run dev
```

**Production** (compiled):
```bash
npm run build
npm start
```

### Testing the Honeypot

Once running, try hitting a honeypot endpoint:

```bash
# View health
curl http://localhost:3000/health

# Trigger SQL Injection detection
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin'"'"' OR '"'"'1'"'"'='"'"'1","password":"test"}'

# Trigger path traversal detection  
curl http://localhost:3000/../../../etc/passwd

# View captured attacks
curl http://localhost:3000/stats
```

## 📊 Log Analysis

Logs are stored in `./logs/honeypot-YYYY-MM-DD.jsonl`:

```bash
# View today's logs
cat logs/honeypot-2026-05-21.jsonl | jq '.'

# Count attacks by type
cat logs/honeypot-*.jsonl | jq '.analysis.type' | sort | uniq -c

# Show high-severity threats
cat logs/honeypot-*.jsonl | jq 'select(.analysis.severity=="HIGH")'

# Check for tampered logs (HMAC mismatch)
# Use the verification function in auditLogger.readAndVerifyLogs()
```

## 🛡 Preventing Payload Execution

### Critical Security Principles

1. **No Eval/Exec**
   - Request bodies are stored as strings
   - Never passed to `eval()`, `Function()`, or `exec()`
   - Pattern analysis is done with RegExp - completely safe

2. **Database Isolation**
   - No real database connections
   - No SQL queries constructed from user input
   - Fake responses don't trigger any real operations

3. **Shell Command Isolation**
   - No shell spawning (spawn, exec, spawn command)
   - Command injection detection is pattern-based only

4. **File System Isolation**
   - Path traversal attempts logged but not executed
   - No `fs.readFile(attackerPath)` or similar operations

### Example: Safe SQL Injection Handling

```typescript
// ❌ DANGEROUS - DON'T DO THIS
const query = `SELECT * FROM users WHERE username = '${req.body.username}'`;
db.query(query); // SQL injection possible!

// ✅ SAFE - HONEYPOT APPROACH
// 1. Store payload as string (no execution)
const payload = JSON.stringify(req.body);

// 2. Analyze for patterns (pattern matching, not execution)
const hasSqlKeywords = /\bUNION\b.*\bSELECT\b/i.test(payload);

// 3. Log with HMAC signature
auditLogger.recordInteraction(attackMetadata, threatAnalysis);

// 4. Return fake response (no database touched)
res.status(401).json({ error: "Invalid credentials" });
```

## 🔑 Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `HMAC_SECRET` | Secret key for HMAC signing (minimum 32 chars) | ✓ Yes |
| `PORT` | Server port (default: 3000) | No |
| `HOST` | Server host (default: 127.0.0.1) | No |
| `NODE_ENV` | Environment mode (development/production) | No |
| `LOG_DIR` | Directory for JSONL logs | No |
| `LOG_LEVEL` | Logging verbosity | No |

## 📈 Honeypot Endpoints

### Real Endpoints
- `GET /health` - Health check
- `GET /stats` - View captured attack statistics

### Honeypot Traps
- `GET /.env` - Environment file exposure
- `GET /config/.env` - Config file leak
- `POST /api/v1/auth/login` - Authentication bypass (SQL injection target)
- `GET /admin` - Admin panel
- `GET /phpmyadmin` - Database admin tool
- `GET /wp-admin` - WordPress admin
- `POST /upload` - File upload endpoint

## 🧪 TypeScript Benefits

This project uses **strict TypeScript** for:
- Type safety (no accidental payload execution)
- Clear interfaces for logs and threat data
- Compile-time error detection
- Self-documenting code

## 📋 Code Structure

### Service Layer
- **AuditLogger**: Handles HMAC signing and JSONL persistence
- **ThreatAnalyzer**: Pattern-based attack classification

### Middleware Layer
- **honeypotCapture**: Intercepts requests, extracts metadata, calls analyzer

### Controller Layer
- **honeypotHandlers**: Returns fake responses for each trap endpoint

## 🔍 Forensic Analysis Tips

1. **Verify Log Integrity**
   ```typescript
   const { valid, tampered } = auditLogger.readAndVerifyLogs();
   console.log(`Valid logs: ${valid.length}, Tampered: ${tampered.length}`);
   ```

2. **Export for Analysis**
   ```bash
   # Export all logs to CSV
   cat logs/honeypot-*.jsonl | jq -r '[.timestamp, .attack.sourceIp, .analysis.type] | @csv' > attacks.csv
   ```

3. **Real-Time Monitoring**
   ```bash
   # Watch for new attacks
   tail -f logs/honeypot-$(date +%Y-%m-%d).jsonl | jq '.analysis'
   ```

## ⚠️ Production Considerations

1. **HMAC Secret Management**
   - Use 64+ character random secret
   - Store in secure secrets manager (AWS Secrets Manager, HashiCorp Vault)
   - Rotate periodically

2. **Log Rotation**
   - Implement log rotation to prevent disk space issues
   - Archive old logs securely

3. **Authentication**
   - Add authentication to `/stats` endpoint
   - Restrict access to honeypot team only

4. **Alerting**
   - Integrate with SIEM (Splunk, ELK Stack)
   - Send alerts for HIGH/CRITICAL threats
   - Monitor for attack pattern changes

5. **Deployment**
   - Run in isolated environment
   - Use network segmentation
   - Monitor for attacker lateral movement attempts

## 📚 Learning Resources

- [OWASP: Honeypots](https://owasp.org/www-community/attacks/Honeypot)
- [CWE-94: Code Injection](https://cwe.mitre.org/data/definitions/94.html)
- [HMAC Security](https://en.wikipedia.org/wiki/HMAC)
- [Express Security](https://expressjs.com/en/advanced/best-practice-security.html)

## 📝 License

MIT - Open source educational project

## 🤝 Contributing

This is a portfolio project. Feel free to:
- Fork and extend with additional attack patterns
- Integrate with your SIEM system
- Add machine learning for anomaly detection
- Implement honeypot network coordination

---

**Built with security-first principles** 🔒

For cybersecurity interviews, this project demonstrates:
- ✓ Secure code practices
- ✓ Cryptographic understanding (HMAC-SHA256)
- ✓ Threat modeling and detection
- ✓ TypeScript expertise
- ✓ Express.js architecture
- ✓ Forensic log design
