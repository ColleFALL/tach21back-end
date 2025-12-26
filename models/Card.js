import mongoose from "mongoose";

const cardSchema = new mongoose.Schema(
  {
    // ✅ 1 carte par user
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      unique: true,
      index: true,
    },

    brand: { type: String, default: "VISA" },

    // ✅ on stocke seulement last4 (sécurisé)
    last4: { type: String, required: true },

    expiryMonth: { type: Number, required: true },
    expiryYear: { type: Number, required: true },

    // ✅ nom du titulaire
    // cardholderName: { type: String, required: true },
    cardholderName: { type: String, default: "Client" }, // ✅ pas required


    status: {
      type: String,
      enum: ["ACTIVE", "FROZEN", "BLOCKED"],
      default: "ACTIVE",
    },
     // ✅ NEW — limites
    limits: {
      daily: { type: Number, default: 200000 },   // ex: 200 000 FCFA / jour
      monthly: { type: Number, default: 2000000 } // ex: 2 000 000 FCFA / mois
    },

    // optionnel : lier la carte à un compte précis
    linkedAccount: { type: mongoose.Schema.Types.ObjectId, ref: "Account" },
  },
  { timestamps: true }
);

export default mongoose.model("Card", cardSchema);
