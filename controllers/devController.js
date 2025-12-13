// controllers/devController.js
import User from "../models/User.js";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

export const devCreditByEmail = async (req, res) => {
  try {
    const { email, amount } = req.body;

    if (!email || !amount) {
      return res.status(400).json({
        message: "email et amount sont obligatoires",
      });
    }

    const numericAmount = Number(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        message: "Le montant doit être supérieur à 0",
      });
    }

    // 1️⃣ Trouver l'utilisateur par email
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({
        message: "Utilisateur introuvable pour cet email",
      });
    }

    // 2️⃣ Trouver le compte courant de cet utilisateur
    const account = await Account.findOne({
      user: user._id,
      type: "CURRENT",
      status: "ACTIVE",
    });

    if (!account) {
      return res.status(404).json({
        message: "Aucun compte courant actif trouvé pour cet utilisateur",
      });
    }

    // 3️⃣ Créditer le compte
    account.balance += numericAmount;
    await account.save();

    // 4️⃣ Enregistrer une transaction de type DEPOSIT
    const transaction = await Transaction.create({
      user: user._id,
      type: "DEPOSIT",
      amount: numericAmount,
      currency: "XOF",
      toAccount: account._id,
      fromAccount: null,
      meta: {
        byDevScript: true,
        reason: "Crédit DEV par email",
      },
    });

    return res.status(201).json({
      message: "Compte crédité avec succès (mode DEV)",
      user: {
        _id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      account: {
        _id: account._id,
        number: account.number,
        balance: account.balance,
      },
      transaction,
    });
  } catch (error) {
    console.error("Erreur devCreditByEmail :", error);
    return res.status(500).json({
      message: "Erreur serveur lors du crédit DEV",
      error: error.message,
    });
  }
};
