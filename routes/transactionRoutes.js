// routes/transactionRoutes.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  deposit,
  withdraw,
  transfer,
  getTransactions,
} from "../controllers/transactionController.js";

const router = express.Router();

// Dépôt
// POST /api/transactions/deposit
router.post("/deposit", authMiddleware, deposit);

// Retrait
// POST /api/transactions/withdraw
router.post("/withdraw", authMiddleware, withdraw);

// Transfert entre comptes
// POST /api/transactions/transfer
router.post("/transfer", authMiddleware, transfer);

// Historique
// GET /api/transactions
router.get("/", authMiddleware, getTransactions);

export default router;
