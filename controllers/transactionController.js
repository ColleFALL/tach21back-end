// // controllers/transactionController.js
// import mongoose from "mongoose";
// import Account from "../models/Account.js";
// import Transaction from "../models/Transaction.js";
// import Beneficiary from "../models/Beneficiary.js";
// import User from "../models/User.js"; // 🆕 NEW
// import createNotification from "../utils/createNotification.js";

// // Petit helper pour récupérer userId proprement
// const getUserIdOrThrow = (req) => {
//   if (!req.user || !req.user.id) {
//     throw new Error("Utilisateur non authentifié (req.user manquant)");
//   }
//   return req.user.id;
// };

// // 🆕 NEW — détecter erreurs “métier” (à renvoyer en 400)
// const isBusinessError = (msg = "") => {
//   const m = String(msg).toLowerCase();
//   return (
//     m.includes("solde insuffisant") ||
//     m.includes("montant invalide") ||
//     m.includes("introuvable") ||
//     m.includes("inactif") ||
//     m.includes("refusé") ||
//     m.includes("obligatoires") ||
//     m.includes("bénéficiaire") ||
//     m.includes("destination") ||
//     m.includes("source") ||
//     m.includes("servicecode invalide")
//   );
// };

// // 🆕 NEW — récupérer un nom d’utilisateur fiable (sans dépendre du middleware)
// const getUserDisplayName = async (userId) => {
//   const u = await User.findById(userId).select("fullName email").lean();
//   return u?.fullName || u?.email || "un utilisateur";
// };

// // 🆕 NEW — helper: notifier + renvoyer une erreur métier propre
// const notifyAndReturnBusinessError = async (req, res, { title, message }) => {
//   try {
//     if (req?.user?.id) {
//       await createNotification({
//         userId: req.user.id,
//         category: "TRANSACTION",
//         title,
//         message,
//         redirectUrl: "/transactions",
//       });
//     }
//   } catch (e) {
//     console.error("Erreur notification (business):", e?.message);
//   }
//   return res.status(400).json({ message });
// };

// // ----------------------------
// //     DÉPÔT
// // ----------------------------
// export const deposit = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const userId = getUserIdOrThrow(req);

//     const {
//       accountId,
//       amount,
//       currency = "XOF",
//       idempotencyKey,
//       reference,
//       description,
//     } = req.body;

//     if (!accountId || !amount) {
//       throw new Error("accountId et amount sont obligatoires");
//     }

//     const amountNum = Number(amount);
//     if (isNaN(amountNum) || amountNum <= 0) {
//       throw new Error("Montant invalide");
//     }

//     // Idempotence
//     if (idempotencyKey) {
//       const existing = await Transaction.findOne({ idempotencyKey }).session(session);
//       if (existing) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.json({ transaction: existing, idempotent: true });
//       }
//     }

//     const account = await Account.findById(accountId).session(session);

//     // Génération référence si manquante
//     let finalReference = reference;
//     if (!finalReference) {
//       finalReference = `DEP-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
//     }

//     if (!account || String(account.status || "").toUpperCase() !== "ACTIVE") {
//       throw new Error("Compte introuvable ou inactif");
//     }

//     account.balance = Number(account.balance) + amountNum;
//     await account.save({ session });

//     const [tx] = await Transaction.create(
//       [
//         {
//           user: userId,
//           type: "DEPOSIT",
//           amount: amountNum,
//           currency,
//           fromAccount: null,
//           toAccount: account._id,
//           idempotencyKey,
//           reference: finalReference,
//           description,
//           status: "SUCCESS",
//         },
//       ],
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     // ✅ Notification succès
//     await createNotification({
//       userId,
//       category: "TRANSACTION",
//       title: "Dépôt effectué",
//       message: `Un dépôt de ${amountNum} ${currency} a été crédité sur votre compte.`,
//       redirectUrl: "/transactions",
//     });

//     return res.json({
//       message: "Dépôt effectué avec succès",
//       transaction: tx,
//       balanceAfter: account.balance,
//     });
//   } catch (error) {
//     await session.abortTransaction().catch(() => {});
//     session.endSession();
//     console.error("Erreur dépôt :", error);

//     if (isBusinessError(error.message)) {
//       return notifyAndReturnBusinessError(req, res, {
//         title: "Dépôt refusé",
//         message: error.message,
//       });
//     }

//     return res.status(500).json({ message: "Erreur serveur", error: error.message });
//   }
// };

// // ----------------------------
// //     RETRAIT
// // ----------------------------
// export const withdraw = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const userId = getUserIdOrThrow(req);

