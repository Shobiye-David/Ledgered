const AuditLog = require("../models/AuditLog");

async function recordAudit(req, details) {
  try {
    const user = req.user || {};
    await AuditLog.create({
      ...details,
      actorId: user._id || user.id || null,
      actorEmail: user.email || null,
      actorRole: user.role || null,
      ip: req.ip,
      userAgent: req.get?.("user-agent"),
    });
  } catch (error) {
    console.error("[audit] could not record audit entry:", error.message);
  }
}

async function verifyAuditChain() {
  const logs = await AuditLog.find().sort({ createdAt: 1 });
  let expectedPrevious = "GENESIS";
  for (const log of logs) {
    const expectedHash = AuditLog.computeHash({ ...log.toObject(), prevHash: expectedPrevious });
    if (log.prevHash !== expectedPrevious || log.hash !== expectedHash) {
      return { valid: false, brokenAt: log._id, checked: logs.indexOf(log) + 1 };
    }
    expectedPrevious = log.hash;
  }
  return { valid: true, brokenAt: null, checked: logs.length };
}

module.exports = { recordAudit, verifyAuditChain };
