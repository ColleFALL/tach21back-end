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
    },

    bankCode: {
      type: String,
      trim: true,
    },

    // numéro de compte / RIB
    accountNumber: {
      type: String,
      required: true,
      trim: true,
    },

    // éventuel user interne à la plateforme
    linkedUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // type de bénéficiaire : interne à la banque ou externe
    type: {
      type: String,
      enum: ["INTERNAL", "EXTERNAL"],
      default: "EXTERNAL",
    },
  },
  { timestamps: true }
);

const Beneficiary = mongoose.model("Beneficiary", beneficiarySchema);

export default Beneficiary;
