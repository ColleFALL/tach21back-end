// const mongoose = require("mongoose");

// const userSchema = new mongoose.Schema(
//   {
//     name: { type: String, required: true },
//     email: { type: String, required: true, unique: true },
//     password: { type: String, required: true }
//   },
//   { timestamps: true }
// );

// module.exports = mongoose.model("User", userSchema);


// models/User.js
import mongoose from "mongoose";

const { Schema } = mongoose;

// 1️⃣ Définition du schéma User
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
  },
  {
    timestamps: true, // ajoute createdAt et updatedAt automatiquement
  }
);

// 2️⃣ Création du modèle basé sur le schéma
const User = mongoose.model("User", userSchema);

// 3️⃣ Export du modèle
export default User;
