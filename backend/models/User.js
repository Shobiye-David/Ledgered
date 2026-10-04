const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

// Migration note: older documents stored a flat role/institution/studentReference;
// new institution users store one or more role contexts in memberships. Existing
// data is intentionally not migrated automatically in this ticket.
const userSchema = new mongoose.Schema(
  {
    fullName: { type: String, required: true, trim: true },
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    passwordHash: { type: String, default: null },

    role: {
      type: String,
      enum: ["platform_admin"],
      required: function roleRequired() {
        return this.memberships.length === 0;
      },
    },

    memberships: [
      {
        institution: { type: mongoose.Schema.Types.ObjectId, ref: "Institution", required: true },
        role: { type: String, enum: ["institution_staff", "student"], required: true },
        isAdmin: { type: Boolean, default: false },
        studentReference: { type: String, trim: true },
      },
    ],

    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.methods.setPassword = async function setPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plainPassword, salt);
};

userSchema.methods.verifyPassword = function verifyPassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

userSchema.set("toJSON", {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model("User", userSchema);
