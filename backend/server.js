require("dotenv").config();
const express = require("express");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");

const connectDB = require("./config/db");
const { notFound, errorHandler } = require("./middleware/errorHandler");

const authRoutes = require("./routes/authRoutes");
const { adminLogin } = require("./controllers/authController");
const institutionRoutes = require("./routes/institutionRoutes");
const certificateRoutes = require("./routes/certificateRoutes");
const verifyRoutes = require("./routes/verifyRoutes");
const auditRoutes = require("./routes/auditRoutes");

const app = express();

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);
app.use(cors({ origin: process.env.CLIENT_ORIGIN || "*" }));
app.use(express.json({ limit: "1mb" }));
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/api/health", (_req, res) => res.json({ status: "ok", service: "certchain-backend" }));

const adminAccessPath = process.env.ADMIN_ACCESS_PATH?.trim();
if (!adminAccessPath) {
  console.warn("[server] ADMIN_ACCESS_PATH is missing; platform admin login is disabled");
} else {
  authRoutes.post(`/${adminAccessPath}`, adminLogin);
}
app.use("/api/auth", authRoutes);
app.use("/api/institutions", institutionRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/audit", auditRoutes);

const frontendDirectory = path.join(__dirname, "public");
app.use(express.static(frontendDirectory));
app.get("*", (req, res, next) => {
  if (req.path === "/api" || req.path.startsWith("/api/")) return next();
  res.sendFile(path.join(frontendDirectory, "index.html"), (err) => {
    if (err) next(err);
  });
});

app.use(notFound);
app.use(errorHandler);

const PORT = process.env.PORT || 4000;

connectDB()
  .then(() => {
    app.listen(PORT, () => console.log(`[server] certchain-backend listening on port ${PORT}`));
  })
  .catch((err) => {
    console.error("[server] failed to start:", err.message);
    process.exit(1);
  });

module.exports = app;
