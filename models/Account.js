// models/Account.js
import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true, // propriétaire du compte
    },
    number: {
      type: String,
      required: true,
      unique: true, // numéro de compte unique
    },
    type: {
      type: String,
      enum: ["COURANT", "EPARGNE","BUSINESS"],
      default: "COURANT",
    },
    balance: {
      type: Number,
      default: 10000, // solde
    },
    currency: {
      type: String,
      default: "XOF",
    },
    status: {
     type: String,
     enum: ["ACTIVE", "BLOCKED", "CLOSED"],
     default: "ACTIVE",
   },

  },
  { timestamps: true }
);

const Account = mongoose.model("Account", accountSchema);
export default Account;
