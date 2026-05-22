import { Request, Response } from "express";
import { AuditLogger } from "../services/auditLogger";

export const handleEnvExposure = (_req: Request, res: Response) => {
  // Return fake environment variables
  res.status(200).type('text/plain').send(`
# Environment Variables
NODE_ENV=production
DB_HOST=localhost
DB_PORT=5432
DB_USER=admin
DB_PASSWORD=honeypot_fake_db_pass_123!
API_KEY=ak_live_honeypot_fake_key_999
JWT_SECRET=super_secret_honeypot_key
  `);
};

export const handleAuthBypass = (_req: Request, res: Response) => {
  // Simulate a failed login attempt with realistic timing
  setTimeout(() => {
    res.status(401).json({
      success: false,
      error: "Invalid username or password"
    });
  }, 300);
};

export const handleAdminPanel = (_req: Request, res: Response) => {
  // Fake admin panel forbidden response
  res.status(403).send(`
    <html>
      <head><title>403 Forbidden</title></head>
      <body>
        <h1>Access Denied</h1>
        <p>You do not have permission to access the administrative interface from this IP address.</p>
      </body>
    </html>
  `);
};

export const handleGenericTrap = (_req: Request, res: Response) => {
  // Generic trap response (e.g., for missing files, WP admin, etc.)
  res.status(404).send(`
    <html>
      <head><title>404 Not Found</title></head>
      <body>
        <h1>Not Found</h1>
        <p>The requested resource could not be found.</p>
      </body>
    </html>
  `);
};

export const handleHealthCheck = (_req: Request, res: Response) => {
  res.status(200).json({ status: "ok", timestamp: new Date().toISOString() });
};

export const handleStats = (req: Request, res: Response) => {
  const auditLogger = req.app.locals.auditLogger as AuditLogger;
  if (!auditLogger) {
    res.status(500).json({ error: "Audit logger not available" });
    return;
  }
  
  try {
    const stats = auditLogger.getLogStats();
    res.status(200).json({
      status: "success",
      data: stats
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to retrieve stats" });
  }
};
