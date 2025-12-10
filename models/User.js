// models/User.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const userSchema = new Schema(
  {
    fullName: {
      type: String,
      required: [true, "Le nom complet est obligatoire"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "L'email est obligatoire"],
      unique: true,
      lowercase: true,
      trim: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: [true, "Le mot de passe est obligatoire"],
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

    // 🔹 Champs optionnels EPIC 5
    avatarUrl: {
      type: String,
      default: null,
    },

    pin: {
      type: String, // exemple : "1234"
      default: null,
    },

    preferences: {
      language: {
        type: String,
        enum: ["fr", "en"],
        default: "fr",
      },
      notifications: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: false },
        push: { type: Boolean, default: true },
      },
    },

    // 🔹 Champs pour mot de passe oublié
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },

  {
    timestamps: true,
  }
);

const User = mongoose.model("User", userSchema);
export default User;
