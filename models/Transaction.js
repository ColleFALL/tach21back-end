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
    type: {
      type: String,
      enum: ["DEPOSIT", "WITHDRAWAL", "TRANSFER"],
      required: true,
    },

    // montant
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

    description: {
      type: String,
      trim: true,
    },
  },
  { timestamps: true }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
