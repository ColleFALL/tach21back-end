// controllers/accountController.js
import Account from "../models/Account.js";
import User from "../models/User.js";

// Générateur simple de numéro de compte
const generateAccountNumber = () => {
  const prefix = "SN-"; // Sénégal par ex.
  const randomPart = Math.floor(100000000 + Math.random() * 900000000); // 9 chiffres
  return prefix + randomPart;
};

// ✅ POST /api/accounts
// Créer un compte pour l'utilisateur connecté (req.user)
export const createAccount = async (req, res) => {
  try {
    console.log("📥 Body reçu dans createAccount :", req.body);
    console.log("👤 User connecté :", req.user);

    const { type, currency, initialBalance } = req.body;

    // 1️⃣ Vérifier que l'utilisateur est bien authentifié (normalement assuré par authMiddleware)
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const userId = req.user.id;

    // 2️⃣ Vérifier que l'utilisateur existe (optionnel si tu fais confiance à ton token)
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // 3️⃣ Générer un numéro de compte unique
    let accountNumber;
    let existing;
    do {
      accountNumber = generateAccountNumber();
      existing = await Account.findOne({ number: accountNumber });
    } while (existing);

    // 4️⃣ Créer le compte
    const account = await Account.create({
      user: user._id,
      number: accountNumber,
      type: type || "COURANT",
      currency: currency || "XOF",
      balance: initialBalance != null ? Number(initialBalance) : 0,
    });

    // 5️⃣ Réponse
    return res.status(201).json({
      message: "Compte créé avec succès",
      account,
    });
  } catch (error) {
    console.error("Erreur création compte :", error.message);
    return res.status(500).json({
      message: "Erreur serveur lors de la création du compte",
      error: error.message,
    });
  }
};

// ✅ GET /api/accounts
// Récupérer tous les comptes de l'utilisateur connecté
export const getAccountsByUser = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const userId = req.user.id;

    const accounts = await Account.find({ user: userId });

    return res.status(200).json({
      message: "Comptes trouvés",
      accounts,
    });
  } catch (error) {
    console.error("Erreur getAccountsByUser :", error.message);
    return res.status(500).json({
      message: "Erreur serveur lors de la récupération des comptes",
      error: error.message,
    });
  }
};

// ✅ GET /api/accounts/:accountId
// Récupérer un compte précis, mais seulement s'il appartient au user connecté
export const getAccountById = async (req, res) => {
  try {
    if (!req.user || !req.user.id) {
      return res.status(401).json({ message: "Utilisateur non authentifié" });
    }

    const { accountId } = req.params;
    const userId = req.user.id;

    const account = await Account.findById(accountId).populate(
      "user",
      "fullName email"
    );

    if (!account) {
      return res.status(404).json({ message: "Compte non trouvé" });
    }

    // Vérifier que le compte appartient bien au user connecté
    if (account.user._id.toString() !== userId.toString()) {
      return res
        .status(403)
        .json({ message: "Accès interdit à ce compte" });
    }

    return res.status(200).json({
      message: "Compte trouvé",
      account,
    });
  } catch (error) {
    console.error("Erreur getAccountById :", error.message);
    return res.status(500).json({
      message: "Erreur serveur lors de la récupération du compte",
      error: error.message,
    });
  }
};
