// controllers/authController.js
import User from "../models/User.js";
import Account from "../models/Account.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
// import crypto from "crypto";
// import nodemailer from "nodemailer";

const generateAccountNumber = () => {
  const prefix = "SN-";
  const randomPart = Math.floor(100000000 + Math.random() * 900000000);
  return prefix + randomPart;
};

// 🔹 INSCRIPTION
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    // 1️⃣ Vérifier les champs de base
    if (!fullName || !email || !password) {
      return res
        .status(400)
        .json({ message: "Nom, email et mot de passe sont obligatoires" });
    }

    // 2️⃣ Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Un utilisateur avec cet email existe déjà" });
    }

    // 3️⃣ Hasher le mot de passe
    const passwordHash = await bcrypt.hash(password, 10);

    // 4️⃣ Créer l'utilisateur AVEC passwordHash (et pas password)
    const user = await User.create({
      fullName,
      email,
      passwordHash, // ✅ correspond au schéma User
    });

    // 5️⃣ Créer automatiquement le compte COURANT
    let accountNumber;
    let existing;
    do {
      accountNumber = generateAccountNumber();
      existing = await Account.findOne({ number: accountNumber });
    } while (existing);

    const currentAccount = await Account.create({
      user: user._id,
      number: accountNumber,
      type: "COURANT",
      balance: 0,
      currency: "XOF",
      status: "ACTIVE",
    });

    // 6️⃣ Générer un token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // 7️⃣ Réponse (on ne renvoie PAS le passwordHash)
    return res.status(201).json({
      message: "Utilisateur créé avec son compte courant",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      account: currentAccount,
      token,
    });
  } catch (error) {
    console.error("Erreur inscription :", error.message);
    return res.status(500).json({
      message: "Erreur serveur lors de l'inscription",
      error: error.message,
    });
  }
};

// 🔹 CONNEXION
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    // 1️⃣ Vérifier les champs
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email et mot de passe sont obligatoires" });
    }

    // 2️⃣ Chercher l'utilisateur
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(404)
        .json({ message: "Utilisateur non trouvé" });
    }

    // 3️⃣ Vérifier le mot de passe
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Mot de passe incorrect" });
    }

    // 4️⃣ Générer un token
    const token = jwt.sign(
      { id: user._id },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    // (Optionnel) récupérer ses comptes directement
    const accounts = await Account.find({ user: user._id });

    // 5️⃣ Réponse
    return res.status(200).json({
      message: "Connexion réussie",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      accounts, // tu peux enlever si tu veux faire un GET /api/accounts à part
      token,
    });
  } catch (error) {
    console.error("Erreur login :", error.message);
    return res.status(500).json({
      message: "Erreur serveur lors de la connexion",
      error: error.message,
    });
  }
};

