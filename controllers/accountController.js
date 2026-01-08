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
 * Créer un nouveau compte (EPARGNE ou BUSINESS) pour l'utilisateur connecté
 */
export const createAccount = async (req, res) => {
  try {
    const { type, currency, initialBalance } = req.body;

    if (!req.userId) return res.status(401).json({ message: "Utilisateur non authentifié" });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: "Utilisateur non trouvé" });

    const allowedTypes = ["EPARGNE", "BUSINESS"];
    if (!type || !allowedTypes.includes(type.toUpperCase())) {
      return res.status(400).json({
        message: "Type de compte invalide. Utilisez EPARGNE ou BUSINESS.",
      });
    }

    // Générer numéro unique
    let accountNumber, existing;
    do {
      accountNumber = generateAccountNumber();
      existing = await Account.findOne({ number: accountNumber });
    } while (existing);

    const account = await Account.create({
      user: req.userId,
      number: accountNumber,
      type: type.toUpperCase(),
      balance: initialBalance != null ? Number(initialBalance) : 0,
      currency: currency || "XOF",
      status: "ACTIVE",
    });

    return res.status(201).json({ message: `Compte ${type.toUpperCase()} créé`, account });
  } catch (error) {
    console.error("Erreur création compte :", error);
    return res.status(500).json({ message: "Erreur serveur lors de la création du compte", error: error.message });
  }
};

/**
 * 🔹 GET /api/accounts
 * Récupérer tous les comptes de l'utilisateur connecté
 * Crée automatiquement les comptes manquants COURANT, EPARGNE, BUSINESS
 */
// Récupérer tous les comptes d'un utilisateur
export const getAccountsByUser = async (req, res) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ message: "Utilisateur non authentifié" });

    // On récupère tous les comptes existants
    let accounts = await Account.find({ user: userId });

    // Si un type de compte n'existe pas encore, on peut le créer à la première connexion
    const requiredTypes = ["COURANT", "EPARGNE", "BUSINESS"];
    for (let type of requiredTypes) {
      if (!accounts.some(acc => acc.type === type)) {
        const newAcc = new Account({
          user: userId,
          number: Math.floor(100000 + Math.random() * 900000).toString(),
          type,
          balance: 0,
          currency: "XOF",
          status: "ACTIVE",
        });
        await newAcc.save();
        accounts.push(newAcc);
      }
    }

    res.json(accounts); // renvoie toujours un tableau complet
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: err.message });
  }
};


/**
 * 🔹 GET /api/accounts/:accountId
 * Récupérer un compte précis
 */
export const getAccountById = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Utilisateur non authentifié" });

    const { accountId } = req.params;
    const account = await Account.findById(accountId).populate("user", "fullName email");

    if (!account) return res.status(404).json({ message: "Compte non trouvé" });
    if (account.user._id.toString() !== req.userId) return res.status(403).json({ message: "Accès interdit" });

    res.json({ message: "Compte trouvé", account });
  } catch (error) {
    console.error("Erreur getAccountById :", error);
    res.status(500).json({ message: error.message });
  }
};

/**
 * 🔹 GET /api/accounts/summary
 * Résumé des comptes (nombre + solde total)
 */
export const getAccountsSummary = async (req, res) => {
  try {
    if (!req.userId) return res.status(401).json({ message: "Utilisateur non authentifié" });

    const accounts = await Account.find({ user: req.userId });
    const totalBalance = accounts.reduce((sum, acc) => sum + (acc.balance || 0), 0);

    res.json({
      message: "Résumé des comptes récupéré",
      summary: { accountsCount: accounts.length, totalBalance, currency: "XOF" },
    });
  } catch (error) {
    console.error("Erreur getAccountsSummary :", error);
    res.status(500).json({ message: error.message });
  }
};
