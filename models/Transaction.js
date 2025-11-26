// models/Transaction.js
import mongoose from "mongoose";

const { Schema } = mongoose;

const transactionSchema = new Schema(
  {
    // 🔗 Utilisateur qui a initié la transaction
    user: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },

    // 🔗 Comptes source et destination (optionnels selon le type)
    fromAccount: {
      type: Schema.Types.ObjectId,
      ref: "Account",
    },
    toAccount: {
      type: Schema.Types.ObjectId,
      ref: "Account",
    },

    // Type de transaction (pratique pour filtres + icônes)
    type: {
      type: String,
      enum: ["deposit", "withdrawal", "payment", "transfer", "refund"],
      required: true,
    },

    // Montant (toujours positif : le sens est donné par "type")
    amount: {
      type: Number,
      required: true,
      min: 0,
    },

    // Devise
    currency: {
      type: String,
      default: "XOF",
    },

    // Statut (utile pour l’historique et les erreurs)
    status: {
      type: String,
      enum: ["pending", "completed", "failed", "cancelled"],
      default: "completed",
    },

    // Catégorie pour l’UI (loyer, transfert, alimentation…)
    category: {
      type: String,
      trim: true,
    },

    // Description lisible (affichée dans la page détail)
    description: {
      type: String,
      trim: true,
    },

    // Date réelle de la transaction (pour les filtres)
    transactionDate: {
      type: Date,
      default: Date.now,
    },

    // Référence lisible (code que tu peux afficher dans le détail)
    reference: {
      type: String,
      trim: true,
      unique: true,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

const Transaction = mongoose.model("Transaction", transactionSchema);

export default Transaction;
