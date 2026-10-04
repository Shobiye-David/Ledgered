const asyncHandler = require("express-async-handler");
const AuditLog = require("../models/AuditLog");
const { recordAudit, verifyAuditChain } = require("../services/auditService");

function isPlatformAdmin(req) {
  return req.user.role === "platform_admin";
}

function isInstitutionAdmin(req) {
  return req.user.role === "institution_staff" && req.user.activeMembership?.isAdmin === true;
}

function requirePlatformAdmin(req, res) {
  if (!isPlatformAdmin(req)) {
    res.status(403);
    throw new Error("Platform admin access is required");
  }
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildFilters(req, { institutionAdmin = false } = {}) {
  const query = req.query || {};
  const filters = {};
  const actionFilters = [];
  if (institutionAdmin) {
    filters.institution = req.user.institution;
    actionFilters.push({ action: { $not: /^(auth|audit)\./ } });
  } else if (query.institution) {
    filters.institution = query.institution;
  }
  if (query.action) actionFilters.push({ action: query.action });
  if (query.actionPrefix) actionFilters.push({ action: { $regex: `^${escapeRegex(query.actionPrefix)}` } });
  if (query.includeAuditEvents === "false") actionFilters.push({ action: { $not: /^audit\./ } });
  if (actionFilters.length === 1) Object.assign(filters, actionFilters[0]);
  if (actionFilters.length > 1) filters.$and = actionFilters;
  if (query.actorEmail) filters.actorEmail = { $regex: escapeRegex(query.actorEmail), $options: "i" };
  if (query.outcome) filters.outcome = query.outcome;
  if (query.from || query.to) {
    filters.createdAt = {};
    if (query.from) filters.createdAt.$gte = new Date(query.from);
    if (query.to) {
      const end = new Date(query.to);
      end.setHours(23, 59, 59, 999);
      filters.createdAt.$lte = end;
    }
  }
  return filters;
}

function appliedFilters(query, filters) {
  return Object.fromEntries(Object.entries(query).filter(([key, value]) => value !== undefined && value !== "" && key !== "page" && key !== "limit"));
}

const listAuditLogs = asyncHandler(async (req, res) => {
  const platformAdmin = isPlatformAdmin(req);
  const institutionAdmin = isInstitutionAdmin(req);
  if (!platformAdmin && !institutionAdmin) {
    res.status(403);
    throw new Error("Audit log access is restricted to administrators");
  }
  const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
  const maximumLimit = platformAdmin ? 200 : 50;
  const limit = Math.min(maximumLimit, Math.max(1, Number.parseInt(req.query.limit, 10) || 50));
  const filters = buildFilters(req, { institutionAdmin });
  const [logs, total] = await Promise.all([
    AuditLog.find(filters).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate("institution", "name shortCode").lean(),
    AuditLog.countDocuments(filters),
  ]);
  const visibleLogs = institutionAdmin ? logs.map(({ ip, userAgent, ...log }) => log) : logs;
  const response = { logs: visibleLogs, total, page, pages: Math.max(1, Math.ceil(total / limit)) };
  const queryFilters = appliedFilters(req.query, filters);
  recordAudit(req, {
    action: Object.keys(queryFilters).length ? "audit.filtered" : "audit.viewed",
    institution: institutionAdmin ? req.user.institution : null,
    targetType: "audit_log",
    metadata: { filters: queryFilters, resultCount: total },
  });
  res.json(response);
});

function csvCell(value) {
  const text = value == null ? "" : typeof value === "object" ? JSON.stringify(value) : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

const exportAuditLogs = asyncHandler(async (req, res) => {
  requirePlatformAdmin(req, res);
  const filters = buildFilters(req);
  const logs = await AuditLog.find(filters).sort({ createdAt: -1 }).populate("institution", "name shortCode").lean();
  const columns = ["timestamp", "actorEmail", "actorRole", "action", "targetType", "targetId", "targetLabel", "institution", "outcome", "ip", "userAgent", "metadata"];
  const csv = [columns.join(","), ...logs.map((log) => columns.map((column) => csvCell(column === "timestamp" ? log.createdAt?.toISOString() : column === "institution" ? log.institution?.name : log[column])).join(","))].join("\n");
  recordAudit(req, { action: "audit.exported", institution: req.query.institution || null, targetType: "audit_log", metadata: { filters: appliedFilters(req.query, filters), resultCount: logs.length } });
  res.type("text/csv").attachment("audit-log.csv").send(csv);
});

const verifyAuditLogs = asyncHandler(async (req, res) => {
  requirePlatformAdmin(req, res);
  res.json(await verifyAuditChain());
});

function idOf(value) { return value ? String(value) : null; }

const getAuditAlerts = asyncHandler(async (req, res) => {
  requirePlatformAdmin(req, res);
  const days = Math.max(1, Math.min(365, Number.parseInt(req.query.days, 10) || 7));
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const logs = await AuditLog.find({ createdAt: { $gte: since } }).sort({ createdAt: 1 }).lean();
  const alerts = [];
  for (const log of logs) {
    if (log.action === "staff.admin_granted" && idOf(log.actorId) === idOf(log.targetId)) {
      alerts.push({ type: "self_promotion", message: `Self-promotion by ${log.actorEmail || "an actor"}.`, entries: [log._id] });
    }
    if (log.action === "institution.wallet_rotated") {
      alerts.push({ type: "wallet_rotation", message: `Wallet rotation recorded for ${log.targetLabel || "an institution"}.`, entries: [log._id] });
    }
    if (log.action === "staff.removed") {
      const issued = logs.find((entry) => entry.action === "certificate.issued" && idOf(entry.actorId) === idOf(log.actorId) && idOf(entry.institution) === idOf(log.institution) && new Date(log.createdAt) - new Date(entry.createdAt) <= 60 * 60 * 1000 && new Date(entry.createdAt) <= new Date(log.createdAt));
      if (issued) alerts.push({ type: "quick_removal_after_issuance", message: "Staff removal followed certificate issuance by the same actor within 60 minutes.", entries: [issued._id, log._id] });
    }
  }
  const failed = logs.filter((log) => log.action === "auth.admin_login_failed");
  const keys = new Map();
  for (const entry of failed) for (const key of [entry.actorEmail && `email:${entry.actorEmail}`, entry.ip && `ip:${entry.ip}`].filter(Boolean)) keys.set(key, [...(keys.get(key) || []), entry]);
  for (const [key, entries] of keys) {
    for (let start = 0; start < entries.length; start += 1) {
      const windowEntries = entries.filter((entry) => new Date(entry.createdAt) - new Date(entries[start].createdAt) <= 15 * 60 * 1000);
      if (windowEntries.length > 5) {
        alerts.push({ type: "repeated_failed_admin_logins", message: `More than five failed admin logins from ${key.slice(key.indexOf(":") + 1)} within 15 minutes.`, entries: windowEntries.map((entry) => entry._id) });
        break;
      }
    }
  }
  res.json(alerts);
});

module.exports = { listAuditLogs, exportAuditLogs, verifyAuditLogs, getAuditAlerts };
