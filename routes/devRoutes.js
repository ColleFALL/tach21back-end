// routes/devRoutes.js
import express from "express";
import { devCreditByEmail } from "../controllers/devController.js";

const router = express.Router();

// ⚠️ Route DEV : à utiliser uniquement en local
// POST /api/dev/credit-by-email
router.post("/credit-by-email", devCreditByEmail);

export default router;