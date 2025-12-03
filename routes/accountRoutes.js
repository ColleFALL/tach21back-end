import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  createAccount,
  getAccountsByUser,
  getAccountById,
} from "../controllers/accountController.js";

const router = express.Router();

// Créer un compte
router.post("/", authMiddleware, createAccount);

// Liste des comptes du user connecté
router.get("/", authMiddleware, getAccountsByUser);


// Récupérer un compte par ID
router.get("/:accountId", authMiddleware, getAccountById);

export default router;
