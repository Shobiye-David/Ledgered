const asyncHandler = require("express-async-handler");
const { ethers } = require("ethers");
const Institution = require("../models/Institution");
const User = require("../models/User");
const Certificate = require("../models/Certificate");
const {
  generateInstitutionWallet,
  fundInstitutionWallet,
  getWalletBalance,
  registerInstitutionOnChain,
  setInstitutionActiveOnChain,
} = require("../services/blockchainService");
const { encryptPrivateKey } = require("../utils/walletCrypto");
const { recordAudit } = require("../services/auditService");

const BASIC_EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/institutions
 * Platform-admin-only. Onboards a new institution: creates a platform-
 * custodied wallet, registers it on-chain, and creates its first staff
 * account. This is intentionally generic -- it accepts any institution's
 * details and does not assume a specific one.
 */
const onboardInstitution = asyncHandler(async (req, res) => {
  const { name, shortCode, country, website, contactEmail, adminFullName } = req.body;

  if (!name || !shortCode || !contactEmail || !adminFullName) {
    res.status(400);
    throw new Error("name, shortCode, contactEmail, and adminFullName are required");
  }

  const existing = await Institution.findOne({ shortCode: shortCode.toUpperCase() });
  if (existing) {
    res.status(409);
    throw new Error("An institution with this short code is already registered");
  }

  const wallet = generateInstitutionWallet();
  await fundInstitutionWallet(wallet.address);

  const institution = await Institution.create({
    name,
    shortCode: shortCode.toUpperCase(),
    country,
    website,
    contactEmail,
    walletAddress: wallet.address,
    encryptedPrivateKey: encryptPrivateKey(wallet.privateKey),
    status: "pending",
  });

  try {
    await registerInstitutionOnChain(wallet.address, name);
    institution.status = "active";
    institution.onChainRegistered = true;
    institution.lastChainError = null;
    await institution.save();
  } catch (chainError) {
    // Institution record still exists as "pending" -- an admin can retry
    // on-chain registration without redoing the whole onboarding form.
    console.error("[onboardInstitution] on-chain registration failed:", chainError.message);
    institution.lastChainError = chainError.message;
    await institution.save();
  }

  const staffUser = new User({
    fullName: adminFullName,
    email: contactEmail.toLowerCase(),
    memberships: [{ institution: institution._id, role: "institution_staff", isAdmin: true }],
  });
  await staffUser.save();

  await recordAudit(req, { action: "institution.onboarded", institution: institution._id, targetType: "institution", targetId: institution._id.toString(), targetLabel: institution.name });

  res.status(201).json({
    institution: {
      id: institution._id,
      name: institution.name,
      shortCode: institution.shortCode,
      walletAddress: institution.walletAddress,
      status: institution.status,
      lastChainError: institution.lastChainError,
    },
    staffAccount: { email: staffUser.email },
  });
});

/**
 * POST /api/institutions/:id/retry-onchain
 * Platform-admin-only. Re-attempts on-chain registration for an institution
 * stuck in "pending" (most commonly because the platform admin wallet had
 * no gas, or the RPC endpoint was unreachable, at onboarding time).
 */
const retryOnChainRegistration = asyncHandler(async (req, res) => {
  const institution = await Institution.findById(req.params.id);
  if (!institution) {
    res.status(404);
    throw new Error("Institution not found");
  }
  if (institution.onChainRegistered) {
    res.status(409);
    throw new Error("This institution is already registered on-chain");
  }

  await fundInstitutionWallet(institution.walletAddress);

  try {
    await registerInstitutionOnChain(institution.walletAddress, institution.name);
    institution.status = "active";
    institution.onChainRegistered = true;
    institution.lastChainError = null;
    await institution.save();
  } catch (chainError) {
    institution.lastChainError = chainError.message;
    await institution.save();
    res.status(502);
    throw new Error(`On-chain registration failed again: ${chainError.message}`);
  }

  await recordAudit(req, { action: "institution.onchain_retry", institution: institution._id, targetType: "institution", targetId: institution._id.toString(), targetLabel: institution.name });
  res.json({ institution });
});

