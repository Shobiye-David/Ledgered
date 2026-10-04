const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/User");

const requireAuth = asyncHandler(async (req, res, next) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    res.status(401);
    throw new Error("Authentication required");
  }

  let payload;
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    res.status(401);
    throw new Error("Invalid or expired session");
  }

  const user = await User.findById(payload.sub);
  if (!user || !user.isActive) {
    res.status(401);
    throw new Error("Account not found or deactivated");
  }

  req.user = user;

  if (payload.role === "platform_admin") {
    // Platform admins use the flat role field and have no active membership.
  } else {
    const membership = user.memberships.find(
      (entry) =>
        entry.role === payload.role &&
        entry.institution?.toString() === payload.institution?.toString()
    );
    if (!membership) {
      res.status(401);
      throw new Error("The active membership is no longer available");
    }
    req.activeMembership = membership;
    // Preserve the established controller interface while making the source
    // of role/institution context the JWT-selected membership.
    req.user.role = membership.role;
    req.user.institution = membership.institution;
    req.user.studentReference = membership.studentReference;
  }
  req.user.activeMembership = req.activeMembership;
  next();
});

/** Restricts a route to one or more roles, e.g. requireRole("platform_admin", "institution_staff"). */
function requireRole(...roles) {
  return (req, res, next) => {
    const currentRole = req.user?.role === "platform_admin" ? req.user.role : req.user?.activeMembership?.role;
    if (!req.user || !roles.includes(currentRole)) {
      res.status(403);
      return next(new Error("You do not have permission to perform this action"));
    }
    next();
  };
}

module.exports = { requireAuth, requireRole };
