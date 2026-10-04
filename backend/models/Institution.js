const mongoose = require("mongoose");

/**
 * An Institution is any accredited academic body onboarded onto the
 * platform. Nothing in this schema assumes a particular school -- the
 * platform supports any number of institutions, each scoped to its own
 * staff, students, and certificates.
 */
const institutionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    shortCode: { type: String, required: true, trim: true, uppercase: true, unique: true }, // e.g. "GHI", used in certificate IDs
    country: { type: String, trim: true },
    website: { type: String, trim: true },
    contactEmail: { type: String, required: true, trim: true, lowercase: true },

    // Wallet the institution uses to sign issuance/revocation transactions.
    // Managed custodially by the platform for institutions that don't run
    // their own wallet infra; institutions with their own wallets can supply
    // their address instead.
    walletAddress: { type: String, required: true, trim: true },

    // Present only for platform-custodied wallets (generated at onboarding
    // so institutions without their own crypto infra can still issue
    // certificates). Encrypted at rest; never returned by the API.
    encryptedPrivateKey: { type: String, default: null, select: false },

    // Wallet addresses used before the current issuing wallet. Historical
    // certificates remain tied to their original on-chain issuer.
    previousWallets: [
      {
        address: { type: String, required: true, trim: true },
        retiredAt: { type: Date, required: true },
      },
    ],

    walletRotationWarning: { type: String, default: null },

    // Whether registerInstitution() has been confirmed on-chain yet.
    onChainRegistered: { type: Boolean, default: false },

    // Set when on-chain registration (or a retry) throws, so an admin can
    // see *why* an institution is stuck in "pending" instead of guessing.
    // Cleared on the next successful attempt.
    lastChainError: { type: String, default: null },

    status: {
      type: String,
      enum: ["pending", "active", "suspended"],
      default: "pending",
    },

    // Optional light branding so an institution's issued-certificate view
    // can carry its own mark without touching the platform's own design.
    branding: {
      logoUrl: { type: String, trim: true },
      accentColor: { type: String, trim: true },
    },

    onboardedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Institution", institutionSchema);
