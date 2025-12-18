import express from "express";
import {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  changePassword, // ✅ À AJOUTER
} from "../controllers/authController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";


const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);

// MOT DE PASSE OUBLIÉ
router.post("/forgot-password", forgotPassword);
// RÉINITIALISATION DU MOT DE PASSE
router.post("/reset-password/:token", resetPassword);

// 🔐 Changer le mot de passe (utilisateur connecté)
router.patch("/change-password", authMiddleware,changePassword);

// router.post("/update", authMiddleware, updateUser);

export default router;




    