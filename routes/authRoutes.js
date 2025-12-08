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

//MOT DE PASSE OUBLIER


export default router;
