import express from "express";
import { contactSupport } from "../controllers/supportController.js";
import { authMiddleware } from "../middlewares/authMiddleware.js";

const router = express.Router();

router.post("/contact", authMiddleware, contactSupport);

export default router;
