import express from "express";
import {
  registerUser,
  loginUser,
} from "../controllers/authController.js";


const router = express.Router();

// INSCRIPTION
router.post("/register", registerUser);

// CONNEXION
router.post("/login", loginUser);
//Mot de passe oublie
// router.post("/forgot-password", forgotPassword);
//reset-password
// router.post("/reset-password", resetPassword);

export default router;
