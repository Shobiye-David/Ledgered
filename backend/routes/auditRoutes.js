const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { listAuditLogs, exportAuditLogs, verifyAuditLogs, getAuditAlerts } = require("../controllers/auditController");

const router = express.Router();
router.get("/export", requireAuth, exportAuditLogs);
router.get("/verify", requireAuth, verifyAuditLogs);
router.get("/alerts", requireAuth, getAuditAlerts);
router.get("/", requireAuth, listAuditLogs);

module.exports = router;
