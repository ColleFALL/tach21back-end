import express from "express";
import { registerUser, loginUser ,forgotPassword, resetPassword } from "../controllers/authController.js";

const router = express.Router();

// INSCRIPTION
router.post("/register", registerUser);

// CONNEXION
router.post("/login", loginUser);
// MOT DE PASSE OUBLIÉ
router.post("/forgot-password", forgotPassword);
// RÉINITIALISATION DU MOT DE PASSE
router.post("/reset-password/:token", resetPassword);

export default router;




    