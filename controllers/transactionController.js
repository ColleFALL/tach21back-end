// controllers/transactionController.js
import mongoose from "mongoose";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import Beneficiary from "../models/Beneficiary.js";

// POST /api/transactions/deposit
export const deposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { accountId, amount, currency = "XOF", idempotencyKey, reference, description } = req.body;

    if (!accountId || !amount) {
      throw new Error("accountId et amount sont obligatoires");
    }

    // Idempotence
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

    account.balance += amount;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: req.user.id,
          type: "DEPOSIT",
          amount,
          currency,
          fromAccount: null,
          toAccount: account._id,
          idempotencyKey,
          reference,
          description,
          status: "SUCCESS",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Dépôt effectué avec succès",
      transaction: tx,
      balanceAfter: account.balance,
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Erreur dépôt :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

//retreit
// POST /api/transactions/withdraw
export const withdraw = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { accountId, amount, currency = "XOF", idempotencyKey, reference, description } = req.body;

    if (!accountId || !amount) {
      throw new Error("accountId et amount sont obligatoires");
    }

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

    const [tx] = await Transaction.create(
      [
        {
          user: req.user.id,
          type: "WITHDRAWAL",
          amount,
          currency,
          fromAccount: account._id,
          toAccount: null,
          idempotencyKey,
          reference,
          description,
          status: "SUCCESS",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Retrait effectué avec succès",
      transaction: tx,
      balanceAfter: account.balance,
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Erreur retrait :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
//Transfert interne entre comptes (même user ou pas)
// POST /api/transactions/transfer
export const transfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { fromId, toId, amount, currency = "XOF", idempotencyKey, reference, description } = req.body;

    if (!fromId || !toId || !amount) {
      throw new Error("fromId, toId et amount sont obligatoires");
    }

    if (fromId === toId) {
      throw new Error("Les comptes source et destination doivent être différents");
    }

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
      { from: "business", to: "courant" },
    ];

    const isAllowed = allowedTransfers.some(
      (t) => t.from === fromAcc.type && t.to === toAcc.type
    );

    if (!isAllowed) throw new Error("Transfert non autorisé entre ces types de comptes");

    if (fromAcc.balance < amount) throw new Error("Solde insuffisant");

    fromAcc.balance -= amount;
    await fromAcc.save({ session });

    toAcc.balance += amount;
    await toAcc.save({ session });

    const [txDebit] = await Transaction.create(
      [
        {
          user: req.user.id,
          type: "TRANSFER_INTERNAL_DEBIT",
          amount,
          currency,
          fromAccount: fromAcc._id,
          toAccount: toAcc._id,
          idempotencyKey,
          reference,
          description,
          status: "SUCCESS",
        },
      ],
      { session }
    );

    const [txCredit] = await Transaction.create(
      [
        {
          user: req.user.id,
          type: "TRANSFER_INTERNAL_CREDIT",
          amount,
          currency,
          fromAccount: fromAcc._id,
          toAccount: toAcc._id,
          idempotencyKey,
          reference,
          description,
          status: "SUCCESS",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Transfert effectué avec succès",
      debit: txDebit,
      credit: txCredit,
      fromBalanceAfter: fromAcc.balance,
      toBalanceAfter: toAcc.balance,
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Erreur transfert :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
// transfere entre user
// POST /api/transactions/transfer/user
export const transferUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { toUserId, amount, currency = "XOF", idempotencyKey, reference, description } = req.body;

    if (!toUserId || !amount) {
      throw new Error("toUserId et amount sont obligatoires");
    }

    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(session);
      if (existing) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ transaction: existing, idempotent: true });
      }
    }

    const fromAcc = await Account.findOne({
      userId: req.user.id,
      type: "courant",
      status: "active",
    }).session(session);

    if (!fromAcc) throw new Error("Votre compte courant est introuvable ou inactif");

    const toAcc = await Account.findOne({
      userId: toUserId,
      type: "courant",
      status: "active",
    }).session(session);

    if (!toAcc) throw new Error("Le compte du destinataire est introuvable ou inactif");

    if (fromAcc.balance < amount) {
      throw new Error("Solde insuffisant pour effectuer ce transfert");
    }

    fromAcc.balance -= amount;
    await fromAcc.save({ session });

    toAcc.balance += amount;
    await toAcc.save({ session });

    const [debitTx] = await Transaction.create(
      [
        {
          user: req.user.id,
          type: "TRANSFER_USER_DEBIT",
          amount,
          currency,
          fromAccount: fromAcc._id,
          toAccount: toAcc._id,
          relatedUser: toUserId,
          idempotencyKey,
          reference,
          description,
          status: "SUCCESS",
        },
      ],
      { session }
    );

    const [creditTx] = await Transaction.create(
      [
        {
          user: toUserId, // le bénéficiaire est "l'auteur" côté crédit
          type: "TRANSFER_USER_CREDIT",
          amount,
          currency,
          fromAccount: fromAcc._id,
          toAccount: toAcc._id,
          relatedUser: req.user.id,
          idempotencyKey,
          reference,
          description,
          status: "SUCCESS",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Transfert utilisateur effectué avec succès",
      debit: debitTx,
      credit: creditTx,
      balanceAfter: fromAcc.balance,
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Erreur transferUser :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
//historiques des transactions
// GET /api/transactions
export const getTransactions = async (req, res) => {
  try {
    const userId = req.user.id;

    const transactions = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("fromAccount toAccount relatedUser");

    return res.json({ transactions });
  } catch (error) {
    console.error("Erreur getTransactions :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

//fonction pour beneficier
// POST /api/transactions/transfer/beneficiary
export const transferToBeneficiary = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      fromAccountId,
      beneficiaryId,
      amount,
      currency = "XOF",
      idempotencyKey,
      reference,
      description,
    } = req.body;

    if (!fromAccountId || !beneficiaryId || !amount) {
      throw new Error("fromAccountId, beneficiaryId et amount sont obligatoires");
    }

    // Idempotence
    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(session);
      if (existing) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ transaction: existing, idempotent: true });
      }
    }

    const account = await Account.findById(fromAccountId).session(session);
    if (!account || account.status !== "active") {
      throw new Error("Compte source introuvable ou inactif");
    }

    if (account.balance < amount) {
      throw new Error("Solde insuffisant");
    }

    const beneficiary = await Beneficiary.findOne({
      _id: beneficiaryId,
      user: req.user.id,
    }).session(session);

    if (!beneficiary) {
      throw new Error("Bénéficiaire introuvable");
    }

    // débit du compte
    account.balance -= amount;
    await account.save({ session });

    // On enregistre une seule transaction "débit" vers l'extérieur
    const [tx] = await Transaction.create(
      [
        {
          user: req.user.id,
          type: "TRANSFER_EXTERNAL",
          amount,
          currency,
          fromAccount: account._id,
          toAccount: null,
          beneficiary: beneficiary._id,
          idempotencyKey,
          reference,
          description,
          status: "SUCCESS",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Transfert externe effectué avec succès",
      transaction: tx,
      balanceAfter: account.balance,
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Erreur transferToBeneficiary :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

//pour les service du paiement
// GET /api/transactions/services
export const getPaymentServices = async (req, res) => {
  // mock de services, plus tard tu pourras brancher une vraie API
  const services = [
    { code: "SENELEC", name: "SENELEC - Électricité" },
    { code: "SDE", name: "SDE - Eau" },
    { code: "ORANGE", name: "Orange - Télécom" },
    { code: "FREE", name: "Free - Télécom" },
    { code: "CANAL", name: "Canal+ - TV" },
  ];

  return res.json({ services });
};
// paiement d une facture
// POST /api/transactions/bill-payment
export const payBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      accountId,
      amount,
      serviceCode,
      serviceName,
      billNumber,
      currency = "XOF",
      idempotencyKey,
      reference,
      description,
    } = req.body;

    if (!accountId || !amount || !serviceCode || !billNumber) {
      throw new Error(
        "accountId, amount, serviceCode et billNumber sont obligatoires"
      );
    }

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

    // débit
    account.balance -= amount;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: req.user.id,
          type: "BILL_PAYMENT",
          amount,
          currency,
          fromAccount: account._id,
          toAccount: null,
          serviceCode,
          serviceName,
          billNumber,
          idempotencyKey,
          reference,
          description,
          status: "SUCCESS",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Paiement de facture effectué avec succès",
      transaction: tx,
      balanceAfter: account.balance,
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Erreur payBill :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};



