// routes/transactionRoutes.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  deposit,
  withdraw,
  transfer,
  transferUser,
  getTransactions,
  transferToBeneficiary,
  getPaymentServices,
  payBill,

} from "../controllers/transactionController.js";

const router = express.Router();

// Toutes les routes de ce fichier nécessitent l'auth
router.use(authMiddleware);

// POST /api/transactions/deposit
router.post("/deposit", deposit); 

// POST /api/transactions/withdraw
router.post("/withdraw", withdraw);

// POST /api/transactions/transfer
router.post("/transfer", transfer);

// POST /api/transactions/transfer/user
router.post("/transfer/user", transferUser);

// POST /api/transactions/transfer/beneficiary (externe)
router.post("/transfer/beneficiary", transferToBeneficiary);

// 🧾 Paiement factures
// Liste services
router.get("/services", getPaymentServices);

// Paiement facture
router.post("/bill-payment", payBill);

// GET /api/transactions
router.get("/", getTransactions);

export default router;
