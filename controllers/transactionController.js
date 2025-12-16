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

    // (Optionnel mais recommandé : vérifier que le compte appartient bien au user connecté)
    // if (account.user.toString() !== userId) {
    //   throw new Error("Vous n'êtes pas propriétaire de ce compte");
    // }

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
export const transfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);

    const { fromId, toId, amount, currency = "XOF", description } = req.body;

    if (!fromId || !toId || !amount) {
      throw new Error("fromId, toId et amount sont obligatoires");
    }

    const fromAccount = await Account.findById(fromId).session(session);
    const toAccount = await Account.findById(toId).session(session);

    if (!fromAccount || !toAccount) {
      throw new Error("Compte introuvable");
    }

    if (fromAccount.balance < amount) {
      throw new Error("Solde insuffisant");
    }

    // 📌 Génération référence unique
    const finalReference = `TRI-${Date.now()}-${Math.floor(Math.random() * 10000)}`;

    // 📌 🔄 4) Mise à jour des soldes
    fromAccount.balance -= amount;
    toAccount.balance += amount;

    await fromAccount.save({ session });
    await toAccount.save({ session });

    // 📌 🔥 5) INSERTION DES 2 TRANSACTIONS ICI
// 📌 Génération références
const operationRef = `TRI-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const debitRef = `${operationRef}-D`;
const creditRef = `${operationRef}-C`;

// ...

// 1) DEBIT compte source
const [txDebit] = await Transaction.create(
  [
    {
      user: userId,
      type: "TRANSFER_INTERNAL_DEBIT",
      amount,
      currency,
      fromAccount: fromAccount._id,
      toAccount: toAccount._id,
      reference: debitRef, // 👈 ICI
      description: description || "Transfert interne (débit)",
      status: "SUCCESS",
    },
  ],
  { session }
);

// 2) CREDIT compte destination
const [txCredit] = await Transaction.create(
  [
    {
      user: userId,
      type: "TRANSFER_INTERNAL_CREDIT",
      amount,
      currency,
      fromAccount: fromAccount._id,
      toAccount: toAccount._id,
      reference: creditRef, // 👈 ICI (PAS la même que debit)
      description: description || "Transfert interne (crédit)",
      status: "SUCCESS",
    },
  ],
  { session }
);


    // 📌 6) Validation
    await session.commitTransaction();
    session.endSession();

    // 📌 7) Réponse API
    return res.json({
      message: "Transfert interne réussi",
      reference: finalReference,
      transactions: {
        debit: txDebit,
        credit: txCredit,
      },
      balances: {
        from: fromAccount.balance,
        to: toAccount.balance,
      },
    });
  } catch (error) {
    await session.abortTransaction().catch(() => {});
    session.endSession();
    console.error("Erreur transfert :", error);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
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
      throw new Error(
        "fromAccountId, beneficiaryId et amount sont obligatoires"
      );
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

    const account = await Account.findById(fromAccountId).session(session);
    if (!account || account.status?.toUpperCase() !== "ACTIVE") {
      throw new Error("Compte source introuvable ou inactif");
    }

    if (account.balance < amount) {
      throw new Error("Solde insuffisant");
    }

    const beneficiary = await Beneficiary.findOne({
      _id: beneficiaryId,
      user: userId,
    }).session(session);

    if (!beneficiary) {
      throw new Error("Bénéficiaire introuvable");
    }

    account.balance -= amount;
    await account.save({ session });

    const [tx] = await Transaction.create(
      [
        {
          user: userId,
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
    console.error("Erreur transferToBeneficiary :", error);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
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
// export const payBill = async (req, res) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     const userId = getUserIdOrThrow(req);

//     const {
//       accountId,
//       amount,
//       serviceCode,
//       serviceName,
//       billNumber,
//       currency = "XOF",
//       idempotencyKey,
//       reference,
//       description,
//     } = req.body;

//     // if (!accountId || !amount || !serviceCode || !billNumber) {
//     //   throw new Error(
//     //     "accountId, amount, serviceCode et billNumber sont obligatoires"
//     //   );
//     // }

//     // const { amount, serviceCode, billNumber, currency, description } = req.body;

// if (!amount || !serviceCode || !billNumber) {
//   throw new Error("amount, serviceCode et billNumber sont obligatoires");
// }

// // 🔥 ON RÉCUPÈRE LE COMPTE COURANT DU USER
//  account = await Account.findOne({
//   user: userId,
//   type: "COURANT",
//   status: "ACTIVE",
// }).session(session);

// if (!account) {
//   throw new Error("Aucun compte courant actif trouvé");
// }

    
//     //🔐 Vérification : seulement les services autorisés

//     const ALLOWED_SERVICES = ["EAU", "ELECTRICITE", "MOBILE", "INTERNET"];

//     if (!ALLOWED_SERVICES.includes(serviceCode)) {
//      return res.status(400).json({
//       message: "serviceCode invalide. Services autorisés : EAU, ELECTRICITE, MOBILE, INTERNET",
//     });
//     }

export const payBill = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const userId = getUserIdOrThrow(req);

    const {
      amount,
      serviceCode,
      serviceName,
      billNumber,
      currency = "XOF",
      idempotencyKey,
      reference,
      description,
    } = req.body;

    if (!amount || !serviceCode || !billNumber) {
      throw new Error(
        "amount, serviceCode et billNumber sont obligatoires"
      );
    }

    const ALLOWED_SERVICES = ["EAU", "ELECTRICITE", "MOBILE", "INTERNET"];
    if (!ALLOWED_SERVICES.includes(serviceCode)) {
      return res.status(400).json({
        message:
          "serviceCode invalide. Services autorisés : EAU, ELECTRICITE, MOBILE, INTERNET",
      });
    }

    // 🔥 COMPTE COURANT DU USER (PLUS D'accountId)
    const account = await Account.findOne({
      user: userId,
      type: "COURANT",
      status: "ACTIVE",
    }).session(session);

    if (!account) {
      throw new Error("Aucun compte courant actif trouvé");
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
    return res.status(500).json({
      message: error.message,
    });
  }
};

    

//     if (idempotencyKey) {
//       const existing = await Transaction.findOne({ idempotencyKey }).session(
//         session
//       );
//       if (existing) {
//         await session.abortTransaction();
//         session.endSession();
//         return res.json({ transaction: existing, idempotent: true });
//       }
//     }

//     const account = await Account.findById(accountId).session(session);
//     if (!account || account.status?.toUpperCase() !== "ACTIVE") {
//       throw new Error("Compte introuvable ou inactif");
//     }

//     if (account.balance < amount) {
//       throw new Error("Solde insuffisant");
//     }

//     account.balance -= amount;
//     await account.save({ session });

//     const [tx] = await Transaction.create(
//       [
//         {
//           user: userId,
//           type: "BILL_PAYMENT",
//           amount,
//           currency,
//           fromAccount: account._id,
//           toAccount: null,
//           serviceCode,
//           serviceName,
//           billNumber,
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

//     return res.json({
//       message: "Paiement de facture effectué avec succès",
//       transaction: tx,
//       balanceAfter: account.balance,
//     });
//   } catch (error) {
//     await session.abortTransaction().catch(() => {});
//     session.endSession();
//     console.error("Erreur payBill :", error);
//     return res
//       .status(500)
//       .json({ message: "Erreur serveur", error: error.message });
//   }
// };

