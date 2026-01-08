// controllers/transactionController.js
import mongoose from "mongoose";
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";
import Beneficiary from "../models/Beneficiary.js";
import User from "../models/User.js";
import createNotification from "../utils/createNotification.js";

// ✅ userId compatible req.user.id OU req.userId
const getUserIdOrThrow = (req) => {
  const id = req?.user?.id || req?.userId || req?.user?._id;
  if (!id) throw new Error("Utilisateur non authentifié");
  return id;
};

// ✅ Nom affichable depuis DB
const getUserDisplayName = async (userId) => {
  try {
    const u = await User.findById(userId).select("fullName email phone").lean();
    return u?.fullName || u?.email || u?.phone || "un utilisateur";
  } catch {
    return "un utilisateur";
  }
};

// ✅ Notification safe (ne bloque jamais)
const safeNotify = async ({ userId, title, message, redirectUrl = "/transactions" }) => {
  try {
    await createNotification({
      userId,
      category: "TRANSACTION",
      title,
      message,
      redirectUrl,
    });
  } catch (e) {
    console.error("Erreur notification:", e?.message);
  }
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

    if (!accountId || amount === undefined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "accountId et amount sont obligatoires" });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Montant invalide" });
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

    const finalReference =
      reference || `DEP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    if (!account || account.status?.toUpperCase() !== "ACTIVE") {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Compte introuvable ou inactif" });
    }

    account.balance = Number(account.balance) + amountNum;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: userId,
          type: "DEPOSIT",
          amount: amountNum,
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

    await safeNotify({
      userId,
      title: "Dépôt effectué",
      message: `Un dépôt de ${amountNum} ${currency} a été crédité sur votre compte.`,
    });

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

    if (!accountId || amount === undefined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "accountId et amount sont obligatoires" });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Montant invalide" });
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
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Compte introuvable ou inactif" });
    }

    if (Number(account.balance) < amountNum) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Solde insuffisant" });
    }

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

    await safeNotify({
      userId,
      title: "Retrait effectué",
      message: `Un retrait de ${amountNum} ${currency} a été effectué.`,
    });

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
//  TRANSFERT INTERNE (entre 2 comptes)
// ======================================================
export const transfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);
    const { fromId, toId, amount, currency = "XOF", description } = req.body;

    if (!fromId || !toId || amount === undefined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "fromId, toId et amount sont obligatoires" });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Montant invalide" });
    }

    const fromAccount = await Account.findById(fromId).session(session);
    const toAccount = await Account.findById(toId).session(session);

    if (!fromAccount || !toAccount) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Compte introuvable" });
    }

    if (Number(fromAccount.balance) < amountNum) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    const baseRef = `TRI-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const debitRef = `${baseRef}-D`;
    const creditRef = `${baseRef}-C`;

    fromAccount.balance = Number(fromAccount.balance) - amountNum;
    toAccount.balance = Number(toAccount.balance) + amountNum;

    await fromAccount.save({ session });
    await toAccount.save({ session });

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

    await safeNotify({
      userId,
      title: "Transfert interne réussi",
      message: `Un transfert interne de ${amountNum} ${currency} a été effectué.`,
    });

    return res.json({
      message: "Transfert interne réussi",
      reference: baseRef,
      transactions: [txDebit, txCredit],
      balances: { from: fromAccount.balance, to: toAccount.balance },
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

    const { toUserId, amount, currency = "XOF", idempotencyKey, reference, description } = req.body;

    if (!toUserId || amount === undefined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "toUserId et amount sont obligatoires" });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Montant invalide" });
    }

    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(session);
      if (existing) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ transaction: existing, idempotent: true });
      }
    }

    const fromAcc = await Account.findOne({ user: userId, type: "COURANT" }).session(session);
    if (!fromAcc || fromAcc.status?.toUpperCase() !== "ACTIVE") {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Votre compte courant est introuvable ou inactif" });
    }

    const toAcc = await Account.findOne({ user: toUserId, type: "COURANT", status: "ACTIVE" }).session(session);
    if (!toAcc || toAcc.status?.toUpperCase() !== "ACTIVE") {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Le compte du destinataire est introuvable ou inactif" });
    }

    if (Number(fromAcc.balance) < amountNum) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Solde insuffisant pour effectuer ce transfert" });
    }

    fromAcc.balance = Number(fromAcc.balance) - amountNum;
    toAcc.balance = Number(toAcc.balance) + amountNum;

    await fromAcc.save({ session });
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

    const senderName = await getUserDisplayName(userId);
    const receiverName = await getUserDisplayName(toUserId);

    await safeNotify({
      userId,
      title: "Transfert envoyé",
      message: `Vous avez envoyé ${amountNum} ${currency} à ${receiverName}.`,
    });

    await safeNotify({
      userId: toUserId,
      title: "Transfert reçu",
      message: `Vous avez reçu ${amountNum} ${currency} de ${senderName}.`,
    });

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

    if (!fromAccountId || !beneficiaryId || amount === undefined) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "fromAccountId, beneficiaryId et amount sont obligatoires" });
    }

    // ✅ Anti CastError (si id invalide => pas 500)
    if (!mongoose.Types.ObjectId.isValid(fromAccountId)) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ message: "Compte source introuvable" });
    }
    if (!mongoose.Types.ObjectId.isValid(beneficiaryId)) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({ message: "Bénéficiaire introuvable" });
    }

    const amountNum = Number(amount);
    if (!Number.isFinite(amountNum) || amountNum <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Montant invalide" });
    }

    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(session);
      if (existing) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ transaction: existing, idempotent: true });
      }
    }

    const fromAccount = await Account.findOne({ _id: fromAccountId, user: userId }).session(session);
    if (!fromAccount || fromAccount.status?.toUpperCase?.() !== "ACTIVE") {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Compte source introuvable ou inactif" });
    }

    if (Number(fromAccount.balance) < amountNum) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    const beneficiary = await Beneficiary.findOne({ _id: beneficiaryId, user: userId }).session(session);
    if (!beneficiary) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Bénéficiaire introuvable" });
    }

    // ❌ auto-transfert interdit
    const linkedUserId = beneficiary?.linkedUser?.toString?.();
    if (linkedUserId && linkedUserId === userId.toString()) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Transfert impossible vers votre propre compte" });
    }

    // ====== CAS 1: bénéficiaire interne → on crédite son compte ======
    if (beneficiary.linkedUser) {
      const toAccount = await Account.findOne({
        user: beneficiary.linkedUser,
        status: "ACTIVE",
      }).session(session);

      if (!toAccount) {
        await session.abortTransaction();
        session.endSession();
        return res.status(404).json({ message: "Le bénéficiaire n'a pas de compte actif pour recevoir le transfert" });
      }

      fromAccount.balance = Number(fromAccount.balance) - amountNum;
      toAccount.balance = Number(toAccount.balance) + amountNum;

      await fromAccount.save({ session });
      await toAccount.save({ session });

      const [txDebit] = await Transaction.create([{
        user: userId,
        type: "TRANSFER_INTERNAL_DEBIT",
        amount: amountNum,
        currency,
        fromAccount: fromAccount._id,
        toAccount: toAccount._id,
        beneficiary: beneficiary._id,
        idempotencyKey,
        reference,
        description,
        status: "SUCCESS",
      }], { session });

      const [txCredit] = await Transaction.create([{
        user: beneficiary.linkedUser,
        type: "TRANSFER_INTERNAL_CREDIT",
        amount: amountNum,
        currency,
        fromAccount: fromAccount._id,
        toAccount: toAccount._id,
        beneficiary: beneficiary._id,
        reference,
        description,
        status: "SUCCESS",
      }], { session });

      await session.commitTransaction();
      session.endSession();

      // ✅ Notifications succès (émetteur + destinataire)
      const senderName = await getUserDisplayName(userId);
      const receiverName = await getUserDisplayName(beneficiary.linkedUser);
      const beneficiaryName = beneficiary.name || beneficiary.fullName || beneficiary.label || receiverName || "le bénéficiaire";

      await safeNotify({
        userId,
        title: "Transfert effectué",
        message: `Vous avez transféré ${amountNum} ${currency} à ${beneficiaryName}.`,
      });

      await safeNotify({
        userId: beneficiary.linkedUser,
        title: "Transfert reçu",
        message: `Vous avez reçu ${amountNum} ${currency} de ${senderName}.`,
      });

      return res.json({
        message: "Transfert effectué avec succès",
        transaction: txDebit,
        receiverTransaction: txCredit,
        balanceAfter: fromAccount.balance,
      });
    }

    // ====== CAS 2: bénéficiaire externe ======
    fromAccount.balance = Number(fromAccount.balance) - amountNum;
    await fromAccount.save({ session });

    const [tx] = await Transaction.create([{
      user: userId,
      type: "TRANSFER_EXTERNAL",
      amount: amountNum,
      currency,
      fromAccount: fromAccount._id,
      toAccount: null,
      beneficiary: beneficiary._id,
      idempotencyKey,
      reference,
      description,
      status: "SUCCESS",
    }], { session });

    await session.commitTransaction();
    session.endSession();

    const beneficiaryName = beneficiary.name || beneficiary.fullName || beneficiary.label || "le bénéficiaire";
    await safeNotify({
      userId,
      title: "Transfert externe effectué",
      message: `Vous avez envoyé ${amountNum} ${currency} à ${beneficiaryName}.`,
    });

    return res.json({
      message: "Transfert externe enregistré avec succès",
      transaction: tx,
      balanceAfter: fromAccount.balance,
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
    { code: "EAU", name: "Facture d'eau" },
    { code: "ELECTRICITE", name: "Facture d'électricité" },
    { code: "MOBILE", name: "Recharge mobile" },
    { code: "INTERNET", name: "Facture Internet" },
  ];
  return res.json({ services });
};

