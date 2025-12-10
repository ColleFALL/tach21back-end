import express from "express";
import {
  createAccount,
  getAccountsByUser,
  getAccountById,
  getAccountsSummary,
} from "../controllers/accountController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// Créer un compte
router.post("/", authMiddleware, createAccount);

// Liste des comptes du user connecté
router.get("/", authMiddleware, getAccountsByUser);

//account summary
router.get("/summary", authMiddleware, getAccountsSummary);

// Récupérer un compte par ID
router.get("/:accountId", authMiddleware, getAccountById);


export default router;
