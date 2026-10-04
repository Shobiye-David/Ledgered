const crypto = require("crypto");
const mongoose = require("mongoose");

const auditLogSchema = new mongoose.Schema({
  action: { type: String, required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  actorEmail: { type: String, default: null },
  actorRole: { type: String, default: null },
  institution: { type: mongoose.Schema.Types.ObjectId, ref: "Institution", default: null, index: true },
  targetType: String,
  targetId: String,
  targetLabel: String,
  metadata: { type: Object, default: {} },
  ip: String,
  userAgent: String,
  outcome: { type: String, enum: ["success", "failure"], default: "success" },
  prevHash: String,
  hash: String,
  createdAt: { type: Date, default: Date.now, index: -1 },
});

function computeHash(log) {
  return crypto
    .createHash("sha256")
    .update(`${log.prevHash}${log.action}${String(log.actorId)}${String(log.targetId)}${log.createdAt.toISOString()}`)
    .digest("hex");
}

auditLogSchema.pre("validate", async function setChainHash() {
  if (!this.isNew) return;
  const previous = await this.constructor.findOne().sort({ createdAt: -1 }).select("hash").lean();
  this.prevHash = previous?.hash || "GENESIS";
  this.hash = computeHash(this);
});

for (const operation of ["updateOne", "findOneAndUpdate", "deleteOne", "deleteMany"]) {
  auditLogSchema.pre(operation, function blockMutation() {
    throw new Error("Audit logs are immutable");
  });
}

auditLogSchema.statics.computeHash = computeHash;

module.exports = mongoose.model("AuditLog", auditLogSchema);