//     const {
//       accountId,
//       amount,
//       currency = "XOF",
//       idempotencyKey,
//       reference,
//       description,
//     } = req.body;

//     if (!accountId || !amount) {
//       throw new Error("accountId et amount sont obligatoires");
//     }

//     const amountNum = Number(amount);
//     if (isNaN(amountNum) || amountNum <= 0) {
//       throw new Error("Montant invalide");
//     }

//     if (idempotencyKey) {
//       const existing = await Transaction.findOne({ idempotencyKey }).session(session);
//       if (existing) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.json({ transaction: existing, idempotent: true });
//       }
//     }

//     const account = await Account.findById(accountId).session(session);
//     if (!account || String(account.status || "").toUpperCase() !== "ACTIVE") {
//       throw new Error("Compte introuvable ou inactif");
//     }

//     if (Number(account.balance) < amountNum) {
//       throw new Error("Solde insuffisant");
//     }

//     account.balance = Number(account.balance) - amountNum;
//     await account.save({ session });

//     const [tx] = await Transaction.create(
//       [
//         {
//           user: userId,
//           type: "WITHDRAWAL",
//           amount: amountNum,
//           currency,
//           fromAccount: account._id,
//           toAccount: null,
//           idempotencyKey,
//           reference,
//           description,
//           status: "SUCCESS",
//         },
//       ],
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     // ✅ Notification succès
//     await createNotification({
//       userId,
//       category: "TRANSACTION",
//       title: "Retrait effectué",
//       message: `Un retrait de ${amountNum} ${currency} a été effectué.`,
//       redirectUrl: "/transactions",
//     });

//     return res.json({
//       message: "Retrait effectué avec succès",
//       transaction: tx,
//       balanceAfter: account.balance,
//     });
//   } catch (error) {
//     await session.abortTransaction().catch(() => {});
//     session.endSession();
//     console.error("Erreur retrait :", error);

//     if (isBusinessError(error.message)) {
//       return notifyAndReturnBusinessError(req, res, {
//         title: "Retrait refusé",
//         message: error.message,
//       });
//     }

//     return res.status(500).json({ message: "Erreur serveur", error: error.message });
//   }
// };

// // ======================================================
// //  TRANSFERT INTERNE (entre comptes du même user)
// // ======================================================
// export const transfer = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const userId = getUserIdOrThrow(req);
//     const { fromId, toId, amount, currency = "XOF", description } = req.body;

//     if (!fromId || !toId || amount === undefined) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ message: "fromId, toId et amount sont obligatoires" });
//     }

//     const amountNum = Number(amount);
//     if (isNaN(amountNum) || amountNum <= 0) {
//       throw new Error("Montant invalide");
//     }

//     const fromAccount = await Account.findById(fromId).session(session);
//     const toAccount = await Account.findById(toId).session(session);

//     // ✅ FIX: accounts n'existait pas
//     if (!fromAccount || !toAccount) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({ message: "Compte source ou destination introuvable" });
//     }

//     if (String(fromAccount.status || "").toUpperCase() !== "ACTIVE") {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ message: "Le compte source n'est pas actif" });
//     }

//     if (String(toAccount.status || "").toUpperCase() !== "ACTIVE") {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({ message: "Le compte destination n'est pas actif" });
//     }

//     if (Number(fromAccount.balance) < amountNum) {
//       throw new Error("Solde insuffisant");
//     }

//     const baseRef = `TRI-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
//     const debitRef = `${baseRef}-D`;
//     const creditRef = `${baseRef}-C`;

//     fromAccount.balance = Number(fromAccount.balance) - amountNum;
//     toAccount.balance = Number(toAccount.balance) + amountNum;

//     await fromAccount.save({ session });
//     await toAccount.save({ session });

//     const [txDebit] = await Transaction.create(
//       [
//         {
//           user: userId,
//           type: "TRANSFER_INTERNAL_DEBIT",
//           amount: amountNum,
//           currency,
//           fromAccount: fromAccount._id,
//           toAccount: toAccount._id,
//           reference: debitRef,
//           description: description || "Transfert interne (débit)",
//           status: "SUCCESS",
//         },
//       ],
//       { session }
//     );

//     const [txCredit] = await Transaction.create(
//       [
//         {
//           user: userId,
//           type: "TRANSFER_INTERNAL_CREDIT",
//           amount: amountNum,
//           currency,
//           fromAccount: fromAccount._id,
//           toAccount: toAccount._id,
//           reference: creditRef,
//           description: description || "Transfert interne (crédit)",
//           status: "SUCCESS",
//         },
//       ],
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     // ✅ Notification succès (interne = pas de nom tiers)
//     await createNotification({
//       userId,
//       category: "TRANSACTION",
//       title: "Transfert interne réussi",
//       message: `Un transfert interne de ${amountNum} ${currency} a été effectué.`,
//       redirectUrl: "/transactions",
//     });

