/**
 * Seeds a minimal demo dataset:
 *  - one platform admin account
 *  - one generic sample institution (fictional, not tied to any real school)
 *  - one institution staff account and one student account for that institution
 *
 * Run with: node seed.js
 * Requires MONGO_URI, ADMIN_SEED_PASSWORD, PLATFORM_ADMIN_PRIVATE_KEY,
 * CONTRACT_ADDRESS, AMOY_RPC_URL, and WALLET_ENCRYPTION_KEY to already be set in .env.
 */
require("dotenv").config();
const bcrypt = require("bcryptjs");
const connectDB = require("./config/db");
const Institution = require("./models/Institution");
const User = require("./models/User");
const { generateInstitutionWallet, registerInstitutionOnChain } = require("./services/blockchainService");
const { encryptPrivateKey } = require("./utils/walletCrypto");

async function seed() {
  await connectDB();

  const adminEmail = "admin@ledgered.example";
  let admin = await User.findOne({ email: adminEmail });
  if (!admin) {
    if (!process.env.ADMIN_SEED_PASSWORD) {
      throw new Error("ADMIN_SEED_PASSWORD is required to create the platform admin");
    }
    admin = new User({ fullName: "Platform Administrator", email: adminEmail, role: "platform_admin" });
    // Store only a bcrypt hash; copy the printed hash into ADMIN_PASSWORD_HASH.
    admin.passwordHash = await bcrypt.hash(process.env.ADMIN_SEED_PASSWORD, 10);
    await admin.save();
    console.log(`Created platform admin: ${adminEmail}`);
    console.log(`Copy this bcrypt hash into ADMIN_PASSWORD_HASH: ${admin.passwordHash}`);
  }

  const shortCode = "RVU";
  let institution = await Institution.findOne({ shortCode });
  if (!institution) {
    const wallet = generateInstitutionWallet();
    institution = await Institution.create({
      name: "Riverside University",
      shortCode,
      country: "Sample Country",
      website: "https://riverside.example.edu",
      contactEmail: "registrar@riverside.example.edu",
      walletAddress: wallet.address,
      encryptedPrivateKey: encryptPrivateKey(wallet.privateKey),
      status: "pending",
    });

    try {
      await registerInstitutionOnChain(wallet.address, institution.name);
      institution.status = "active";
      institution.onChainRegistered = true;
      await institution.save();
      console.log(`Registered "${institution.name}" on-chain at ${wallet.address}`);
    } catch (err) {
      console.warn("On-chain registration skipped (check RPC/contract env vars):", err.message);
    }
  }

  const staffEmail = "registrar@riverside.example.edu";
  let staff = await User.findOne({ email: staffEmail });
  if (!staff) {
    staff = new User({
      fullName: "Sample Registrar",
      email: staffEmail,
      memberships: [{ institution: institution._id, role: "institution_staff" }],
    });
    await staff.setPassword("ChangeMe123!");
    await staff.save();
    console.log(`Created institution staff: ${staffEmail} / ChangeMe123!`);
  }

  const studentEmail = "student@riverside.example.edu";
  let student = await User.findOne({ email: studentEmail });
  if (!student) {
    student = new User({
      fullName: "Sample Student",
      email: studentEmail,
      memberships: [{ institution: institution._id, role: "student", studentReference: "RVU-2023-0042" }],
    });
    await student.setPassword("ChangeMe123!");
    await student.save();
    console.log(`Created student: ${studentEmail} / ChangeMe123!`);
  }

  console.log("\nSeed complete. Staff and student demo passwords remain unchanged.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
