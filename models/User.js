import mongoose from "mongoose";

// ✅ Extraire Schema depuis mongoose
const { Schema, model } = mongoose;

const userSchema = new Schema(
  {
    //ajouter
    email: String,
    password: String,

    emailNotifications: {
    type: Boolean,
    default: true, // activé par défaut
   },
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
        // ✅ AJOUT : téléphone unique (sert d'identifiant pour virements internes)
    phone: { 
      type: String, 
      required: true,
      trim: true, 
      unique: true 
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
    avatarUrl: {
      type: String,
      default: null,
    },
    pin: {
      type: String,
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
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true,
  }
);

// ✅ Utiliser model() pour créer le modèle
const User = model("User", userSchema);
export default User;