//     return res.json({
//       message: "Transfert interne réussi",
//       reference: baseRef,
//       transactions: [txDebit, txCredit],
//       balances: {
//         from: fromAccount.balance,
//         to: toAccount.balance,
//       },
//     });
//   } catch (error) {
//     await session.abortTransaction().catch(() => {});
//     session.endSession();
//     console.error("Erreur transfert :", error);

//     if (isBusinessError(error.message)) {
//       return notifyAndReturnBusinessError(req, res, {
//         title: "Transfert interne refusé",
//         message: error.message,
//       });
//     }

//     return res.status(500).json({ message: "Erreur serveur", error: error.message });
//   }
// };

// // ----------------------------
// //     TRANSFERT USER → USER
// // ----------------------------
// export const transferUser = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const userId = getUserIdOrThrow(req);

//     const {
//       toUserId,
//       amount,
//       currency = "XOF",
//       idempotencyKey,
//       reference,
//       description,
//     } = req.body;

//     if (!toUserId || !amount) {
//       throw new Error("toUserId et amount sont obligatoires");
//     }

//     const amountNum = Number(amount);
//     if (isNaN(amountNum) || amountNum <= 0) {
//       throw new Error("Montant invalide");
//     }

//     if (idempotencyKey) {
//       const existing = await Transaction.findOne({ idempotencyKey }).session(session);
//       if (existing) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.json({ transaction: existing, idempotent: true });
//       }
//     }

//     const fromAcc = await Account.findOne({ user: userId, type: "COURANT" }).session(session);
//     if (!fromAcc || String(fromAcc.status || "").toUpperCase() !== "ACTIVE") {
//       throw new Error("Votre compte courant est introuvable ou inactif");
//     }

//     const toAcc = await Account.findOne({
//       user: toUserId,
//       type: "COURANT",
//       status: "ACTIVE",
//     }).session(session);

//     if (!toAcc || String(toAcc.status || "").toUpperCase() !== "ACTIVE") {
//       throw new Error("Le compte du destinataire est introuvable ou inactif");
//     }

//     if (Number(fromAcc.balance) < amountNum) {
//       throw new Error("Solde insuffisant pour effectuer ce transfert");
//     }

//     fromAcc.balance = Number(fromAcc.balance) - amountNum;
//     await fromAcc.save({ session });

//     toAcc.balance = Number(toAcc.balance) + amountNum;
//     await toAcc.save({ session });

//     const [debitTx] = await Transaction.create(
//       [
//         {
//           user: userId,
//           type: "TRANSFER_USER_DEBIT",
//           amount: amountNum,
//           currency,
//           fromAccount: fromAcc._id,
//           toAccount: toAcc._id,
//           relatedUser: toUserId,
//           idempotencyKey,
//           reference,
//           description,
//           status: "SUCCESS",
//         },
//       ],
//       { session }
//     );

//     const [creditTx] = await Transaction.create(
//       [
//         {
//           user: toUserId,
//           type: "TRANSFER_USER_CREDIT",
//           amount: amountNum,
//           currency,
//           fromAccount: fromAcc._id,
//           toAccount: toAcc._id,
//           relatedUser: userId,
//           idempotencyKey,
//           reference,
//           description,
//           status: "SUCCESS",
//         },
//       ],
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     // 🆕 NOMS (DB) : expéditeur + destinataire
//     const senderName = await getUserDisplayName(userId);
//     const receiverName = await getUserDisplayName(toUserId);

//     // ✅ Notification succès (émetteur)
//     await createNotification({
//       userId,
//       category: "TRANSACTION",
//       title: "Transfert envoyé",
//       message: `Vous avez envoyé ${amountNum} ${currency} à ${receiverName}.`,
//       redirectUrl: "/transactions",
//     });

//     // ✅ Notification succès (destinataire)
//     await createNotification({
//       userId: toUserId,
//       category: "TRANSACTION",
//       title: "Transfert reçu",
//       message: `Vous avez reçu ${amountNum} ${currency} de ${senderName}.`,
//       redirectUrl: "/transactions",
//     });

//     return res.json({
//       message: "Transfert utilisateur effectué avec succès",
//       debit: debitTx,
//       credit: creditTx,
//       balanceAfter: fromAcc.balance,
//     });
//   } catch (error) {
//     await session.abortTransaction().catch(() => {});
//     session.endSession();
//     console.error("Erreur transferUser :", error);