/** GET /api/institutions (platform admin: list all; institution staff: own record) */
const listInstitutions = asyncHandler(async (req, res) => {
  if (req.user.role === "institution_staff") {
    const institution = await Institution.findById(req.user.institution);
    return res.json([institution]);
  }
  const institutions = await Institution.find().sort({ createdAt: -1 });
  res.json(institutions);
});

/** PATCH /api/institutions/:id/status */
const setInstitutionStatus = asyncHandler(async (req, res) => {
  const { isActive } = req.body;
  const institution = await Institution.findById(req.params.id);
  if (!institution) {
    res.status(404);
    throw new Error("Institution not found");
  }

  const from = institution.status;
  const txHash = await setInstitutionActiveOnChain(institution.walletAddress, isActive);
  institution.status = isActive ? "active" : "suspended";
  await institution.save();

  await recordAudit(req, { action: "institution.status_changed", institution: institution._id, targetType: "institution", targetId: institution._id.toString(), targetLabel: institution.name, metadata: { from, to: institution.status } });
  res.json({ institution, txHash });
});

/** POST /api/institutions/:id/rotate-wallet */
const rotateInstitutionWallet = asyncHandler(async (req, res) => {
  const institution = await Institution.findById(req.params.id);
  if (!institution) {
    res.status(404);
    throw new Error("Institution not found");
  }
  if (institution.status !== "active") {
    res.status(409);
    throw new Error("Only active institutions can rotate their wallet.");
  }

  const oldWalletAddress = institution.walletAddress;
  const newWallet = generateInstitutionWallet();

  try {
    await registerInstitutionOnChain(newWallet.address, institution.name);
  } catch (chainError) {
    console.error("[rotateInstitutionWallet] new wallet registration failed:", chainError.message);
    res.status(502);
    throw new Error(`Wallet rotation failed during registration: ${chainError.message}`);
  }

  const warnings = [];
  const fundingTxHash = await fundInstitutionWallet(newWallet.address);
  if (!fundingTxHash) {
    const warning = "New wallet registration succeeded, but funding the new wallet failed.";
    console.warn(`[rotateInstitutionWallet] ${warning}`);
    warnings.push(warning);
  }

  try {
    await setInstitutionActiveOnChain(oldWalletAddress, false);
  } catch (chainError) {
    const warning = `New wallet is active, but the old wallet could not be deactivated: ${chainError.message}`;
    console.error(`[rotateInstitutionWallet] ${warning}`);
    warnings.push(warning);
  }

  institution.previousWallets = institution.previousWallets || [];
  institution.previousWallets.push({ address: oldWalletAddress, retiredAt: new Date() });
  institution.walletAddress = newWallet.address;
  institution.encryptedPrivateKey = encryptPrivateKey(newWallet.privateKey);
  institution.walletRotationWarning = warnings.length > 0 ? warnings.join(" ") : null;
  await institution.save();

  const walletBalanceWei = await getWalletBalance(newWallet.address).catch((err) => {
    console.warn("[rotateInstitutionWallet] new wallet balance check failed:", err.message);
    return null;
  });
  const publicInstitution = institution.toObject();
  delete publicInstitution.encryptedPrivateKey;

  await recordAudit(req, { action: "institution.wallet_rotated", institution: institution._id, targetType: "institution", targetId: institution._id.toString(), targetLabel: institution.name, metadata: { oldAddress: oldWalletAddress, newAddress: newWallet.address } });
  res.json({
    institution: publicInstitution,
    walletBalance: walletBalanceWei !== null ? ethers.formatEther(walletBalanceWei) : null,
  });
});

