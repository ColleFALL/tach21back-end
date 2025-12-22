// import express from "express";
// import {
//   registerUser,
//   loginUser,
//   forgotPassword,
//   resetPassword,
//   // getMe 
// } from "../controllers/authController.js";
// import { authMiddleware } from "../middlewares/authMiddleware.js";


// const router = express.Router();

// router.post("/register", registerUser);
// router.post("/login", loginUser);

// // MOT DE PASSE OUBLIÉ
// router.post("/forgot-password", forgotPassword);
// // RÉINITIALISATION DU MOT DE PASSE
// router.post("/reset-password/:token", resetPassword);

// // 🔐 Changer le mot de passe (utilisateur connecté)
// router.patch("/change-password", authMiddleware);

// // router.post("/update", authMiddleware, updateUser);

// export default router;


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


    