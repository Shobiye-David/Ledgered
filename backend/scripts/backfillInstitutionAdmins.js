/**
 * One-time migration for institutions created before memberships.isAdmin.
 * Run manually with: node scripts/backfillInstitutionAdmins.js
 */
require("dotenv").config();
const connectDB = require("../config/db");
const Institution = require("../models/Institution");
const User = require("../models/User");

async function backfillInstitutionAdmins() {
  await connectDB();

  const institutions = await Institution.find().select("_id shortCode").sort({ createdAt: 1 });
  let updatedInstitutions = 0;

  for (const institution of institutions) {
    const staffUsers = await User.find({
      memberships: { $elemMatch: { institution: institution._id, role: "institution_staff" } },
    }).sort({ createdAt: 1, _id: 1 });

    if (staffUsers.length === 0) {
      console.warn(`[backfill] no staff found for ${institution.shortCode}`);
      continue;
    }

    let adminAssigned = false;
    let changed = false;
    for (const user of staffUsers) {
      for (const membership of user.memberships) {
        if (
          membership.role === "institution_staff" &&
          membership.institution.toString() === institution._id.toString()
        ) {
          const shouldBeAdmin = !adminAssigned;
          if (membership.isAdmin !== shouldBeAdmin) {
            membership.isAdmin = shouldBeAdmin;
            changed = true;
          }
          adminAssigned = true;
        }
      }
      if (changed) await user.save();
      changed = false;
    }

    updatedInstitutions += 1;
    console.log(`[backfill] ${institution.shortCode}: admin assigned`);
  }

  console.log(`Backfill complete. Processed ${updatedInstitutions} institution(s).`);
  process.exit(0);
}

backfillInstitutionAdmins().catch((error) => {
  console.error(error);
  process.exit(1);
});
