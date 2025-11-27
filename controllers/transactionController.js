// controllers/transactionController.js
import Account from "../models/Account.js";
import Transaction from "../models/Transaction.js";

// 🟢 DEPOT D'ARGENT
// POST /api/transactions/deposit
export const deposit = async (req, res) => {
  try {
    // TODO: implémenter la logique de dépôt
    return res
      .status(501)
      .json({ message: "Dépôt non encore implémenté (à faire)" });
  } catch (error) {
    console.error("Erreur dépôt :", error.message);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};

// 🔵 RETRAIT
// POST /api/transactions/withdraw
export const withdraw = async (req, res) => {
  try {
    // TODO: implémenter la logique de retrait
    return res
      .status(501)
      .json({ message: "Retrait non encore implémenté (à faire)" });
  } catch (error) {
    console.error("Erreur retrait :", error.message);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};

// 🟣 TRANSFERT ENTRE COMPTES
// POST /api/transactions/transfer
export const transfer = async (req, res) => {
  try {
    // TODO: implémenter la logique de transfert
    return res
      .status(501)
      .json({ message: "Transfert non encore implémenté (à faire)" });
  } catch (error) {
    console.error("Erreur transfert :", error.message);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};

// 🧾 HISTORIQUE DES TRANSACTIONS DU USER CONNECTÉ
// GET /api/transactions
export const getTransactions = async (req, res) => {
  try {
    // TODO: implémenter la récupération des transactions du user
    return res
      .status(501)
      .json({ message: "Historique non encore implémenté (à faire)" });
  } catch (error) {
    console.error("Erreur getTransactions :", error.message);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};
