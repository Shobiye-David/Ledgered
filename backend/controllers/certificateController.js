const asyncHandler = require("express-async-handler");
const crypto = require("crypto");
const QRCode = require("qrcode");
const { ethers } = require("ethers");
const { parse } = require("csv-parse/sync");
const Certificate = require("../models/Certificate");
const Institution = require("../models/Institution");
const User = require("../models/User");
const { computeCombinedHash, buildCertificateId } = require("../utils/hash");
const { uploadBuffer } = require("../config/cloudinary");
const {
  ensureWalletHasAtLeast,
  issueCertificateOnChain,
  revokeCertificateOnChain,
} = require("../services/blockchainService");
const { recordAudit } = require("../services/auditService");

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Intentionally conservative per-certificate gas estimate for simple bulk pre-funding.
const ESTIMATED_GAS_PER_CERTIFICATE_WEI = ethers.parseEther("0.002");

function httpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function setResponseStatusFromError(res, error) {
  if (error.statusCode) {
    res.status(error.statusCode);
  }
}

function populateCertificateDetail(certificate) {
  return certificate.populate([
    { path: "institution", select: "name shortCode branding" },
    { path: "issuedBy", select: "fullName email" },
    { path: "revokedBy", select: "fullName email" },
    { path: "supersedes", select: "certificateId studentName program status" },
    { path: "supersededBy", select: "certificateId studentName program status" },
  ]);
}

/** GET /api/certificates/:certificateId/qrcode */
const getCertificateQrCode = asyncHandler(async (req, res) => {
  const clientOrigin = (process.env.CLIENT_ORIGIN || "http://localhost:5173").replace(/\/$/, "");
  const verifyUrl = `${clientOrigin}/verify/${encodeURIComponent(req.params.certificateId)}`;
  const png = await QRCode.toBuffer(verifyUrl, {
    type: "png",
    errorCorrectionLevel: "M",
    margin: 2,
    width: 360,
  });

  res.type("png").send(png);
});

async function issueOneCertificate({
  institution,
  issuedByUserId,
  fileBuffer,
  fileMimetype,
  studentName,
  studentReference,
  studentEmail: rawStudentEmail,
  program,
  credentialType,
  awardDate,
  classification,
  supersedes = null,
}) {
  const studentEmail = typeof rawStudentEmail === "string" ? rawStudentEmail.trim().toLowerCase() : "";

  if (!studentName || !studentReference || !studentEmail || !program || !credentialType || !awardDate) {
    throw httpError(
      400,
      "studentName, studentReference, studentEmail, program, credentialType, and awardDate are required"
    );
  }
  if (!BASIC_EMAIL_PATTERN.test(studentEmail)) {
    throw httpError(400, "A valid student email is required");
  }
  if (!fileBuffer) {
    throw httpError(400, "A certificate PDF or image file is required");
  }

  if (!institution || institution.status !== "active") {
    throw httpError(403, "Your institution is not active on the platform yet");
  }

  let uploadedDocument;
  try {
    uploadedDocument = await uploadBuffer(fileBuffer, fileMimetype);
  } catch (uploadError) {
    console.error("[issueCertificate] Cloudinary upload failed:", uploadError.message);
    throw httpError(502, "Certificate document upload failed. Please try again.");
  }

  const nonce = crypto.randomBytes(8).toString("hex");
  const certificateId = buildCertificateId({ institutionShortCode: institution.shortCode, studentReference, nonce });
  const certificateHash = computeCombinedHash(fileBuffer, {
    institutionShortCode: institution.shortCode,
    studentReference,
    studentName,
    program,
    credentialType,
    awardDate,
  });

  const metadataURI = `certchain://certificates/${certificateId}`;

  const issueTxHash = await issueCertificateOnChain({
    encryptedPrivateKey: institution.encryptedPrivateKey,
    certificateId,
    certificateHash,
    metadataURI,
  });

  const existingStudent = await User.findOne({ email: studentEmail });
  if (existingStudent) {
    if (existingStudent.role === "platform_admin") {
      console.warn(
        `[issueCertificate] student email ${studentEmail} belongs to a platform admin; issuing certificate without modifying that user`
      );
    } else {
      const alreadyMember = existingStudent.memberships.some(
        (membership) =>
          membership.role === "student" &&
          membership.institution.toString() === institution._id.toString()
      );
      if (!alreadyMember) {
        existingStudent.memberships.push({
          institution: institution._id,
          role: "student",
          studentReference,
        });
        await existingStudent.save();
      }
    }
  } else {
    await User.create({
      fullName: studentName || "Unnamed Student",
      email: studentEmail,
      memberships: [{ institution: institution._id, role: "student", studentReference }],
    });
  }

  const certificate = await Certificate.create({
    certificateId,
    certificateHash,
    institution: institution._id,
    issuedBy: issuedByUserId,
    supersedes,
    studentName,
    studentReference,
    studentEmail,
    program,
    credentialType,
    awardDate,
    classification,
    documentUrl: uploadedDocument.secure_url || uploadedDocument.url,
    contractAddress: process.env.CONTRACT_ADDRESS,
    issueTxHash,
    status: "active",
  });

  return certificate;
}

