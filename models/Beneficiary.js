// models/Beneficiary.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const beneficiarySchema = new Schema(
  {
    // propriétaire du bénéficiaire (le client)
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },

    // nom du bénéficiaire (contact)
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // banque du bénéficiaire (pour externe)
    bankName: {
      type: String,
      trim: true,
      default: null,
    },

    bankCode: {
      type: String,
      trim: true,
      default: null,
    },

    // numéro de compte / identifiant (chez toi = phone pour interne)
    accountNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },

    // éventuel user interne à la plateforme
    linkedUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
    },

    // type de bénéficiaire : interne à la banque ou externe
    type: {
      type: String,
      enum: ["INTERNAL", "EXTERNAL"],
      default: "EXTERNAL",
      index: true,
    },
  },
  { timestamps: true }
);

// ✅ Empêche les doublons (même user + même accountNumber)
beneficiarySchema.index({ user: 1, accountNumber: 1 }, { unique: true });
const Beneficiary = mongoose.model("Beneficiary", beneficiarySchema);
export default Beneficiary;
