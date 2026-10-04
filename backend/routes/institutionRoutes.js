const express = require("express");
const {
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
} = require("../controllers/institutionController");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

router.post("/", requireAuth, requireRole("platform_admin"), onboardInstitution);
router.get("/", requireAuth, requireRole("platform_admin", "institution_staff"), listInstitutions);
router.get("/:id", requireAuth, requireRole("platform_admin", "institution_staff"), getInstitutionDetail);
router.patch("/:id/status", requireAuth, requireRole("platform_admin"), setInstitutionStatus);
router.post("/:id/rotate-wallet", requireAuth, requireRole("platform_admin"), rotateInstitutionWallet);
router.delete("/:id", requireAuth, requireRole("platform_admin"), deleteInstitution);
router.post("/:id/retry-onchain", requireAuth, requireRole("platform_admin"), retryOnChainRegistration);
router.post("/:id/staff", requireAuth, requireRole("platform_admin", "institution_staff"), addStaff);
router.patch(
  "/:id/staff/:userId/admin",
  requireAuth,
  requireRole("platform_admin"),
  setStaffAdmin
);
router.delete(
  "/:id/staff/:userId",
  requireAuth,
  requireRole("platform_admin", "institution_staff"),
  removeStaff
);

module.exports = router;
