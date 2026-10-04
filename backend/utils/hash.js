const { ethers } = require("ethers");

/**
 * Builds the canonical string that a certificate's hash is derived from.
 * Field order and formatting here MUST stay stable -- any change breaks
 * verification for certificates already issued. Dates are normalized to
 * ISO date (no time) so re-hashing is deterministic regardless of timezone.
 */
function canonicalPayload({ institutionShortCode, studentReference, studentName, program, credentialType, awardDate }) {
  const isoDate = new Date(awardDate).toISOString().slice(0, 10);
  return [
    institutionShortCode.trim().toUpperCase(),
    studentReference.trim().toUpperCase(),
    studentName.trim(),
    program.trim(),
    credentialType.trim(),
    isoDate,
  ].join("|");
}

/** keccak256 hash (bytes32 hex string) of the canonical certificate payload. */
function hashCertificate(fields) {
  const payload = canonicalPayload(fields);
  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}

/**
 * Hashes the certificate document and canonical metadata together. The exact
 * order is raw file bytes, one NUL separator byte, then metadata UTF-8 bytes;
 * verification must reproduce this byte sequence exactly.
 */
function computeCombinedHash(fileBuffer, metadataFields) {
  const metadataBytes = ethers.toUtf8Bytes(canonicalPayload(metadataFields));
  const combined = Buffer.concat([Buffer.from(fileBuffer), Buffer.from([0]), Buffer.from(metadataBytes)]);
  return ethers.keccak256(combined);
}

/**
 * Deterministic on-chain identifier for a certificate: institution +
 * student reference + a per-issuance nonce (so the same student can hold
 * multiple certificates from the same institution without collisions).
 */
function buildCertificateId({ institutionShortCode, studentReference, nonce }) {
  const payload = `${institutionShortCode.trim().toUpperCase()}|${studentReference.trim().toUpperCase()}|${nonce}`;
  return ethers.keccak256(ethers.toUtf8Bytes(payload));
}

module.exports = { canonicalPayload, hashCertificate, computeCombinedHash, buildCertificateId };
