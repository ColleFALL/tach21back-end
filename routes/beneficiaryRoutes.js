// routes/beneficiaryRoutes.js
import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  createBeneficiary,
  getBeneficiary,
} from "../controllers/beneficiaryController.js";

const router = express.Router();

// toutes les routes bénéficiaires nécessitent l'auth
router.use(authMiddleware);

// Ajout bénéficiaire
// POST /api/beneficiaries
router.post("/", createBeneficiary);

// Liste des bénéficiaires de l'utilisateur connecté
// GET /api/beneficiaries
router.get("/", getBeneficiary);

export default router;
