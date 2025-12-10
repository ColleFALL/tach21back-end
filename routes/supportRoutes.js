// routes/supportRoutes.js
import express from "express";
import { createContactMessage } from "../controllers/supportController.js";

const router = express.Router();

// 🟢 Formulaire de contact (pas besoin d'être connecté pour écrire au support)
router.post("/support/contact", createContactMessage);

export default router;
