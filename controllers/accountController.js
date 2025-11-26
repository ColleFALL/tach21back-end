// controllers/accountController.js
import Account from "../models/Account.js";
import User from "../models/User.js";

// Générateur simple de numéro de compte
const generateAccountNumber = () => {
  const prefix = "SN-"; // Sénégal par ex.
  const randomPart = Math.floor(100000000 + Math.random() * 900000000); // 9 chiffres
  return prefix + randomPart;
};

// POST /api/accounts
export const createAccount = async (req, res) => {
  try {
    const { userId, type, currency, initialBalance } = req.body;

    // 1️⃣ Vérifier les données
    if (!userId) {
      return res.status(400).json({ message: "userId est requis" });
    }

    // 2️⃣ Vérifier que l'utilisateur existe
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
      balance: initialBalance || 0,
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

// GET /api/accounts/by-user/:userId
export const getAccountsByUser = async (req, res) => {
  try {
    const { userId } = req.params;

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

// GET /api/accounts/:accountId
export const getAccountById = async (req, res) => {
  try {
    const { accountId } = req.params;

    const account = await Account.findById(accountId).populate("user", "firstname lastname email");

    if (!account) {
      return res.status(404).json({ message: "Compte non trouvé" });
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