/**
 * POST /api/certificates
 * Institution-staff-only. Issues a certificate: computes the canonical hash
 * and certificateId, anchors them on-chain via the institution's own
 * custodied wallet, then stores the full record off-chain in MongoDB.
 */
const issueCertificate = asyncHandler(async (req, res) => {
  const institution = await Institution.findById(req.user.institution).select("+encryptedPrivateKey");
  let certificate;
  try {
    certificate = await issueOneCertificate({
      institution,
      issuedByUserId: req.user._id,
      fileBuffer: req.file?.buffer,
      fileMimetype: req.file?.mimetype,
      ...req.body,
    });
  } catch (error) {
    setResponseStatusFromError(res, error);
    throw error;
  }
  await recordAudit(req, { action: "certificate.issued", institution: certificate.institution, targetType: "certificate", targetId: certificate._id.toString(), targetLabel: certificate.certificateId, metadata: { txHash: certificate.issueTxHash, certificateId: certificate.certificateId } });
  res.status(201).json(certificate);
});

/** POST /api/certificates/bulk */
const bulkIssueCertificates = asyncHandler(async (req, res) => {
  const csvFile = req.files?.csv?.[0];
  const certificateFiles = req.files?.certificateFiles || [];

  if (!csvFile?.buffer) {
    res.status(400);
    throw new Error("A CSV file is required");
  }
  if (certificateFiles.length === 0) {
    res.status(400);
    throw new Error("At least one certificate file is required");
  }

  let rows;
  try {
    rows = parse(csvFile.buffer.toString("utf8"), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });
  } catch (parseError) {
    res.status(400);
    throw new Error(`CSV could not be parsed: ${parseError.message}`);
  }

  if (rows.length === 0) {
    res.status(400);
    throw new Error("CSV contains no student rows");
  }

  const institution = await Institution.findById(req.user.institution).select("+encryptedPrivateKey");
  if (!institution || institution.status !== "active") {
    res.status(403);
    throw new Error("Your institution is not active on the platform yet");
  }

  const filesByName = new Map(certificateFiles.map((file) => [file.originalname, file]));
  const issueableRowCount = rows.filter((row) => validateBulkRow(row, filesByName) === null).length;
  const totalEstimatedCost = ESTIMATED_GAS_PER_CERTIFICATE_WEI * BigInt(issueableRowCount);

  let fundingResult = { topUpPerformed: false };
  if (totalEstimatedCost > 0n) {
    try {
      fundingResult = await ensureWalletHasAtLeast(institution.walletAddress, totalEstimatedCost);
    } catch (fundingError) {
      res.status(402);
      throw fundingError;
    }
  }

  const results = [];
  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const rowNumber = index + 2;
    const validationError = validateBulkRow(row, filesByName);

    if (validationError) {
      results.push({ row: rowNumber, status: "failed", error: validationError });
      continue;
    }

    const file = filesByName.get(row.fileName);
    try {
      const certificate = await issueOneCertificate({
        institution,
        issuedByUserId: req.user._id,
        fileBuffer: file.buffer,
        fileMimetype: file.mimetype,
        studentName: row.studentName,
        studentReference: row.studentReference,
        studentEmail: row.studentEmail,
        program: row.program,
        credentialType: row.credentialType,
        awardDate: row.awardDate,
        classification: row.classification,
      });
      results.push({ row: rowNumber, status: "success", certificateId: certificate.certificateId });
    } catch (error) {
      results.push({ row: rowNumber, status: "failed", error: error.message });
    }
  }

  const succeeded = results.filter((result) => result.status === "success").length;
  const failed = results.length - succeeded;

  await recordAudit(req, { action: "certificate.bulk_issued", institution: institution._id, targetType: "certificate", targetLabel: `${succeeded} certificates`, metadata: { count: succeeded, failed } });
  res.json({
    total: rows.length,
    succeeded,
    failed,
    walletTopUpPerformed: Boolean(fundingResult.topUpPerformed),
    results,
  });
});

function validateBulkRow(row, filesByName) {
  const requiredFields = ["studentName", "studentReference", "studentEmail", "program", "credentialType", "awardDate", "fileName"];
  const missingField = requiredFields.find((field) => !row[field]);
  if (missingField) {
    return `${missingField} is required`;
  }
  if (!BASIC_EMAIL_PATTERN.test(String(row.studentEmail).trim().toLowerCase())) {
    return "A valid student email is required";
  }
  if (!filesByName.has(row.fileName)) {
    return `No uploaded certificate file matches fileName "${row.fileName}"`;
  }
  return null;
}

