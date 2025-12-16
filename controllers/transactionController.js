// controllers/transactionController.js
import mongoose from "mongoose";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import Beneficiary from "../models/Beneficiary.js";

// Petit helper pour récupérer userId proprement
const getUserIdOrThrow = (req) => {
  if (!req.user || !req.user.id) {
    throw new Error("Utilisateur non authentifié (req.user manquant)");
  }
  return req.user.id;
};

// ----------------------------
//     DÉPÔT
// ----------------------------
export const deposit = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);

    const {
      accountId,
      amount,
      currency = "XOF",
      idempotencyKey,
      reference,
      description,
    } = req.body;

    if (!accountId || !amount) {
      throw new Error("accountId et amount sont obligatoires");
    }

    // ✅ FIX — Convertir amount en number
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Montant invalide");
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

    // Génération référence si manquante
    let finalReference = reference;
    if (!finalReference) {
      finalReference = `DEP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }

    if (!account || account.status?.toUpperCase() !== "ACTIVE") {
      throw new Error("Compte introuvable ou inactif");
    }

    // ✅ FIX — Addition correcte
    account.balance = Number(account.balance) + amountNum;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: userId,
          type: "DEPOSIT",
          amount: amountNum,       // FIX
          currency,
          fromAccount: null,
          toAccount: account._id,
          idempotencyKey,
          reference: finalReference,
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
    console.error("Erreur dépôt :", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// ----------------------------
//     RETRAIT
// ----------------------------
export const withdraw = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);

    const {
      accountId,
      amount,
      currency = "XOF",
      idempotencyKey,
      reference,
      description,
    } = req.body;

    if (!accountId || !amount) {
      throw new Error("accountId et amount sont obligatoires");
    }

    // ✅ FIX — Convertir amount
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Montant invalide");
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
    if (!account || account.status?.toUpperCase() !== "ACTIVE") {
      throw new Error("Compte introuvable ou inactif");
    }

    // ✅ FIX — Comparaison correcte
    if (Number(account.balance) < amountNum) {
      throw new Error("Solde insuffisant");
    }

    // FIX — Déduction correcte
    account.balance = Number(account.balance) - amountNum;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: userId,
          type: "WITHDRAWAL",
          amount: amountNum,
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
    console.error("Erreur retrait :", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// ======================================================
// 🔥🔥🔥 TRANSFERT INTERNE (SECTION CORRIGÉE) 🔥🔥🔥
// ======================================================
export const transfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);
    const { fromId, toId, amount, currency = "XOF", description } = req.body;

    if (!fromId || !toId || !amount) {
      throw new Error("fromId, toId et amount sont obligatoires");
    }

    // ✅ FIX — Conversion
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Montant invalide");
    }

    const fromAccount = await Account.findById(fromId).session(session);
    const toAccount = await Account.findById(toId).session(session);

    if (!fromAccount || !toAccount) {
      throw new Error("Compte introuvable");
    }

    // FIX — Comparaison correcte
    if (Number(fromAccount.balance) < amountNum) {
      throw new Error("Solde insuffisant");
    }

    // Référence unique
    const baseRef = `TRI-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const debitRef = `${baseRef}-D`;
    const creditRef = `${baseRef}-C`;

    // FIX — Mise à jour des soldes
    fromAccount.balance = Number(fromAccount.balance) - amountNum;
    toAccount.balance = Number(toAccount.balance) + amountNum;

    await fromAccount.save({ session });
    await toAccount.save({ session });

    // Transaction débit
    const [txDebit] = await Transaction.create(
      [
        {
          user: userId,
          type: "TRANSFER_INTERNAL_DEBIT",
          amount: amountNum,
          currency,
          fromAccount: fromAccount._id,
          toAccount: toAccount._id,
          reference: debitRef,
          description: description || "Transfert interne (débit)",
          status: "SUCCESS",
        },
      ],
      { session }
    );

    // Transaction crédit
    const [txCredit] = await Transaction.create(
      [
        {
          user: userId,
          type: "TRANSFER_INTERNAL_CREDIT",
          amount: amountNum,
          currency,
          fromAccount: fromAccount._id,
          toAccount: toAccount._id,
          reference: creditRef,
          description: description || "Transfert interne (crédit)",
          status: "SUCCESS",
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Transfert interne réussi",
      reference: baseRef,
      transactions: [txDebit, txCredit],
      balances: {
        from: fromAccount.balance,
        to: toAccount.balance,
      },
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Erreur transfert :", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// ----------------------------
//     TRANSFERT USER → USER
// ----------------------------
export const transferUser = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);

    const {
      toUserId,
      amount,
      currency = "XOF",
      idempotencyKey,
      reference,
      description,
    } = req.body;

    if (!toUserId || !amount) {
      throw new Error("toUserId et amount sont obligatoires");
    }

    // FIX — conversion
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Montant invalide");
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
      user: userId,
      type: "COURANT",
    }).session(session);

    if (!fromAcc || fromAcc.status?.toUpperCase() !== "ACTIVE") {
      throw new Error("Votre compte courant est introuvable ou inactif");
    }

    const toAcc = await Account.findOne({
      user: toUserId,
      type: "COURANT",
      status: "ACTIVE",
    }).session(session);

    if (!toAcc || toAcc.status?.toUpperCase() !== "ACTIVE") {
      throw new Error("Le compte du destinataire est introuvable ou inactif");
    }

    if (Number(fromAcc.balance) < amountNum) {
      throw new Error("Solde insuffisant pour effectuer ce transfert");
    }

    fromAcc.balance = Number(fromAcc.balance) - amountNum;
    await fromAcc.save({ session });

    toAcc.balance = Number(toAcc.balance) + amountNum;
    await toAcc.save({ session });

    const [debitTx] = await Transaction.create(
      [
        {
          user: userId,
          type: "TRANSFER_USER_DEBIT",
          amount: amountNum,
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
          user: toUserId,
          type: "TRANSFER_USER_CREDIT",
          amount: amountNum,
          currency,
          fromAccount: fromAcc._id,
          toAccount: toAcc._id,
          relatedUser: userId,
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
    console.error("Erreur transferUser :", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// ----------------------------
//     HISTORIQUE
// ----------------------------
export const getTransactions = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);

    const transactions = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("fromAccount toAccount relatedUser beneficiary");

    return res.json({ transactions });
  } catch (error) {
    console.error("Erreur getTransactions :", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// ----------------------------
//     TRANSFERT → BENEFICIAIRE
// ----------------------------
export const transferToBeneficiary = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);

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

    // FIX — conversion
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Montant invalide");
    }

    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(session);
      if (existing) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ transaction: existing, idempotent: true });
      }
    }

    const account = await Account.findById(fromAccountId).session(session);
    if (!account || account.status?.toUpperCase() !== "ACTIVE") {
      throw new Error("Compte source introuvable ou inactif");
    }

    if (Number(account.balance) < amountNum) {
      throw new Error("Solde insuffisant");
    }

    const beneficiary = await Beneficiary.findOne({
      _id: beneficiaryId,
      user: userId,
    }).session(session);

    if (!beneficiary) {
      throw new Error("Bénéficiaire introuvable");
    }

    account.balance = Number(account.balance) - amountNum;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: userId,
          type: "TRANSFER_EXTERNAL",
          amount: amountNum,
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
    console.error("Erreur transferToBeneficiary :", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// ----------------------------
//     LISTE SERVICES
// ----------------------------
export const getPaymentServices = async (req, res) => {
  const services = [
    { code: "EAU",         name: "Facture d'eau" },
    { code: "ELECTRICITE", name: "Facture d'électricité" },
    { code: "MOBILE",      name: "Recharge mobile" },
    { code: "INTERNET",    name: "Facture Internet" },
  ];

  return res.json({ services });
};

// ----------------------------
//     PAYEMENT FACTURE
// ----------------------------
export const payBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);

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

    // FIX — conversion
    const amountNum = Number(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      throw new Error("Montant invalide");
    }

    const ALLOWED_SERVICES = ["EAU", "ELECTRICITE", "MOBILE", "INTERNET"];

    if (!ALLOWED_SERVICES.includes(serviceCode)) {
      return res.status(400).json({
        message:
          "serviceCode invalide. Services autorisés : EAU, ELECTRICITE, MOBILE, INTERNET",
      });
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
    if (!account || account.status?.toUpperCase() !== "ACTIVE") {
      throw new Error("Compte introuvable ou inactif");
    }

    if (Number(account.balance) < amountNum) {
      throw new Error("Solde insuffisant");
    }

    account.balance = Number(account.balance) - amountNum;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: userId,
          type: "BILL_PAYMENT",
          amount: amountNum,
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
    console.error("Erreur payBill :", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
