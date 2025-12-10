// controllers/authController.js
import User from "../models/User.js";
import Account from "../models/Account.js";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";

// Génération du numéro de compte
const generateAccountNumber = () => {
  const prefix = "SN-";
  const randomPart = Math.floor(100000000 + Math.random() * 900000000);
  return prefix + randomPart;
};

// 🔹 INSCRIPTION
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, password } = req.body;

    if (!fullName || !email || !password) {
      return res.status(400).json({ message: "Nom, email et mot de passe sont obligatoires" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Un utilisateur avec cet email existe déjà" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      passwordHash,
    });

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

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });

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

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe sont obligatoires" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Mot de passe incorrect" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: "7d" });
    const accounts = await Account.find({ user: user._id });

    return res.status(200).json({
      message: "Connexion réussie",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
      },
      accounts,
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

// 🔹 MOT DE PASSE OUBLIÉ
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email requis" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // Générer un token de réinitialisation temporaire
    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetExpires = Date.now() + 3600000; // 1 heure
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = resetExpires;
    await user.save();

    const resetLink = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;

    // Configuration SMTP (Gmail)
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: false, // true pour port 465, false pour 587
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });

    const mailOptions = {
      from: process.env.SMTP_FROM,
      to: email,
      subject: "Réinitialisation du mot de passe",
      text: `Bonjour,\n\nCliquez sur ce lien pour réinitialiser votre mot de passe : ${resetLink}\n\nCe lien expire dans 1 heure.`
    };

    await transporter.sendMail(mailOptions);

    return res.status(200).json({
      message: "Un email de réinitialisation a été envoyé !",
      resetLink // utile pour tests côté frontend
    });

  } catch (error) {
    console.error("Erreur forgotPassword :", error.message);
    return res.status(500).json({
      message: "Erreur serveur lors de la réinitialisation du mot de passe",
      error: error.message,
    });
  }
};
