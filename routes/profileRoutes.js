// routes/profileRoutes.js
import express from "express";
import {
  getProfile,
  updateProfile,
  changePassword,
  setPin,
  updateAvatar
} from "../controllers/profileController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";
//pour le photo de profile
import { upload } from "../middlewares/uploadMiddleware.js";
// import multer from "multer";
// ⚙️ Config simple de Multer : stocke les fichiers dans /uploads
// const upload = multer({ dest: "uploads/" });

const router = express.Router();

// Toutes ces routes sont protégées (user connecté)
router.get("/profile", authMiddleware, getProfile);
router.put("/profile", authMiddleware, updateProfile);
router.put("/profile/change-password", authMiddleware, changePassword);

// Optionnel : route pour PIN
router.post("/profile/set-pin", authMiddleware, setPin);
 //route pour le photo de profile
//  router.post("/profile/avatar", authMiddleware, upload.single("avatar"), updateAvatar);
// 📸 NOUVELLE ROUTE : upload avatar
router.post(
  "/profile/avatar",
  authMiddleware,
  upload.single("avatar"), // le champ "avatar" doit matcher ce que tu mets dans FormData
  updateAvatar
);
 
export default router;
