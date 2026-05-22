/**
 * Express Routing Configuration
 * Defines honeypot trap endpoints and their handlers
 */

import { Router } from "express";
import {
  handleEnvExposure,
  handleAuthBypass,
  handleAdminPanel,
  handleGenericTrap,
  handleHealthCheck,
  handleStats,
} from "../controllers/honeypotHandlers";

export function createRouter(): Router {
  const router = Router();

  // ========== REAL ENDPOINTS (NOT HONEYPOT) ==========

  /**
   * Health check - used by monitoring systems
   * No logging by honeypot middleware
   */
  router.get("/health", handleHealthCheck);

  /**
   * Statistics - shows captured attacks
   * Protected: In production, add authentication middleware here
   */
  router.get("/stats", handleStats);

  // ========== HONEYPOT TRAP ENDPOINTS ==========
  // These routes are designed to attract attackers and log their activity

  /**
   * Trap: Environment file exposure
   * Commonly targeted: /.env, /config/.env, /.env.example
   */
  router.get("/.env", handleEnvExposure);
  router.get("/config/.env", handleEnvExposure);
  router.get("/.env.example", handleEnvExposure);

  /**
   * Trap: Authentication bypass (SQL injection target)
   * POST /api/v1/auth/login is a common target for:
   * - SQL injection (sqli in username/password)
   * - Brute force attacks
   * - Credential stuffing
   */
  router.post("/api/v1/auth/login", handleAuthBypass);
  router.post("/login", handleAuthBypass);
  router.post("/auth/login", handleAuthBypass);

  /**
   * Trap: Admin panels and database tools
   * Scanners actively look for these
   */
  router.get("/admin/db/phpmyadmin", handleAdminPanel);
  router.get("/phpmyadmin", handleAdminPanel);
  router.get("/admin", handleAdminPanel);
  router.get("/administrator", handleAdminPanel);
  router.get("/wp-admin", handleAdminPanel);

  /**
   * Trap: Common WordPress paths (frequently scanned)
   */
  router.get("/wp-config.php", handleGenericTrap);
  router.get("/wp-admin/admin-ajax.php", handleGenericTrap);
  router.get("/xmlrpc.php", handleGenericTrap);

  /**
   * Trap: Common application paths
   */
  router.get("/api/v1/users", handleGenericTrap);
  router.get("/api/admin", handleGenericTrap);
  router.post("/api/admin", handleGenericTrap);

  /**
   * Trap: File upload endpoints (potential RCE targets)
   */
  router.post("/upload", handleGenericTrap);
  router.post("/file/upload", handleGenericTrap);
  router.post("/api/upload", handleGenericTrap);

  /**
   * Catch-all for unmapped routes (not real endpoints)
   * This will be logged by the honeypot middleware
   */
  router.use((_req, res) => {
    res.status(404).json({
      error: "Not Found",
      message: "The requested resource does not exist",
    });
  });

  return router;
}