/** DELETE /api/institutions/:id */
const deleteInstitution = asyncHandler(async (req, res) => {
  const institution = await Institution.findById(req.params.id);
  if (!institution) {
    res.status(404);
    throw new Error("Institution not found");
  }
  if (institution.status !== "pending" || institution.onChainRegistered !== false) {
    res.status(409);
    throw new Error("Only pending, not-yet-registered institutions can be deleted. Suspend it instead.");
  }

  const certificateExists = await Certificate.exists({ institution: institution._id });
  if (certificateExists) {
    res.status(409);
    throw new Error("This institution cannot be deleted because certificates reference it.");
  }

  await recordAudit(req, { action: "institution.deleted", institution: institution._id, targetType: "institution", targetId: institution._id.toString(), targetLabel: institution.name });
  await institution.deleteOne();
  res.json({ deleted: true, id: institution._id });
});

/** POST /api/institutions/:id/staff */
const addStaff = asyncHandler(async (req, res) => {
  if (
    req.user.role === "institution_staff" &&
    (!req.user.institution ||
      req.user.institution.toString() !== req.params.id ||
      req.user.activeMembership?.isAdmin !== true)
  ) {
    res.status(403);
    throw new Error("Only your institution's admin contact can manage staff.");
  }

  const body = req.body || {};
  const fullName = typeof body.fullName === "string" ? body.fullName.trim() : "";
  const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";

  if (!fullName || !email) {
    res.status(400);
    throw new Error("fullName and email are required");
  }
  if (!BASIC_EMAIL_PATTERN.test(email)) {
    res.status(400);
    throw new Error("A valid email is required");
  }

  const institution = await Institution.findById(req.params.id).select("_id");
  if (!institution) {
    res.status(404);
    throw new Error("Institution not found");
  }

  const existing = await User.findOne({ email });
  if (existing) {
    if (existing.role === "platform_admin") {
      res.status(409);
      throw new Error("A platform admin cannot be assigned an institution membership.");
    }
    const alreadyMember = existing.memberships.some(
      (membership) =>
        membership.role === "institution_staff" &&
        membership.institution.toString() === institution._id.toString()
    );
    if (!alreadyMember) {
      existing.memberships.push({ institution: institution._id, role: "institution_staff", isAdmin: false });
      await existing.save();
    }
    await recordAudit(req, { action: "staff.added", institution: institution._id, targetType: "user", targetId: existing._id.toString(), targetLabel: existing.email });
    return res.status(200).json({
      id: existing._id,
      fullName: existing.fullName,
      email: existing.email,
      role: "institution_staff",
      institution: institution._id,
      isActive: existing.isActive,
    });
  }

  const staffUser = await User.create({
    fullName,
    email,
    memberships: [{ institution: institution._id, role: "institution_staff", isAdmin: false }],
  });

  await recordAudit(req, { action: "staff.added", institution: institution._id, targetType: "user", targetId: staffUser._id.toString(), targetLabel: staffUser.email });

  res.status(201).json({
    id: staffUser._id,
    fullName: staffUser.fullName,
    email: staffUser.email,
    role: staffUser.role,
    institution: staffUser.institution,
    isActive: staffUser.isActive,
  });
});

/**
 * GET /api/institutions/:id
 * The single "inventory" view for one institution: wallet address + live
 * balance (never the private key), its staff roster, and certificate
 * counts. Platform admins can view any institution; institution staff can
 * only view their own.
 */
