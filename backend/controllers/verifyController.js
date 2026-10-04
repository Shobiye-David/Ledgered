const asyncHandler = require("express-async-handler");
const Certificate = require("../models/Certificate");
const Institution = require("../models/Institution");
const { computeCombinedHash } = require("../utils/hash");
const { verifyCertificateOnChain } = require("../services/blockchainService");

async function downloadDocument(url) {
  if (!url) throw new Error("Certificate document URL is missing");
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Certificate document returned HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

/**
 * GET /api/verify/:certificateId
 * Public, unauthenticated. Looks up the off-chain record for display
 * purposes, then independently re-verifies the hash and status directly
 * against the smart contract -- the off-chain database is never trusted
 * as the source of truth for authenticity.
 */
const verifyByCertificateId = asyncHandler(async (req, res) => {
  const { certificateId } = req.params;

  const certificate = await Certificate.findOne({ certificateId })
    .populate("institution", "name shortCode website branding")
    .populate("supersededBy", "certificateId");

  if (!certificate) {
    return res.status(404).json({
      found: false,
      message: "No certificate matches this ID in the platform records.",
    });
  }

  let fileBuffer;
  try {
    fileBuffer = await downloadDocument(certificate.documentUrl);
  } catch (documentError) {
    console.warn("[verify] certificate document unavailable:", documentError.message);
    return res.json({
      found: true,
      documentAvailable: false,
      verificationStatus: "document_unavailable",
      isAuthentic: false,
      isActive: false,
      message: "The certificate document is unavailable, so its authenticity cannot be verified.",
      certificate: {
        certificateId: certificate.certificateId,
        studentName: certificate.studentName,
        studentReference: certificate.studentReference,
        program: certificate.program,
        credentialType: certificate.credentialType,
        classification: certificate.classification,
        awardDate: certificate.awardDate,
        documentUrl: certificate.documentUrl,
        institution: certificate.institution,
        status: certificate.status,
        revokedReason: certificate.revokedReason,
        revokedAt: certificate.revokedAt,
        supersededBy: certificate.supersededBy,
      },
    });
  }

  const recomputedHash = computeCombinedHash(fileBuffer, {
    institutionShortCode: certificate.institution.shortCode,
    studentReference: certificate.studentReference,
    studentName: certificate.studentName,
    program: certificate.program,
    credentialType: certificate.credentialType,
    awardDate: certificate.awardDate,
  });
  const onChain = await verifyCertificateOnChain(certificate.certificateId, recomputedHash);

  const isAuthentic = onChain.exists && onChain.hashMatches;
  const isActive = isAuthentic && onChain.status === "active";

  res.json({
    found: true,
    isAuthentic,
    isActive,
    onChainStatus: onChain.status,
    certificate: {
      certificateId: certificate.certificateId,
      studentName: certificate.studentName,
      studentReference: certificate.studentReference,
      program: certificate.program,
      credentialType: certificate.credentialType,
      classification: certificate.classification,
      awardDate: certificate.awardDate,
      documentUrl: certificate.documentUrl,
      institution: certificate.institution,
      status: certificate.status,
      revokedReason: certificate.revokedReason,
      revokedAt: certificate.revokedAt,
      supersededBy: certificate.supersededBy,
    },
    chain: {
      network: certificate.network,
      contractAddress: certificate.contractAddress,
      issueTxHash: certificate.issueTxHash,
      revokeTxHash: certificate.revokeTxHash,
      issuerWallet: onChain.issuerWallet,
      issuedAt: onChain.issuedAt,
      revokedAt: onChain.revokedAt,
    },
  });
});

/**
 * GET /api/verify/institutions
 * Lightweight public directory so a verifier can see which institutions
 * are recognized on the platform (builds trust in the registry itself).
 */
const listVerifiedInstitutions = asyncHandler(async (_req, res) => {
  const institutions = await Institution.find({ status: "active" }).select("name shortCode country website");
  res.json(institutions);
});

module.exports = { verifyByCertificateId, listVerifiedInstitutions };
