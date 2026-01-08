import express from "express";
import { getPreferences, updatePreferences } from "../controllers/preferenceController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.get("/preferences", authMiddleware, getPreferences);
router.put("/preferences", authMiddleware, updatePreferences);
// router.put(
//   "/email-notifications",
//   authMiddleware,
//   updateEmailNotification
// );//ajouter pour la route des notifications par alertes
export default router;
