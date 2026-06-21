const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// A student (or, later, a teacher) account.
const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    grade: { type: String, default: '' },
    country: { type: String, default: '' },
    role: { type: String, enum: ['student', 'teacher'], default: 'student' },
  },
  { timestamps: true } // adds createdAt and updatedAt automatically
);

// Hash a plain password and store it. Never store the raw password.
userSchema.methods.setPassword = async function setPassword(plainPassword) {
  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(plainPassword, salt);
};

// Compare a login attempt against the stored hash.
userSchema.methods.checkPassword = function checkPassword(plainPassword) {
  return bcrypt.compare(plainPassword, this.passwordHash);
};

// Shape sent back to the client — never includes the password hash.
userSchema.methods.toPublicJSON = function toPublicJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    grade: this.grade,
    country: this.country,
    role: this.role,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);
