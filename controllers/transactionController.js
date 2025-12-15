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

// POST /api/transactions/deposit
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

    // Idempotence
    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(
        session
      );
      if (existing) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ transaction: existing, idempotent: true });
      }
    }

    const account = await Account.findById(accountId).session(session);
    // Génération automatique de référence unique si non fournie
    let finalReference = reference;
    if (!finalReference) {
    const prefix = "DEP"; // DEP pour DEPOSIT
    finalReference = `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
}

    console.log("Compte trouvé pour deposit :", account);

    if (!account || account.status?.toUpperCase() !== "ACTIVE") {
      throw new Error("Compte introuvable ou inactif");
    }

    //(Optionnel mais recommandé : vérifier que le compte appartient bien au user connecté)
    if (account.user.toString() !== userId) {
      throw new Error("Vous n'êtes pas propriétaire de ce compte");
    }

    account.balance += amount;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: userId,
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
    console.error("Erreur dépôt :", error);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};

// POST /api/transactions/withdraw
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

    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(
        session
      );
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

    if (account.balance < amount) {
      throw new Error("Solde insuffisant");
    }

    account.balance -= amount;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: userId,
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
    console.error("Erreur retrait :", error);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};

// POST /api/transactions/transfer (interne entre comptes)
// POST /api/transactions/transfer
const MIN_TRANSFER_AMOUNT = 100;
const MAX_TRANSFER_PER_TX = 2000000;
const MAX_TRANSFER_PER_DAY = 5000000;

export const transfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);

    const { fromId, toId, amount, currency = "XOF", description, idempotencyKey } = req.body;

    // 1) Validation
    if (!fromId || !toId || amount === undefined) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "fromId, toId et amount sont obligatoires" });
    }

    if (fromId === toId) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Le compte source et destination doivent être différents" });
    }

    const numericAmount = Number(amount);
    if (Number.isNaN(numericAmount) || numericAmount <= 0) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Montant invalide" });
    }

    if (numericAmount < MIN_TRANSFER_AMOUNT) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: `Montant minimum: ${MIN_TRANSFER_AMOUNT} XOF` });
    }

    if (numericAmount > MAX_TRANSFER_PER_TX) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: `Montant maximum: ${MAX_TRANSFER_PER_TX.toLocaleString()} XOF` });
    }

    // 2) Idempotence (optionnel)
    if (idempotencyKey) {
      const existing = await Transaction.findOne({
        user: userId,
        idempotencyKey,
        type: "TRANSFER_INTERNAL_DEBIT",
        status: "SUCCESS",
      }).session(session);

      if (existing) {
        await session.abortTransaction(); session.endSession();
        return res.json({ message: "Transfert déjà traité", idempotent: true });
      }
    }

    // 3) Sécurité : comptes du user connecté seulement
    const accounts = await Account.find({
      _id: { $in: [fromId, toId] },
      user: userId,
    }).session(session);

    if (accounts.length !== 2) {
      await session.abortTransaction(); session.endSession();
      return res.status(404).json({
        message: "Un ou plusieurs comptes sont introuvables ou n'appartiennent pas à l'utilisateur",
      });
    }

    const fromAccount = accounts.find((a) => a._id.toString() === fromId);
    const toAccount = accounts.find((a) => a._id.toString() === toId);

    // 4) Statuts
    if (fromAccount.status !== "ACTIVE") {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Le compte source n'est pas actif" });
    }

    if (toAccount.status !== "ACTIVE") {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Le compte destination n'est pas actif" });
    }

    // 5) Solde suffisant
    if (fromAccount.balance < numericAmount) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({ message: "Solde insuffisant" });
    }

    // 6) Limite journalière (sur les débits internes)
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const dailyAgg = await Transaction.aggregate([
      {
        $match: {
          user: new mongoose.Types.ObjectId(userId),
          type: "TRANSFER_INTERNAL_DEBIT",
          createdAt: { $gte: startOfDay, $lte: endOfDay },
          fromAccount: fromAccount._id,
          status: "SUCCESS",
        },
      },
      { $group: { _id: null, total: { $sum: "$amount" } } },
    ]);

    const alreadyToday = dailyAgg[0]?.total || 0;

    if (alreadyToday + numericAmount > MAX_TRANSFER_PER_DAY) {
      await session.abortTransaction(); session.endSession();
      return res.status(400).json({
        message: `Limite journalière dépassée. Déjà transféré: ${alreadyToday.toLocaleString()} XOF aujourd'hui`,
      });
    }

    // 7) Mise à jour soldes
    fromAccount.balance -= numericAmount;
    toAccount.balance += numericAmount;

    await fromAccount.save({ session });
    await toAccount.save({ session });

    // 8) Références + transactions débit/crédit
    const operationRef = `TRI-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    const debitRef = `${operationRef}-D`;
    const creditRef = `${operationRef}-C`;

    const [txDebit] = await Transaction.create(
      [
        {
          user: userId,
          type: "TRANSFER_INTERNAL_DEBIT",
          amount: numericAmount,
          currency,
          fromAccount: fromAccount._id,
          toAccount: toAccount._id,
          reference: debitRef,
          description: description || "Transfert interne (débit)",
          status: "SUCCESS",
          idempotencyKey,
        },
      ],
      { session }
    );

    const [txCredit] = await Transaction.create(
      [
        {
          user: userId,
          type: "TRANSFER_INTERNAL_CREDIT",
          amount: numericAmount,
          currency,
          fromAccount: fromAccount._id,
          toAccount: toAccount._id,
          reference: creditRef,
          description: description || "Transfert interne (crédit)",
          status: "SUCCESS",
          idempotencyKey,
        },
      ],
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    return res.json({
      message: "Transfert interne réussi",
      reference: operationRef,
      transactions: { debit: txDebit, credit: txCredit },
      balances: { from: fromAccount.balance, to: toAccount.balance },
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Erreur transfert :", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};



// POST /api/transactions/transfer/user (transfert entre utilisateurs)
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

    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(
        session
      );
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
          user: userId,
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
          user: toUserId,
          type: "TRANSFER_USER_CREDIT",
          amount,
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
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};

// GET /api/transactions
export const getTransactions = async (req, res) => {
  try {
    const userId = getUserIdOrThrow(req);

    const transactions = await Transaction.find({ user: userId })
      .sort({ createdAt: -1 })
      .populate("fromAccount toAccount relatedUser beneficiary");

    return res.json({ transactions });
  } catch (error) {
    console.error("Erreur getTransactions :", error);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};

// POST /api/transactions/transfer/beneficiary
// controllers/transactionController.js (fonction transferToBeneficiary)

// import { getUserIdOrThrow } from "../utils/getUserIdOrThrow.js"; // adapte si ton helper est ailleurs

// controllers/transactionController.js (exemple)
// import mongoose from "mongoose";
// import Account from "../models/Account.js";
// import Beneficiary from "../models/Beneficiary.js";
// import Transaction from "../models/Transaction.js";
// import { getUserIdOrThrow } from "../utils/getUserIdOrThrow.js";

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

    // ✅ validations
    if (!fromAccountId || !beneficiaryId || amount === undefined || amount === null) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "fromAccountId, beneficiaryId et amount sont obligatoires",
      });
    }

    const amt = Number(amount);
    if (Number.isNaN(amt) || amt <= 0) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({ message: "Montant invalide" });
    }

    // ✅ idempotency (si déjà traité => renvoyer)
    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(session);
      if (existing) {
        await session.abortTransaction();
        session.endSession();
        return res.json({ transaction: existing, idempotent: true });
      }
    }

    // ✅ compte source (doit appartenir au user)
    const fromAccount = await Account.findOne({
      _id: fromAccountId,
      user: userId,
    }).session(session);

    if (!fromAccount || String(fromAccount.status || "").toUpperCase() !== "ACTIVE") {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Compte source introuvable ou inactif" });
    }

    if (fromAccount.balance < amt) {
      await session.abortTransaction();
      session.endSession();
      return res.status(409).json({ message: "Solde insuffisant" });
    }

    // ✅ bénéficiaire (appartient au user)
    const beneficiary = await Beneficiary.findOne({
      _id: beneficiaryId,
      user: userId,
    }).session(session);

    if (!beneficiary) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Bénéficiaire introuvable" });
    }

    // ✅ Règle: UNIQUEMENT bénéficiaire interne existant
    if (beneficiary.type !== "INTERNAL" || !beneficiary.linkedUser) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Transfert refusé : bénéficiaire externe ou non existant dans la base",
      });
    }

    // ✅ compte destination (compte courant du bénéficiaire)
    const toAccount = await Account.findOne({
      user: beneficiary.linkedUser,
      type: "COURANT",
      status: "ACTIVE",
    }).session(session);

    if (!toAccount) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ message: "Compte courant du bénéficiaire introuvable ou inactif" });
    }

    // ✅ mise à jour des soldes
    fromAccount.balance -= amt;
    await fromAccount.save({ session });

    toAccount.balance += amt;
    await toAccount.save({ session });

    // ✅ double écriture comptable selon TON enum
    const [txDebit] = await Transaction.create(
      [
        {
          user: userId,
          type: "TRANSFER_INTERNAL_DEBIT",
          amount: amt,
          currency,
          fromAccount: fromAccount._id,
          toAccount: toAccount._id,
          beneficiary: beneficiary._id,
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
          user: beneficiary.linkedUser,
          type: "TRANSFER_INTERNAL_CREDIT",
          amount: amt,
          currency,
          fromAccount: fromAccount._id,
          toAccount: toAccount._id,
          beneficiary: beneficiary._id,
          // ⚠️ idempotencyKey uniquement sur le débit (souvent suffisant)
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
      message: "Transfert interne vers bénéficiaire effectué avec succès",
      transaction: {
        debit: txDebit,
        credit: txCredit,
      },
      balanceAfter: fromAccount.balance,
      creditedToAccountId: toAccount._id,
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();

    console.error("Erreur transferToBeneficiary :", error);

    const msg = error?.message || "Erreur serveur";
    const status =
      msg.toLowerCase().includes("obligatoires") || msg.toLowerCase().includes("invalide")
        ? 400
        : 500;

    return res.status(status).json({
      message: status === 500 ? "Erreur serveur" : msg,
      error: msg,
    });
  }
};



//// GET /api/transactions/services
export const getPaymentServices = async (req, res) => {
  const services = [
    { code: "EAU",          name: "Facture d'eau" },
    { code: "ELECTRICITE",  name: "Facture d'électricité" },
    { code: "MOBILE",       name: "Recharge mobile" },
    { code: "INTERNET",     name: "Facture Internet" },
  ];

  return res.json({ services });
};


// POST /api/transactions/bill-payment
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
    //🔐 Vérification : seulement les services autorisés

    const ALLOWED_SERVICES = ["EAU", "ELECTRICITE", "MOBILE", "INTERNET"];

    if (!ALLOWED_SERVICES.includes(serviceCode)) {
     return res.status(400).json({
      message: "serviceCode invalide. Services autorisés : EAU, ELECTRICITE, MOBILE, INTERNET",
    });
    }
    

    if (idempotencyKey) {
      const existing = await Transaction.findOne({ idempotencyKey }).session(
        session
      );
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

    if (account.balance < amount) {
      throw new Error("Solde insuffisant");
    }

    account.balance -= amount;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: userId,
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
    console.error("Erreur payBill :", error);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};
