// controllers/transactionController.js
import Transaction from "../models/Transaction.js";
import Account from "../models/Account.js";
import User from "../models/User.js";

// POST /api/transactions
export const createTransaction = async (req, res) => {
  try {
    const {
      userId,
      fromAccountId,
      toAccountId,
      type,
      amount,
      description,
      category,
    } = req.body;

    if (!userId || !type || !amount) {
      return res
        .status(400)
        .json({ message: "userId, type et amount sont obligatoires." });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé." });
    }

    // Optionnel : vérifier les comptes si fournis
    let fromAccount = null;
    let toAccount = null;

    if (fromAccountId) {
      fromAccount = await Account.findById(fromAccountId);
      if (!fromAccount) {
        return res
          .status(404)
          .json({ message: "Compte source introuvable." });
      }
    }

    if (toAccountId) {
      toAccount = await Account.findById(toAccountId);
      if (!toAccount) {
        return res
          .status(404)
          .json({ message: "Compte destination introuvable." });
      }
    }

    // Générer une référence simple (à améliorer plus tard)
    const reference = `TX-${Date.now()}`;

    const transaction = await Transaction.create({
      user: userId,
      fromAccount: fromAccountId || null,
      toAccount: toAccountId || null,
      type,
      amount,
      description,
      category,
      reference,
    });

    // TODO plus tard : mise à jour des soldes des comptes

    return res.status(201).json({
      message: "Transaction créée avec succès.",
      transaction,
    });
  } catch (error) {
    console.error("Erreur createTransaction :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

// GET /api/transactions (avec filtres)
export const getTransactions = async (req, res) => {
  try {
    const { userId, type, minAmount, maxAmount, startDate, endDate } = req.query;

    const filter = {};

    if (userId) {
      filter.user = userId;
    }

    if (type) {
      filter.type = type;
    }

    if (minAmount || maxAmount) {
      filter.amount = {};
      if (minAmount) filter.amount.$gte = Number(minAmount);
      if (maxAmount) filter.amount.$lte = Number(maxAmount);
    }

    if (startDate || endDate) {
      filter.transactionDate = {};
      if (startDate) filter.transactionDate.$gte = new Date(startDate);
      if (endDate) filter.transactionDate.$lte = new Date(endDate);
    }

    const transactions = await Transaction.find(filter)
      .sort({ transactionDate: -1 })
      .populate("fromAccount toAccount", "accountNumber label")
      .populate("user", "fullName email");

    return res.json(transactions);
  } catch (error) {
    console.error("Erreur getTransactions :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};

// GET /api/transactions/:id
export const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    const transaction = await Transaction.findById(id)
      .populate("fromAccount toAccount", "accountNumber label")
      .populate("user", "fullName email");

    if (!transaction) {
      return res.status(404).json({ message: "Transaction non trouvée." });
    }

    return res.json(transaction);
  } catch (error) {
    console.error("Erreur getTransactionById :", error);
    return res.status(500).json({ message: "Erreur serveur." });
  }
};