const getInstitutionDetail = asyncHandler(async (req, res) => {
  if (req.user.role === "institution_staff" && req.user.institution?.toString() !== req.params.id) {
    res.status(403);
    throw new Error("You can only view your own institution");
  }

  const institution = await Institution.findById(req.params.id);
  if (!institution) {
    res.status(404);
    throw new Error("Institution not found");
  }

  const [staff, certificateCounts, walletBalanceWei] = await Promise.all([
    User.find({ "memberships.institution": institution._id, "memberships.role": "institution_staff" })
      .select("fullName email isActive createdAt memberships")
      .then((users) =>
        users.map((user) => {
          const membership = user.memberships.find(
            (entry) =>
              entry.role === "institution_staff" &&
              entry.institution.toString() === institution._id.toString()
          );
          return {
            _id: user._id,
            fullName: user.fullName,
            email: user.email,
            isActive: user.isActive,
            createdAt: user.createdAt,
            isAdmin: membership?.isAdmin === true,
          };
        })
      ),
    Certificate.aggregate([
      { $match: { institution: institution._id } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
    getWalletBalance(institution.walletAddress).catch((err) => {
      console.warn("[getInstitutionDetail] balance check failed:", err.message);
      return null;
    }),
  ]);

  const stats = { total: 0, active: 0, revoked: 0 };
  for (const row of certificateCounts) {
    stats[row._id] = row.count;
    stats.total += row.count;
  }

  res.json({
    institution,
    staff,
    certificateStats: stats,
    walletBalance: walletBalanceWei !== null ? ethers.formatEther(walletBalanceWei) : null,
  });
});

/** DELETE /api/institutions/:id/staff/:userId */
const removeStaff = asyncHandler(async (req, res) => {
  if (
    req.user.role === "institution_staff" &&
    (!req.user.institution ||
      req.user.institution.toString() !== req.params.id ||
      req.user.activeMembership?.isAdmin !== true)
  ) {
    res.status(403);
    throw new Error("Only your institution's admin contact can manage staff.");
  }

  const user = await User.findById(req.params.userId);
  if (!user) {
    res.status(404);
    throw new Error("Staff account not found");
  }

  const before = user.memberships.length;
  user.memberships = user.memberships.filter(
    (membership) =>
      !(membership.role === "institution_staff" && membership.institution.toString() === req.params.id)
  );

  if (user.memberships.length === before) {
    res.status(404);
    throw new Error("This account is not a staff member of that institution");
  }

  if (user.memberships.length === 0 && user.role !== "platform_admin") {
    user.isActive = false;
    await user.save({ validateBeforeSave: false });
  } else {
    await user.save();
  }
  await recordAudit(req, { action: "staff.removed", institution: req.params.id, targetType: "user", targetId: user._id.toString(), targetLabel: user.email });
  res.json({ removed: true });
});

/** PATCH /api/institutions/:id/staff/:userId/admin */
const setStaffAdmin = asyncHandler(async (req, res) => {
  const { isAdmin } = req.body || {};
  if (typeof isAdmin !== "boolean") {
    res.status(400);
    throw new Error("isAdmin must be true or false");
  }

  const user = await User.findById(req.params.userId);
  if (!user) {
    res.status(404);
    throw new Error("Staff account not found");
  }

  const membership = user.memberships.find(
    (entry) =>
      entry.role === "institution_staff" && entry.institution.toString() === req.params.id
  );
  if (!membership) {
    res.status(404);
    throw new Error("This account is not a staff member of that institution");
  }

  if (!isAdmin && membership.isAdmin === true) {
    const adminCount = await User.countDocuments({
      memberships: {
        $elemMatch: {
          institution: req.params.id,
          role: "institution_staff",
          isAdmin: true,
        },
      },
    });
    if (adminCount === 1) {
      res.status(409);
      throw new Error("This institution needs at least one admin. Promote another staff member first.");
    }
  }

  membership.isAdmin = isAdmin;
  await user.save();

  await recordAudit(req, { action: isAdmin ? "staff.admin_granted" : "staff.admin_revoked", institution: membership.institution, targetType: "user", targetId: user._id.toString(), targetLabel: user.email });

  res.json({
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      isActive: user.isActive,
    },
    membership: {
      institution: membership.institution,
      role: membership.role,
      isAdmin: membership.isAdmin,
    },
  });
});

module.exports = {
  onboardInstitution,
  listInstitutions,
  setInstitutionStatus,
  rotateInstitutionWallet,
  deleteInstitution,
  addStaff,
  retryOnChainRegistration,
  getInstitutionDetail,
  removeStaff,
  setStaffAdmin,
};
