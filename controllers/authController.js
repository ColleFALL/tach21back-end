// controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import Account from "../models/Account.js"; // manquant dans ton code
import createNotification from "../utils/createNotification.js";

// 🔹 Utilitaires

// Générer un numéro de compte unique
const generateAccountNumber = () => {
  const prefix = "SN-";
  const randomPart = Math.floor(100000000 + Math.random() * 900000000);
  return prefix + randomPart;
};

// Générer un token JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};


    
// 📧 Fonction utilitaire pour envoyer des emails
const sendEmail = async ({ to, subject, html }) => {
  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS, // mot de passe d’application Gmail
      },
    });

    await transporter.sendMail({
      from: `WECCO <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });

    console.log(`📧 Email envoyé à ${to}`);
  } catch (error) {
    console.error("❌ Erreur envoi email :", error);
    throw error;
  }
};



// 🔹 INSCRIPTION
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, phone, password, confirmPassword } = req.body;

    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: "Tous les champs sont obligatoires" });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: "Les mots de passe ne correspondent pas" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Cet email est déjà utilisé" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      fullName,
      email,
      phone: phone.trim(),
      passwordHash: hashedPassword,
    });

    // Créer le compte courant
    let accountNumber;
    do {
      accountNumber = generateAccountNumber();
    } while (await Account.findOne({ number: accountNumber }));

    await Account.create({
      user: user._id,
      number: accountNumber,
      type: "COURANT",
      balance: 0,
      currency: "XOF",
      status: "ACTIVE",
    });

    // Générer token de validation email
    const emailToken = crypto.randomBytes(32).toString("hex");
    const emailTokenHash = crypto.createHash("sha256").update(emailToken).digest("hex");

    user.emailVerificationToken = emailTokenHash;
    user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
    await user.save();

    const verifyURL = `http://localhost:5173/verify-email/${emailToken}`;

    await sendEmail({
      to: user.email,
      subject: "Validation de votre compte",
      html: `
        <h3>Bienvenue ${user.fullName}</h3>
        <p>Cliquez pour activer votre compte :</p>
        <a href="${verifyURL}">${verifyURL}</a>
        <p>Ce lien expire dans 24 heures.</p>
      `,
    });

    return res.status(201).json({
      message: "Compte créé avec succès. Veuillez vérifier votre email.",
    });
  } catch (error) {
    console.error("Erreur inscription :", error);
    return res.status(500).json({ message: "Erreur serveur lors de l'inscription" });
  }
};

// 🔹 CONNEXION
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) return res.status(400).json({ message: "Email et mot de passe sont obligatoires" });

    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Identifiants invalides" });

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) return res.status(400).json({ message: "Identifiants invalides" });

    if (!user.isVerified) return res.status(403).json({ message: "Veuillez vérifier votre email avant de vous connecter" });

    // Générer token 2FA
    const twoFactorToken = crypto.randomBytes(32).toString("hex");
    const twoFactorTokenHash = crypto.createHash("sha256").update(twoFactorToken).digest("hex");

    user.twoFactorToken = twoFactorTokenHash;
    user.twoFactorExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
    await user.save();

    const twoFactorURL = `http://localhost:5173/2fa/verify/${twoFactorToken}`;

    await sendEmail({
      to: user.email,
      subject: "Connexion sécurisée",
      html: `
        <p>Bonjour ${user.fullName},</p>
        <p>Cliquez sur le lien ci-dessous pour finaliser votre connexion :</p>
        <a href="${twoFactorURL}">${twoFactorURL}</a>
        <p>Ce lien expire dans 10 minutes.</p>
        <p>Si ce n'était pas vous, ignorez ce message.</p>
      `,
    });

    await createNotification({
      userId: user._id,
      category: "SECURITY",
      title: "Connexion réussie",
      message: "Une connexion à votre compte a été effectuée avec succès.",
    });

    return res.status(200).json({ message: "Lien de connexion 2FA envoyé par email" });
  } catch (error) {
    console.error("Erreur connexion :", error);
    return res.status(500).json({ message: "Erreur serveur lors de la connexion", error: error.message });
  }
};

// 🔹 VERIFY EMAIL
export const verifyEmail = async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      emailVerificationToken: tokenHash,
      emailVerificationExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Lien invalide ou expiré" });

    user.isVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "Email vérifié avec succès !" });
  } catch (error) {
    console.error("Erreur verifyEmail:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🔹 VERIFY 2FA
export const verifyTwoFactor = async (req, res) => {
  try {
    const { token } = req.params;
    const tokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      twoFactorToken: tokenHash,
      twoFactorExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Lien invalide ou expiré" });

    user.twoFactorToken = undefined;
    user.twoFactorExpires = undefined;
    await user.save();

    const jwtToken = generateToken(user._id);

    return res.status(200).json({
      message: "Connexion réussie",
      token: jwtToken,
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Erreur 2FA :", error);
    return res.status(500).json({ message: "Erreur serveur lors de la validation 2FA" });
  }
};
      export const resendVerificationEmail = async (req, res) => {
        const { email } = req.body;

        const user = await User.findOne({ email });
        if (!user) {
          return res.status(400).json({ message: "Utilisateur introuvable" });
        }

        if (user.isVerified) {
          return res.status(400).json({ message: "Compte déjà vérifié" });
        }

        const emailToken = crypto.randomBytes(32).toString("hex");
        const emailTokenHash = crypto.createHash("sha256").update(emailToken).digest("hex");

        user.emailVerificationToken = emailTokenHash;
        user.emailVerificationExpires = Date.now() + 24 * 60 * 60 * 1000;
        await user.save();

        const verifyURL = `http://localhost:5173/verify-email/${emailToken}`;

        await sendEmail({
          to: user.email,
          subject: "Validation de votre compte",
          html: `
            <p>Cliquez pour valider votre compte :</p>
            <a href="${verifyURL}">${verifyURL}</a>
          `,
        });

        res.json({ message: "Email de validation renvoyé" });
      };


// 🔹 FORGOT PASSWORD
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "Aucun compte trouvé avec cet email" });

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    const resetURL = `http://localhost:5173/ChangementMdp/${resetToken}`;

    await sendEmail({
      to: email,
      subject: "Réinitialisation de mot de passe",
      html: `
        <h3>Demande de réinitialisation du mot de passe</h3>
        <p>Cliquez sur le lien pour réinitialiser :</p>
        <a href="${resetURL}" target="_blank">${resetURL}</a>
      `,
    });

    return res.status(200).json({ message: "Email de réinitialisation envoyé !" });
  } catch (error) {
    console.error("Erreur forgotPassword:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🔹 RESET PASSWORD
export const ChangementMdp = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) return res.status(400).json({ message: "Le mot de passe est requis" });

    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) return res.status(400).json({ message: "Token invalide ou expiré" });

    user.passwordHash = await bcrypt.hash(password, 10);
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    return res.status(200).json({ message: "Mot de passe réinitialisé avec succès" });
  } catch (error) {
    console.error("Erreur resetPassword:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// 🔹 CHANGE PASSWORD
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) return res.status(400).json({ message: "Tous les champs sont obligatoires" });

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) return res.status(401).json({ message: "Mot de passe actuel incorrect" });

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Mot de passe modifié avec succès" });
  } catch (error) {
    console.error("Erreur changePassword:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