//     if (isBusinessError(error.message)) {
//       return notifyAndReturnBusinessError(req, res, {
//         title: "Transfert refusé",
//         message: error.message,
//       });
//     }

//     return res.status(500).json({ message: "Erreur serveur", error: error.message });
//   }
// };

// // ----------------------------
// //     HISTORIQUE
// // ----------------------------
// export const getTransactions = async (req, res) => {
//   try {
//     const userId = getUserIdOrThrow(req);

//     const transactions = await Transaction.find({ user: userId })
//       .sort({ createdAt: -1 })
//       .populate("fromAccount toAccount relatedUser beneficiary");

//     return res.json({ transactions });
//   } catch (error) {
//     console.error("Erreur getTransactions :", error);
//     return res.status(500).json({ message: "Erreur serveur", error: error.message });
//   }
// };

// // ----------------------------
// //     TRANSFERT → BENEFICIAIRE
// // ----------------------------
// export const transferToBeneficiary = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const userId = getUserIdOrThrow(req);

//     const {
//       fromAccountId,
//       beneficiaryId,
//       amount,
//       currency = "XOF",
//       idempotencyKey,
//       reference,
//       description,
//     } = req.body;

//     if (!fromAccountId || !beneficiaryId || !amount) {
//       throw new Error("fromAccountId, beneficiaryId et amount sont obligatoires");
//     }

//     const amountNum = Number(amount);
//     if (isNaN(amountNum) || amountNum <= 0) {
//       throw new Error("Montant invalide");
//     }

//     // Idempotency
//     if (idempotencyKey) {
//       const existing = await Transaction.findOne({ idempotencyKey }).session(session);
//       if (existing) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.json({ transaction: existing, idempotent: true });
//       }
//     }

//     const fromAccount = await Account.findOne({
//       _id: fromAccountId,
//       user: userId,
//     }).session(session);

//     if (!fromAccount || String(fromAccount.status || "").toUpperCase() !== "ACTIVE") {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({ message: "Compte source introuvable ou inactif" });
//     }

//     if (Number(fromAccount.balance) < amountNum) {
//       throw new Error("Solde insuffisant");
//     }

//     const beneficiary = await Beneficiary.findOne({
//       _id: beneficiaryId,
//       user: userId,
//     }).session(session);

//     if (!beneficiary) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(404).json({ message: "Bénéficiaire introuvable" });
//     }

//     if (beneficiary.type !== "INTERNAL" || !beneficiary.linkedUser) {
//       await session.abortTransaction();
//       session.endSession();
//       return res.status(400).json({
//         message: "Transfert refusé : bénéficiaire externe ou non existant dans la base",
//       });
//     }

//     const toAccount = await Account.findOne({
//       user: beneficiary.linkedUser,
//       type: "COURANT",
//       status: "ACTIVE",
//     }).session(session);

//     if (!toAccount) {
//       await session.abortTransaction();
//       session.endSession();
//       return res
//         .status(404)
//         .json({ message: "Compte courant du bénéficiaire introuvable ou inactif" });
//     }

//     fromAccount.balance = Number(fromAccount.balance) - amountNum;
//     await fromAccount.save({ session });

//     const [txDebit] = await Transaction.create(
//       [
//         {
//           user: userId,
//           type: "TRANSFER_EXTERNAL",
//           amount: amountNum,
//           currency,
//           fromAccount: fromAccount._id,
//           toAccount: toAccount._id,
//           beneficiary: beneficiary._id,
//           idempotencyKey,
//           reference,
//           description,
//           status: "SUCCESS",
//         },
//       ],
//       { session }
//     );

//     const [txCredit] = await Transaction.create(
//       [
//         {
//           user: beneficiary.linkedUser,
//           type: "TRANSFER_INTERNAL_CREDIT",
//           amount: amountNum,
//           currency,
//           fromAccount: fromAccount._id,
//           toAccount: toAccount._id,
//           beneficiary: beneficiary._id,
//           reference,
//           description,
//           status: "SUCCESS",
//         },
//       ],
//       { session }
//     );

//     await session.commitTransaction();
//     session.endSession();

//     // 🆕 NOMS
//     const senderName = await getUserDisplayName(userId);
//     const receiverName = await getUserDisplayName(beneficiary.linkedUser);
//     const beneficiaryName =
//       beneficiary.name || beneficiary.fullName || beneficiary.label || receiverName || "le bénéficiaire";

