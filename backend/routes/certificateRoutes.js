const express = require("express");
const multer = require("multer");
const {
  issueCertificate,
  bulkIssueCertificates,
  listCertificates,
  getCertificate,
  revokeCertificate,
  reissueCertificate,
  getCertificateQrCode,
} = require("../controllers/certificateController");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../config/cloudinary");

const router = express.Router();
const bulkUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 201 },
  fileFilter: (_req, file, callback) => {
    if (file.fieldname === "csv") {
      if (file.mimetype === "text/csv" || file.originalname.toLowerCase().endsWith(".csv")) {
        return callback(null, true);
      }
      return callback(new Error("Only CSV files are allowed for the csv field"));
    }

    if (file.fieldname === "certificateFiles") {
      const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);
      if (allowedMimeTypes.has(file.mimetype)) {
        return callback(null, true);
      }
      return callback(new Error("Only PDF, PNG, and JPEG certificate files are allowed"));
    }

    callback(new Error(`Unexpected upload field: ${file.fieldname}`));
  },
});

router.post("/", requireAuth, requireRole("institution_staff"), upload.single("certificateFile"), issueCertificate);
router.post(
  "/bulk",
  requireAuth,
  requireRole("institution_staff"),
  bulkUpload.fields([
    { name: "csv", maxCount: 1 },
    { name: "certificateFiles", maxCount: 200 },
  ]),
  bulkIssueCertificates
);
router.get("/", requireAuth, requireRole("institution_staff", "student"), listCertificates);
router.get("/:certificateId/qrcode", getCertificateQrCode);
router.post("/:id/revoke", requireAuth, requireRole("institution_staff"), revokeCertificate);
router.post("/:id/reissue", requireAuth, requireRole("institution_staff"), upload.single("certificateFile"), reissueCertificate);
router.get("/:id", requireAuth, getCertificate);

module.exports = router;
