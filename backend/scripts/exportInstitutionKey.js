/**
 * One-off, local-only utility to reveal an institution's decrypted wallet
 * private key. This is intentionally NOT an API endpoint and NOT wired into
 * the app — it exists only for manual ops (e.g. importing a wallet into
 * MetaMask to inspect something Polygonscan doesn't show).
 *
 * SECURITY NOTES — read before using:
 *   - Run this only on your own machine, only when you actually need the key.
 *   - The private key gives full control of that institution's issuing
 *     wallet (it can issue or revoke certificates in that institution's
 *     name). Treat the terminal output like a password.
 *   - Don't paste the output into chat tools, screenshots, tickets, or
 *     anywhere else it could be logged or seen by someone else.
 *   - Clear your terminal / scrollback after you're done with it.
 *   - This script is not something to run in production CI, a shared
 *     server, or anywhere its output could be captured by logging.
 *
 * Usage (from the backend/ directory, with your real .env in place):
 *
 *   node scripts/exportInstitutionKey.js RVU --confirm
 *
 * Replace RVU with the institution's shortCode (as shown in the admin
 * dashboard). The --confirm flag is required on purpose, so this can't be
 * run by accident by tab-completing or re-running a previous command.
 */
require("dotenv").config();
const mongoose = require("mongoose");
const Institution = require("../models/Institution");
const { decryptPrivateKey } = require("../utils/walletCrypto");

async function main() {
  const [shortCodeArg, confirmFlag] = process.argv.slice(2);

  if (!shortCodeArg || confirmFlag !== "--confirm") {
    console.error(
      "Usage: node scripts/exportInstitutionKey.js <shortCode> --confirm\n" +
        "Example: node scripts/exportInstitutionKey.js RVU --confirm"
    );
    process.exit(1);
  }

  if (!process.env.MONGO_URI) {
    console.error("MONGO_URI is not set in your .env file.");
    process.exit(1);
  }
  if (!process.env.WALLET_ENCRYPTION_KEY) {
    console.error("WALLET_ENCRYPTION_KEY is not set in your .env file -- can't decrypt without it.");
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGO_URI);

  const institution = await Institution.findOne({ shortCode: shortCodeArg.toUpperCase() }).select(
    "+encryptedPrivateKey"
  );

  if (!institution) {
    console.error(`No institution found with shortCode "${shortCodeArg}".`);
    await mongoose.disconnect();
    process.exit(1);
  }

  if (!institution.encryptedPrivateKey) {
    console.error(
      `"${institution.name}" has no platform-custodied key on file -- it likely supplied its own wallet address.`
    );
    await mongoose.disconnect();
    process.exit(1);
  }

  const privateKey = decryptPrivateKey(institution.encryptedPrivateKey);

  console.log("\n=================================================================");
  console.log(`Institution: ${institution.name} (${institution.shortCode})`);
  console.log(`Wallet address: ${institution.walletAddress}`);
  console.log(`Private key:    ${privateKey}`);
  console.log("=================================================================");
  console.log(
    "\nThis key controls that institution's ability to issue/revoke certificates.\n" +
      "Don't share, log, or screenshot it. Clear your terminal scrollback when done.\n"
  );

  await mongoose.disconnect();
}

main().catch((err) => {
  console.error("Failed to export key:", err.message);
  process.exit(1);
});