/** GET /api/certificates (institution staff: own institution's issued certificates) */
const listCertificates = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.user.role === "institution_staff") {
    filter.institution = req.user.institution;
  } else if (req.user.role === "student") {
    filter.studentReference = req.user.studentReference;
    filter.institution = req.user.institution;
  }

  const certificates = await Certificate.find(filter)
    .populate("institution", "name shortCode branding")
    .sort({ createdAt: -1 });

  res.json(certificates);
});

/** GET /api/certificates/:id */
const getCertificate = asyncHandler(async (req, res) => {
  const certificate = await Certificate.findOne({ certificateId: req.params.id })
    .populate("institution", "name shortCode branding")
    .populate("issuedBy", "fullName email")
    .populate("revokedBy", "fullName email")
    .populate("supersedes", "certificateId studentName program status")
    .populate("supersededBy", "certificateId studentName program status");
  if (!certificate) {
    res.status(404);
    throw new Error("Certificate not found");
  }

  if (req.user.role === "student" && certificate.studentReference !== req.user.studentReference) {
    res.status(403);
    throw new Error("You do not have access to this certificate");
  }
  if (
    req.user.role === "institution_staff" &&
    certificate.institution._id.toString() !== req.user.institution.toString()
  ) {
    res.status(403);
    throw new Error("You do not have access to this certificate");
  }

  res.json(certificate);
});

/** POST /api/certificates/:id/revoke */
const revokeCertificate = asyncHandler(async (req, res) => {
  const { reason } = req.body;
  if (!reason) {
    res.status(400);
    throw new Error("A revocation reason is required");
  }

  const certificate = await Certificate.findOne({ certificateId: req.params.id });
  if (!certificate) {
    res.status(404);
    throw new Error("Certificate not found");
  }
  if (certificate.institution.toString() !== req.user.institution.toString()) {
    res.status(403);
    throw new Error("Only the issuing institution can revoke this certificate");
  }
  if (certificate.status === "revoked") {
    res.status(409);
    throw new Error("This certificate has already been revoked");
  }

  const institution = await Institution.findById(req.user.institution).select("+encryptedPrivateKey");

  const revokeTxHash = await revokeCertificateOnChain({
    encryptedPrivateKey: institution.encryptedPrivateKey,
    certificateId: certificate.certificateId,
    reason,
  });

  certificate.status = "revoked";
  certificate.revokedReason = reason;
  certificate.revokedAt = new Date();
  certificate.revokedBy = req.user._id;
  certificate.revokeTxHash = revokeTxHash;
  await certificate.save();

  await recordAudit(req, { action: "certificate.revoked", institution: certificate.institution, targetType: "certificate", targetId: certificate._id.toString(), targetLabel: certificate.certificateId, metadata: { txHash: revokeTxHash, reason } });
  res.json(await populateCertificateDetail(certificate));
});

/** POST /api/certificates/:id/reissue */
const reissueCertificate = asyncHandler(async (req, res) => {
  const oldCertificate = await Certificate.findOne({ certificateId: req.params.id });
  if (!oldCertificate) {
    res.status(404);
    throw new Error("Certificate not found");
  }
  if (oldCertificate.institution.toString() !== req.user.institution.toString()) {
    res.status(403);
    throw new Error("Only the issuing institution can reissue this certificate");
  }
  if (oldCertificate.status !== "revoked") {
    res.status(409);
    throw new Error("Only a revoked certificate can be reissued as a correction");
  }
  if (oldCertificate.supersededBy) {
    res.status(409);
    throw new Error("This certificate has already been superseded by a corrected version");
  }

  const institution = await Institution.findById(req.user.institution).select("+encryptedPrivateKey");
  let newCertificate;
  try {
    newCertificate = await issueOneCertificate({
      institution,
      issuedByUserId: req.user._id,
      fileBuffer: req.file?.buffer,
      fileMimetype: req.file?.mimetype,
      supersedes: oldCertificate._id,
      ...req.body,
    });
  } catch (error) {
    setResponseStatusFromError(res, error);
    throw error;
  }
  oldCertificate.supersededBy = newCertificate._id;
  await oldCertificate.save();

  await recordAudit(req, { action: "certificate.reissued", institution: newCertificate.institution, targetType: "certificate", targetId: newCertificate._id.toString(), targetLabel: newCertificate.certificateId });
  res.status(201).json(newCertificate);
});

module.exports = {
  issueCertificate,
  bulkIssueCertificates,
  listCertificates,
  getCertificate,
  revokeCertificate,
  reissueCertificate,
  getCertificateQrCode,
};
