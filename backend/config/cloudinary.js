const multer = require("multer");
const cloudinary = require("cloudinary").v2;
const { CloudinaryStorage } = require("multer-storage-cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const cloudinaryStorage = new CloudinaryStorage({
  cloudinary,
  params: {
    folder: "ledgered-certificates",
    allowed_formats: ["pdf", "png", "jpg", "jpeg"],
    resource_type: "auto",
  },
});

const allowedMimeTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

// Memory storage keeps the exact uploaded bytes available for the combined
// hash. The Cloudinary storage instance above remains configured for callers
// that need direct multer-to-Cloudinary handling elsewhere.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, callback) => {
    if (!allowedMimeTypes.has(file.mimetype)) {
      return callback(new Error("Only PDF, PNG, and JPEG certificate files are allowed"));
    }
    callback(null, true);
  },
});

function uploadBuffer(buffer, mimetype) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "ledgered-certificates",
        resource_type: "auto",
        format: mimetype === "application/pdf" ? "pdf" : undefined,
      },
      (error, result) => (error ? reject(error) : resolve(result))
    );
    stream.end(buffer);
  });
}

module.exports = { cloudinary, cloudinaryStorage, upload, uploadBuffer };
