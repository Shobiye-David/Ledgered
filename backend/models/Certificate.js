const mongoose = require("mongoose");

/**
 * Off-chain record for a certificate. `certificateId` and `certificateHash`
 * are the same values anchored on-chain in CertificateRegistry, so any party
 * holding this document (or just the id + the fields used to compute the
 * hash) can independently recompute the hash and check it against the chain.
 */
const certificateSchema = new mongoose.Schema(
  {
    // bytes32 hex string, deterministically derived from institution +
    // studentReference + a per-issuance nonce. Used as the on-chain key.
    certificateId: { type: String, required: true, unique: true, index: true },

    // bytes32 hex string: keccak256(raw document bytes + NUL + canonical metadata payload).
    certificateHash: { type: String, required: true },

    institution: { type: mongoose.Schema.Types.ObjectId, ref: "Institution", required: true },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    revokedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    supersedes: { type: mongoose.Schema.Types.ObjectId, ref: "Certificate", default: null },
    supersededBy: { type: mongoose.Schema.Types.ObjectId, ref: "Certificate", default: null },

    // Canonical, hashed fields -- changing any of these after issuance would
    // change the recomputed hash and fail verification.
    studentName: { type: String, required: true, trim: true },
    studentReference: { type: String, required: true, trim: true },
    studentEmail: { type: String, required: true, lowercase: true, trim: true },
    program: { type: String, required: true, trim: true },
    credentialType: {
      type: String,
      enum: ["degree", "hnd", "ond", "diploma", "certificate", "transcript"],
      required: true,
    },
    awardDate: { type: Date, required: true },
    classification: { type: String, trim: true }, // e.g. "Second Class Upper", optional

    // Chain linkage
    contractAddress: { type: String, required: true },
    network: { type: String, default: "polygon-amoy" },
    issueTxHash: { type: String, required: true },
    revokeTxHash: { type: String, default: null },

    status: {
      type: String,
      enum: ["active", "revoked"],
      default: "active",
    },
    revokedReason: { type: String, default: null },
    revokedAt: { type: Date, default: null },

    // Uploaded certificate document stored off-chain in Cloudinary.
    documentUrl: { type: String, default: null },
  },
  { timestamps: true }
);

certificateSchema.index({ institution: 1, studentReference: 1 });

module.exports = mongoose.model("Certificate", certificateSchema);
