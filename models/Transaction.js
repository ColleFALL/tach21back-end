// models/Transaction.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const transactionSchema = new Schema(
  {
    // utilisateur qui a initié l'opération
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // type d'opération
    

    amount: {
      type: Number,
      required: true,
      min: 1,
    },

    currency: {
      type: String,
      default: "XOF",
    },

    // compte débité (null pour un dépôt)
    fromAccount: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    // compte crédité (null pour un retrait)
    toAccount: {
      type: Schema.Types.ObjectId,
      ref: "Account",
      default: null,
    },

    // autre utilisateur lié (pour transfert entre utilisateurs)
    relatedUser: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },

    // bénéficiaire (transfert externe)
    beneficiary: {
      type: Schema.Types.ObjectId,
      ref: "Beneficiary",
      default: null,
    },

    // pour l'idempotence
    idempotencyKey: {
      type: String,
      index: true,
      sparse: true,
    },

    // référence métier (numéro de facture, motif, etc.)
    reference: {
      type: String,
      // trim: true,
    },

    description: {
      type: String,
      trim: true,
    },

    // champs spécifiques paiement factures
    serviceCode: {
      type: String,
      trim: true,
    },

    serviceName: {
      type: String,
      trim: true,
    },

    billNumber: {
      type: String,
      trim: true,
    },

    status: {
      type: String,
      enum: ["PENDING", "SUCCESS", "FAILED"],
      default: "SUCCESS",
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
