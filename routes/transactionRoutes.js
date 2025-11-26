// routes/transactionRoutes.js
import express from "express";
import {
  createTransaction,
  getTransactions,
  getTransactionById,
} from "../controllers/transactionController.js";

const router = express.Router();

// Créer une transaction
router.post("/", createTransaction);

// Liste des transactions (avec filtres en query)
router.get("/", getTransactions);

// Détail d'une transaction
router.get("/:id", getTransactionById);

export default router;
