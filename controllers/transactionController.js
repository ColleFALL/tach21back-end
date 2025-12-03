// controllers/transactionController.js
import mongoose from "mongoose";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

// 🟢 DEPOT D'ARGENT
// POST /api/transactions/deposit
export const deposit = async (req, res) => {
  try {
    // DONE: logique de dépôt implémentée

    const { accountId, amount, currency, idempotencyKey, reference } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // idempotence
      if (idempotencyKey) {
        const existing = await Transaction.findOne({ idempotencyKey }).session(session);
        if (existing) {
          await session.abortTransaction();
          session.endSession();
          return res.json({ transaction: existing, idempotent: true });
        }
      }

      const account = await Account.findById(accountId).session(session);
      if (!account || account.status !== "active") {
        throw new Error("Compte introuvable ou inactif");
      }

      // ajouter solde
      account.balance += amount;
      await account.save({ session });

      // enregistrer transaction
      const tx = await Transaction.create([{
        type: "deposit",
        accountId,
        amount,
        currency,
        idempotencyKey,
        reference,
        status: "success"
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return res.json({
        message: "Dépôt effectué avec succès",
        transaction: tx[0],
        balanceAfter: account.balance
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error("Erreur dépôt :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// 🔵 RETRAIT
// POST /api/transactions/withdraw
export const withdraw = async (req, res) => {
  try {
    // DONE: logique de retrait implémentée

    const { accountId, amount, currency, idempotencyKey, reference } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // idempotence
      if (idempotencyKey) {
        const existing = await Transaction.findOne({ idempotencyKey }).session(session);
        if (existing) {
          await session.abortTransaction();
          session.endSession();
          return res.json({ transaction: existing, idempotent: true });
        }
      }

      const account = await Account.findById(accountId).session(session);
      if (!account || account.status !== "active") {
        throw new Error("Compte introuvable ou inactif");
      }

      if (account.balance < amount) {
        throw new Error("Solde insuffisant");
      }

      account.balance -= amount;
      await account.save({ session });

      const tx = await Transaction.create([{
        type: "withdrawal",
        accountId,
        amount,
        currency,
        idempotencyKey,
        reference,
        status: "success"
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return res.json({
        message: "Retrait effectué avec succès",
        transaction: tx[0],
        balanceAfter: account.balance
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error("Erreur retrait :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// 🟣 TRANSFERT ENTRE COMPTES
// POST /api/transactions/transfer
export const transfer = async (req, res) => {
  try {
    // DONE: logique de transfert implémentée

    const { fromId, toId, amount, currency, idempotencyKey, reference } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // idempotence
      if (idempotencyKey) {
        const existing = await Transaction.findOne({ idempotencyKey }).session(session);
        if (existing) {
          await session.abortTransaction();
          session.endSession();
          return res.json({ transaction: existing, idempotent: true });
        }
      }

      const fromAcc = await Account.findById(fromId).session(session);
      const toAcc = await Account.findById(toId).session(session);

      if (!fromAcc || !toAcc) throw new Error("Comptes introuvables");
      if (fromAcc.status !== "active" || toAcc.status !== "active")
        throw new Error("Un compte est inactif");

      // règles de transfert autorisées
      const allowedTransfers = [
        { from: "courant", to: "epargne" },
        { from: "courant", to: "business" },
        { from: "epargne", to: "courant" },
        { from: "business", to: "courant" }
      ];

      const isAllowed = allowedTransfers.some(
        t => t.from === fromAcc.type && t.to === toAcc.type
      );

      if (!isAllowed) throw new Error("Transfert non autorisé entre ces types de comptes");

      if (fromAcc.balance < amount)
        throw new Error("Solde insuffisant");

      // débit
      fromAcc.balance -= amount;
      await fromAcc.save({ session });

      // crédit
      toAcc.balance += amount;
      await toAcc.save({ session });

      const txDebit = await Transaction.create([{
        type: "transfer_debit",
        accountId: fromId,
        relatedAccountId: toId,
        amount,
        currency,
        idempotencyKey,
        reference,
        status: "success"
      }], { session });

      const txCredit = await Transaction.create([{
        type: "transfer_credit",
        accountId: toId,
        relatedAccountId: fromId,
        amount,
        currency,
        idempotencyKey,
        reference,
        status: "success"
      }], { session });

      await session.commitTransaction();
      session.endSession();

      return res.json({
        message: "Transfert effectué avec succès",
        debit: txDebit[0],
        credit: txCredit[0],
        fromBalanceAfter: fromAcc.balance,
        toBalanceAfter: toAcc.balance
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error("Erreur transfert :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// 🧾 HISTORIQUE DES TRANSACTIONS DU USER CONNECTÉ
// GET /api/transactions
export const getTransactions = async (req, res) => {
  try {
    // DONE: récupération des transactions implémentée

    const userId = req.user.id;
    const accounts = await Account.find({ userId }).select("_id");

    const accountIds = accounts.map(acc => acc._id);

    const transactions = await Transaction.find({
      accountId: { $in: accountIds }
    }).sort({ createdAt: -1 });

    return res.json({ transactions });

  } catch (error) {
    console.error("Erreur getTransactions :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};


// 🟣 TRANSFERT ENTRE UTILISATEURS
// GET /api/transactions/transfer/user
export const transferUser = async (req, res) => {
  try {
    const { toUserId, amount, currency, idempotencyKey, reference } = req.body;

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // idempotence
      if (idempotencyKey) {
        const existing = await Transaction.findOne({ idempotencyKey }).session(session);
        if (existing) {
          await session.abortTransaction();
          session.endSession();
          return res.json({ transaction: existing, idempotent: true });
        }
      }

      // 🔍 1) Récupérer compte courant du user connecté (source)
      const fromAcc = await Account.findOne({
        userId: req.user.id,
        type: "courant",
        status: "active"
      }).session(session);

      if (!fromAcc) throw new Error("Votre compte courant est introuvable ou inactif");

      // 🔍 2) Récupérer compte courant du bénéficiaire (destination)
      const toAcc = await Account.findOne({
        userId: toUserId,
        type: "courant",
        status: "active"
      }).session(session);

      if (!toAcc) throw new Error("Le compte du destinataire est introuvable ou inactif");

      // ❌ 3) Vérifier solde
      if (fromAcc.balance < amount) {
        throw new Error("Solde insuffisant pour effectuer ce transfert");
      }

      // 🔁 4) Débit du compte source
      fromAcc.balance -= amount;
      await fromAcc.save({ session });

      // 🔁 5) Crédit du compte du destinataire
      toAcc.balance += amount;
      await toAcc.save({ session });

      // 🧾 6) Enregistrer les deux transactions liées

      const debitTx = await Transaction.create([{
        type: "user_transfer_debit",
        accountId: fromAcc._id,
        relatedAccountId: toAcc._id,
        relatedUserId: toUserId,
        amount,
        currency,
        idempotencyKey,
        reference,
        status: "success"
      }], { session });

      const creditTx = await Transaction.create([{
        type: "user_transfer_credit",
        accountId: toAcc._id,
        relatedAccountId: fromAcc._id,
        relatedUserId: req.user.id,
        amount,
        currency,
        idempotencyKey,
        reference,
        status: "success"
      }], { session });

      // commit transaction
      await session.commitTransaction();
      session.endSession();

      return res.json({
        message: "Transfert utilisateur effectué avec succès",
        debit: debitTx[0],
        credit: creditTx[0],
        balanceAfter: fromAcc.balance
      });

    } catch (error) {
      await session.abortTransaction();
      session.endSession();
      throw error;
    }

  } catch (error) {
    console.error("Erreur transferUser :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

