

import express from "express";
import {
  registerUser,
  loginUser,
  forgotPassword,
  ChangementMdp,
} from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

// AUTH CLASSIQUE
router.post("/register", registerUser);
router.post("/login", loginUser);

// 🔑 MOT DE PASSE OUBLIÉ (envoi email)
router.post("/forgot-password", forgotPassword);

// 🔁 RESET PASSWORD (APRÈS CLIC SUR LIEN EMAIL)
router.post("/ChangementMdp/:token", ChangementMdp);

// 🔐 CHANGER MOT DE PASSE (utilisateur connecté)
// (optionnel, autre cas d’usage)
router.patch("/change-password", authMiddleware);

export default router;


    