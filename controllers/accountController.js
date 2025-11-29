// controllers/accountController.js
import mongoose from "mongoose";
import Account from "../models/Account.js";
import User from "../models/User.js";

// 🔧 Générateur simple de numéro de compte
const generateAccountNumber = () => {
  const prefix = "SN-";
  const randomPart = Math.floor(100000000 + Math.random() * 900000000); // 9 chiffres
  return prefix + randomPart;
};

/**
 * 🔹 POST /api/accounts
 * Créer un nouveau compte (EPARGNE ou COURANT) pour l'utilisateur connecté
 * Utilise req.userId (fourni par authMiddleware)
 */
export const createAccount = async (req, res) => {
  try {
    console.log("📥 Body reçu dans createAccount :", req.body);
    console.log("👤 userId (req.userId) :", req.userId);

    const { type, currency, initialBalance } = req.body;

    // 1️⃣ Vérifier que l'utilisateur est authentifié
    if (!req.userId) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    // 2️⃣ Récupérer l'utilisateur en base
    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(req.userId);
    } catch (e) {
      return res
        .status(400)
        .json({ message: "userId invalide dans le token" });
    }

    const user = await User.findById(userObjectId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // 3️⃣ Types de comptes autorisés
    const allowedTypes = ["COURANT", "EPARGNE"];
    const finalType = type || "EPARGNE"; // par défaut : on ouvre un compte EPARGNE

    if (!allowedTypes.includes(finalType)) {
      return res.status(400).json({ message: "Type de compte invalide" });
    }

    // 4️⃣ Générer un numéro de compte unique
    let accountNumber;
    let existing;
    do {
      accountNumber = generateAccountNumber();
      existing = await Account.findOne({ number: accountNumber });
    } while (existing);

    // 5️⃣ Créer le compte
    const account = await Account.create({
      user: userObjectId, // ✅ lien avec l'utilisateur
      number: accountNumber,
      type: finalType,
      balance:
        initialBalance != null ? Number(initialBalance) : 0,
      currency: currency || "XOF",
      status: "ACTIVE",
    });

    // 6️⃣ Réponse
    return res.status(201).json({
      message: "Compte créé avec succès",
      account,
    });
  } catch (error) {
    console.error("Erreur création compte :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la création du compte",
      error: error.message,
    });
  }
};

/**
 * 🔹 GET /api/accounts
 * Récupérer tous les comptes de l'utilisateur connecté
 */
export const getAccountsByUser = async (req, res) => {
  try {
    console.log("🧪 req.userId dans getAccountsByUser :", req.userId);

    if (!req.userId) {
      return res
        .status(401)
        .json({ message: "Utilisateur non authentifié (userId manquant)" });
    }

    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(req.userId);
    } catch (e) {
      return res
        .status(400)
        .json({ message: "userId invalide dans le token" });
    }

    const accounts = await Account.find({ user: userObjectId });

    console.log(
      "🔎 Comptes trouvés pour user",
      userObjectId.toString(),
      "=>",
      accounts.length
    );

    return res.status(200).json({
      count: accounts.length,
      accounts,
    });
  } catch (error) {
    console.error("Erreur getAccountsByUser :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la récupération des comptes",
      error: error.message,
    });
  }
};

/**
 * 🔹 GET /api/accounts/:accountId
 * Récupérer un compte précis, seulement s'il appartient à l'utilisateur connecté
 */
export const getAccountById = async (req, res) => {
  try {
    if (!req.userId) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const { accountId } = req.params;

    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(req.userId);
    } catch (e) {
      return res
        .status(400)
        .json({ message: "userId invalide dans le token" });
    }

    const account = await Account.findById(accountId).populate(
      "user",
      "fullName email"
    );

    if (!account) {
      return res.status(404).json({ message: "Compte non trouvé" });
    }

    // Vérifier que le compte appartient bien au user connecté
    if (account.user._id.toString() !== userObjectId.toString()) {
      return res.status(403).json({ message: "Accès interdit à ce compte" });
    }

    return res.status(200).json({
      message: "Compte trouvé",
      account,
    });
  } catch (error) {
    console.error("Erreur getAccountById :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la récupération du compte",
      error: error.message,
    });
  }
};
