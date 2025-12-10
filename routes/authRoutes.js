import express from "express";
import {
  registerUser,
  loginUser,
  forgotPassword,
  resetPassword,
  // getMe 
} from "../controllers/authController.js";
// import { authMiddleware } from "../middlewares/authMiddleware.js";


const router = express.Router();

// INSCRIPTION
router.post("/register", registerUser);

// CONNEXION
router.post("/login", loginUser);

// MOT DE PASSE OUBLIÉ
router.post("/forgot-password", forgotPassword);
// RÉINITIALISATION DU MOT DE PASSE
router.post("/reset-password/:token", resetPassword);
//Recuperation du User  Connecte
// router.get("/me", authMiddleware, getMe);
//udapte user

// router.post("/update", authMiddleware, updateUser);





export default router;




    