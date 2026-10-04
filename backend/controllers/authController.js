const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const { OAuth2Client } = require("google-auth-library");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Institution = require("../models/Institution");
const { recordAudit } = require("../services/auditService");

const adminLoginAttempts = new Map();
const ADMIN_LOCKOUT_WINDOW_MS = 15 * 60 * 1000;
const ADMIN_MAX_FAILED_ATTEMPTS = 5;
const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const GOOGLE_NOT_ADDED_MESSAGE =
  "This email hasn't been added by an institution yet. Ask your institution's admin to add you, or confirm the email on file for your certificate.";

function signToken(user, membership = null) {
  const payload = { sub: user._id.toString() };
  if (user.role === "platform_admin") {
    payload.role = user.role;
  } else {
    payload.role = membership.role;
    payload.institution = membership.institution.toString();
    payload.isAdmin = membership.isAdmin === true;
    if (membership.studentReference) payload.studentReference = membership.studentReference;
  }
  return jwt.sign(payload, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || "8h",
  });
}

async function userResponse(user, membership) {
  const institution = membership?.institution
    ? await Institution.findById(membership.institution).select("name shortCode status branding")
    : null;
  const role = user.role === "platform_admin" ? user.role : membership?.role;
  return {
    id: user._id,
    fullName: user.fullName,
    email: user.email,
    role,
    studentReference: membership?.studentReference,
    institution,
    activeMembership: membership
      ? {
          institutionId: membership.institution,
          role: membership.role,
          isAdmin: membership.isAdmin === true,
          studentReference: membership.studentReference,
        }
      : null,
  };
}

/** POST /api/auth/login */
const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400);
    throw new Error("Email and password are required");
  }

  const user = await User.findOne({ email: email.toLowerCase() }).select("+passwordHash");
  if (!user || !(await user.verifyPassword(password))) {
    await recordAudit(req, { action: "auth.login_failed", targetType: "user", targetLabel: email, outcome: "failure" });
    res.status(401);
    throw new Error("Incorrect email or password");
  }
  if (user.role === "platform_admin") {
    res.status(401);
    throw new Error("Incorrect email or password");
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been deactivated. Contact your institution.");
  }

  const membership = user.memberships[0];

  req.user = user;
  req.user.role = membership.role;
  await recordAudit(req, { action: "auth.login_success", institution: membership.institution, targetType: "user", targetId: user._id.toString(), targetLabel: user.email });

  res.json({
    token: signToken(user, membership),
    user: await userResponse(user, membership),
  });
});

/** POST /api/auth/google */
const googleLogin = asyncHandler(async (req, res) => {
  const { credential, selectionToken, institutionId, role } = req.body || {};

  if (selectionToken) {
    let selection;
    try {
      selection = jwt.verify(selectionToken, process.env.JWT_SECRET);
    } catch {
      res.status(401);
      throw new Error("Your membership selection has expired. Please sign in again.");
    }
    if (selection.purpose !== "membership_selection") {
      res.status(401);
      throw new Error("Invalid membership selection");
    }

    const user = await User.findById(selection.sub);
    const membership = user?.memberships.find(
      (entry) => entry.role === role && entry.institution.toString() === institutionId
    );
    if (!user || !membership) {
      res.status(403);
      throw new Error("That membership is no longer available. Please sign in again.");
    }
    if (!user.isActive) {
      res.status(403);
      throw new Error("This account has been deactivated. Contact your institution.");
    }
    return res.json({ token: signToken(user, membership), user: await userResponse(user, membership) });
  }

  if (!credential || !process.env.GOOGLE_CLIENT_ID) {
    res.status(401);
    throw new Error("Unable to verify Google sign-in. Please try again.");
  }

  let payload;
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: process.env.GOOGLE_CLIENT_ID,
    });
    payload = ticket.getPayload();
  } catch (_err) {
    res.status(401);
    throw new Error("Unable to verify Google sign-in. Please try again.");
  }

  if (!payload?.email || payload.email_verified !== true) {
    res.status(401);
    throw new Error("Unable to verify Google sign-in. Please try again.");
  }

  const user = await User.findOne({ email: payload.email.toLowerCase() });
  if (!user || !user.memberships?.length) {
    res.status(403);
    throw new Error(GOOGLE_NOT_ADDED_MESSAGE);
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been deactivated. Contact your institution.");
  }

  if (user.memberships.length > 1) {
    const memberships = await Promise.all(
      user.memberships.map(async (membership) => {
        const institution = await Institution.findById(membership.institution).select("name shortCode");
        return {
          institutionId: membership.institution,
          institutionName: institution?.name || "Unknown institution",
          role: membership.role,
          studentReference: membership.studentReference,
        };
      })
    );
    return res.json({
      needsSelection: true,
      selectionToken: jwt.sign(
        { sub: user._id.toString(), purpose: "membership_selection" },
        process.env.JWT_SECRET,
        { expiresIn: "10m" }
      ),
      memberships,
    });
  }

  const membership = user.memberships[0];

  res.json({
    token: signToken(user, membership),
    user: await userResponse(user, membership),
  });
});

/** POST /api/auth/:adminAccessPath */
const adminLogin = asyncHandler(async (req, res) => {
  const ip = req.ip;
  const now = Date.now();
  const existing = adminLoginAttempts.get(ip);

  if (existing && now - existing.windowStart < ADMIN_LOCKOUT_WINDOW_MS) {
    if (existing.count >= ADMIN_MAX_FAILED_ATTEMPTS) {
      res.status(429);
      throw new Error("Too many failed attempts. Try again later.");
    }
  } else if (existing) {
    adminLoginAttempts.delete(ip);
  }

  const { password } = req.body || {};
  const passwordHash = process.env.ADMIN_PASSWORD_HASH;
  const passwordMatches =
    typeof password === "string" &&
    typeof passwordHash === "string" &&
    passwordHash.length > 0 &&
    (await bcrypt.compare(password, passwordHash));

  if (!passwordMatches) {
    const attempt = adminLoginAttempts.get(ip);
    if (attempt && now - attempt.windowStart < ADMIN_LOCKOUT_WINDOW_MS) {
      attempt.count += 1;
    } else {
      adminLoginAttempts.set(ip, { count: 1, windowStart: now });
    }
    await recordAudit(req, { action: "auth.admin_login_failed", targetType: "platform_admin", targetLabel: "Platform administrator", outcome: "failure" });
    res.status(401);
    throw new Error("Invalid credentials");
  }

  adminLoginAttempts.delete(ip);

  const user = await User.findOne({ role: "platform_admin" }).select("+passwordHash");
  if (!user) {
    console.error("[auth] platform_admin user is missing; run seed.js before using admin login");
    res.status(500);
    throw new Error("Platform admin account is not configured");
  }
  if (!user.isActive) {
    res.status(403);
    throw new Error("This account has been deactivated. Contact your institution.");
  }

  req.user = user;
  await recordAudit(req, { action: "auth.admin_login_success", targetType: "platform_admin", targetId: user._id.toString(), targetLabel: user.email });

  const institution = user.institution
    ? await Institution.findById(user.institution).select("name shortCode status branding")
    : null;

  res.json({
    token: signToken(user),
    user: {
      id: user._id,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      studentReference: user.studentReference,
      institution,
    },
  });
});

/** GET /api/auth/me */
const me = asyncHandler(async (req, res) => {
  res.json(await userResponse(req.user, req.activeMembership));
});

module.exports = { login, googleLogin, adminLogin, me };
