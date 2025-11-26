// routes/accountRoutes.js
import express from "express";
import {
  createAccount,
  getAccountsByUser,
  getAccountById,
} from "../controllers/accountController.js";

const router = express.Router();

// Créer un compte
router.post("/", createAccount);

// Lister les comptes d'un utilisateur
router.get("/by-user/:userId", getAccountsByUser);

// Détails d'un compte
router.get("/:accountId", getAccountById);

export default router;