// ----------------------------
//     PAYEMENT FACTURE
// ----------------------------
export const payBill = async (req, res) => {
  try {
    const userId = req?.user?.id || req?.userId;

    const { amount, serviceName } = req.body;

    if (!userId) return res.status(401).json({ message: "Utilisateur non authentifié" });
    if (!amount || Number(amount) <= 0) return res.status(400).json({ message: "Montant invalide" });
    if (!serviceName) return res.status(400).json({ message: "Service requis" });

    const amountNum = Number(amount);

    const account = await Account.findOne({ user: userId, type: "COURANT" });
    if (!account) return res.status(404).json({ message: "Compte courant introuvable" });

    if (Number(account.balance) < amountNum) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    account.balance = Number(account.balance) - amountNum;
    await account.save();

    const transaction = await Transaction.create({
      user: userId,
      account: account._id,
      type: "BILL_PAYMENT",
      amount: amountNum,
      serviceName,
      status: "SUCCESS",
    });

    await safeNotify({
      userId,
      title: "Facture payée",
      message: `Paiement ${serviceName} de ${amountNum} XOF effectué avec succès.`,
    });

    res.json({ message: "Paiement effectué avec succès", transaction });
  } catch (err) {
    console.error("❌ BILL PAYMENT ERROR:", err);
    res.status(500).json({ message: "Erreur interne lors du paiement" });
  }
};
