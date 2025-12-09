// routes/profileRoutes.js
import express from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
  setPin,
} from "../controllers/profileController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
//pour le photo de profile
import { upload } from "../middlewares/uploadMiddleware.js";
import { updateAvatar } from "../controllers/profileController.js";
const router = express.Router();

// Toutes ces routes sont protégées (user connecté)
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.put("/profile/change-password", authMiddleware, changePassword);

// Optionnel : route pour PIN
router.post("/profile/set-pin", authMiddleware, setPin);
 //route pour le photo de profile
 router.post("/profile/avatar", authMiddleware, upload.single("avatar"), updateAvatar);

 
export default router;
