import express from "express";
import { authMiddleware } from "../middlewares/authMiddleware.js";
import {
  getMyCard,
  createMyCard,
  toggleFreeze,
  blockCard,
} from "../controllers/cardController.js";
import { updateCardLimits } from "../controllers/cardController.js";

const router = express.Router();

// ✅ Auto-génère la carte si elle n'existe pas
router.get("/my", authMiddleware, getMyCard);

// optionnel
router.post("/create", authMiddleware, createMyCard);

router.patch("/:id/freeze", authMiddleware, toggleFreeze);
router.patch("/:id/block", authMiddleware, blockCard);



router.patch("/:id/limits", authMiddleware, updateCardLimits);


export default router;