//     // ✅ Notification succès (émetteur) avec NOM BENEFICIAIRE
//     await createNotification({
//       userId,
//       category: "TRANSACTION",
//       title: "Transfert effectué",
//       message: `Vous avez transféré ${amountNum} ${currency} à ${beneficiaryName}.`,
//       redirectUrl: "/transactions",
//     });

//     // ✅ Notification succès (destinataire) avec NOM EXPEDITEUR
//     await createNotification({
//       userId: beneficiary.linkedUser,
//       category: "TRANSACTION",
//       title: "Transfert reçu",
//       message: `Vous avez reçu ${amountNum} ${currency} de ${senderName}.`,
//       redirectUrl: "/transactions",
//     });

//     return res.json({
//       message: "Transfert interne vers bénéficiaire effectué avec succès",
//       transaction: { debit: txDebit, credit: txCredit },
//       balanceAfter: fromAccount.balance,
//       creditedToAccountId: toAccount._id,
//     });
//   } catch (error) {
//     await session.abortTransaction().catch(() => {});
//     session.endSession();

//     console.error("Erreur transferToBeneficiary :", error);

//     if (isBusinessError(error.message)) {
//       return notifyAndReturnBusinessError(req, res, {
//         title: "Transfert refusé",
//         message: error.message,
//       });
//     }

//     return res.status(500).json({ message: "Erreur serveur", error: error.message });
//   }
// };

// // ----------------------------
// //     LISTE SERVICES
// // ----------------------------
// export const getPaymentServices = async (req, res) => {
//   const services = [
//     { code: "EAU", name: "Facture d'eau" },
//     { code: "ELECTRICITE", name: "Facture d'électricité" },
//     { code: "MOBILE", name: "Recharge mobile" },
//     { code: "INTERNET", name: "Facture Internet" },
//   ];
//   return res.json({ services });
// };

// // ----------------------------
// //     PAYEMENT FACTURE
// // ----------------------------
// export const payBill = async (req, res) => {
//   try {
//     const userId = req.user?.id; // fourni par authMiddleware
//     const { amount, serviceName } = req.body;

//     if (!userId) {
//       return res.status(401).json({ message: "Utilisateur non authentifié" });
//     }

//     if (!amount || amount <= 0) {
//       return res.status(400).json({ message: "Montant invalide" });
//     }

//     if (!serviceName) {
//       return res.status(400).json({ message: "Service requis" });
//     }

//     const account = await Account.findOne({ user: userId, type: "COURANT" });
//     if (!account) {
//       return res.status(404).json({ message: "Compte courant introuvable" });
//     }

//     if (account.balance < amount) {
//       return res.status(400).json({ message: "Solde insuffisant" });
//     }

//     // Débit
//     account.balance -= amount;
//     await account.save();

//     const transaction = await Transaction.create({
//       user: userId,
//       account: account._id,
//       type: "BILL_PAYMENT",
//       amount,
//       serviceName,
//       status: "SUCCESS",
//     });
//     // 🆕 Nom service payé (serviceName sinon serviceCode)
//     const paidService = serviceName || serviceCode;

//     await createNotification({
//       userId,
//       category: "TRANSACTION",
//       title: "Facture payée",
//       message: `Paiement ${paidService} de ${amountNum} ${currency} effectué (Facture: ${billNumber}).`,
//       redirectUrl: "/transactions",
//     });

//     res.json({
//       message: "Paiement effectué avec succès",
//       transaction,
//     });

//   } catch (err) {
//     console.error("❌ BILL PAYMENT ERROR:", err);
//     res.status(500).json({ message: "Erreur interne lors du paiement" });
//   }
// };


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
  try {
    const userId = req.user?.id; // fourni par authMiddleware
    const { amount, serviceName } = req.body;

    if (!userId) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Montant invalide" });
    }

    if (!serviceName) {
      return res.status(400).json({ message: "Service requis" });
    }

    const account = await Account.findOne({ user: userId, type: "COURANT" });
    if (!account) {
      return res.status(404).json({ message: "Compte courant introuvable" });
    }

    if (account.balance < amount) {
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    // Débit
    account.balance -= amount;
    await account.save();

    const transaction = await Transaction.create({
      user: userId,
      account: account._id,
      type: "BILL_PAYMENT",
      amount,
      serviceName,
      status: "SUCCESS",
    });

    res.json({
      message: "Paiement effectué avec succès",
      transaction,
    });

  } catch (err) {
    console.error("❌ BILL PAYMENT ERROR:", err);
    res.status(500).json({ message: "Erreur interne lors du paiement" });
  }
};