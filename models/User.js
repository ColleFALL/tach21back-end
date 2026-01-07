// models/User.js
import mongoose from "mongoose";

// ✅ Extraire Schema depuis mongoose
const { Schema, model } = mongoose;

// 🔹 Définition du schéma utilisateur
const userSchema = new Schema({
  fullName: { type: String, required: true, trim: true },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  phone: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },

  passwordHash: {
    type: String,
    required: true,
  },

  role: {
    type: String,
    enum: ["user", "admin"],
    default: "user",
  },

  isVerified: {
    type: Boolean,
    default: false,
  },

  // 🔐 VALIDATION EMAIL
  emailVerificationToken: String,
  emailVerificationExpires: Date,

  // 🔐 2FA EMAIL
  twoFactorToken: String,
  twoFactorExpires: Date,

  // 🔐 RESET PASSWORD
  resetPasswordToken: String,
  resetPasswordExpires: Date,

}, { timestamps: true });

// 🔑 Export du modèle User (par défaut)
export default model("User", userSchema);
