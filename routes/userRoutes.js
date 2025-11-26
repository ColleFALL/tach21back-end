// const express = require("express");
// const { getUsers } = require("../controllers/userController");

// const router = express.Router();

// router.get("/", getUsers);

// module.exports = router;
// routes/testRoutes.js
import express from "express";
import bcrypt from "bcrypt";
import User from "../models/User.js";

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // 1. vérifier si l'email existe déjà
    const existing = await User.findOne({ email });
    if (existing) {
      return res
        .status(400)
        .json({ message: "Un utilisateur existe déjà avec cet email." });
    }

    // 2. hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // 3. créer l'utilisateur
    const user = await User.create({
      fullName,
      email,
      passwordHash,
    });

    return res.status(201).json({
      message: "User créé avec succès",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Erreur test-create-user :", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
});

export default router;

