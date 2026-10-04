const express = require("express");
const rateLimit = require("express-rate-limit");
const { verifyByCertificateId, listVerifiedInstitutions } = require("../controllers/verifyController");

const router = express.Router();

// Public endpoint: rate-limited instead of authenticated, since anyone
// (employers, other institutions, the public) needs to be able to verify.
const verifyLimiter = rateLimit({ windowMs: 60 * 1000, max: 30 });

router.get("/institutions", listVerifiedInstitutions);
router.get("/:certificateId", verifyLimiter, verifyByCertificateId);

module.exports = router;
