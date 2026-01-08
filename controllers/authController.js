// controllers/authController.js
import User from "../models/User.js";
import Account from "../models/Account.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import nodemailer from "nodemailer";
import createNotification from "../utils/createNotification.js"; //ajouter

//  Utilitaires
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

// Fonction utilitaire pour envoyer des emails
const sendEmail = async ({ to, subject, html }) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // mot de passe d'application Gmail
    },
  });

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to,
    subject,
    html,
  });
};

//  INSCRIPTION
export const registerUser = async (req, res) => {
  try {
    const { fullName, email, phone, password, confirmPassword } = req.body;

    // 1️⃣ Vérifier les champs obligatoires
    if (!fullName || !email || !password || !confirmPassword) {
      return res
        .status(400)
        .json({ message: "Tous les champs sont obligatoires" });
    }

    // 2️⃣ Vérifier la correspondance des mots de passe
    if (password !== confirmPassword) {
      return res
        .status(400)
        .json({ message: "Les mots de passe ne correspondent pas" });
    }

    // 3️⃣ Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res
        .status(400)
        .json({ message: "Cet email est déjà utilisé" });
    }

    // 4️⃣ Hasher le mot de passe
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 5️⃣ Créer l'utilisateur avec passwordHash
    const user = await User.create({
      fullName,
      email,
      phone: phone.trim(),
      passwordHash: hashedPassword,
    });

    // 6️⃣ Créer automatiquement le compte COURANT
    let accountNumber;
    let existingAccount;
    do {
      accountNumber = generateAccountNumber();
      existingAccount = await Account.findOne({ number: accountNumber });
    } while (existingAccount);

    const currentAccount = await Account.create({
      user: user._id,
      number: accountNumber,
      type: "COURANT",
      balance: 0,
      currency: "XOF",
      status: "ACTIVE",
    });

    // 7️⃣ Générer un token
    const token = generateToken(user._id);

    // 8️⃣ Réponse
    return res.status(201).json({
      message: "Utilisateur créé avec succès et compte courant ouvert",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
      },
      account: currentAccount,
      token,
    });
  } catch (error) {
    console.error("Erreur inscription :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de l'inscription",
      error: error.message,
    });
  }
};

//
// 🔹 CONNEXION
//
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe sont obligatoires" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Identifiants invalides" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res
        .status(400)
        .json({ message: "Identifiants invalides" });
    }
    // 4️⃣ Générer un token
    const token = generateToken(user._id);
    // (Optionnel) récupérer ses comptes directement
    const accounts = await Account.find({ user: user._id });

    // ajouter  NOTIFICATION ()
    await createNotification({
      userId: user._id, //  user existe ici
      category: "SECURITY",
      title: "Connexion réussie",
      message: "Une connexion à votre compte a été effectuée avec succès.",
    });

    return res.status(200).json({
      message: "Connexion réussie",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
        avatarUrl: user.avatarUrl,  

      },
      accounts,
      token,
    });
  } catch (error) {
    console.error("Erreur connexion :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la connexion",
      error: error.message,
    });
  }
};

//  MOT DE PASSE OUBLIÉ
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Vérifier si l'email existe
    const user = await User.findOne({ email });
    if (!user) {
      return res
        .status(400)
        .json({ message: "Aucun compte trouvé avec cet email" });
    }
    // Générer token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Stocker token dans la DB
    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min
    await user.save();

    // Lien à envoyer
    const resetURL = `http://localhost:5173/ChangementMdp/${resetToken}`;

    // Utilisation du service interne sendEmail
    await sendEmail({
      to: email,
      subject: "Réinitialisation de mot de passe",
      html: `
        <h3>Demande de réinitialisation du mot de passe</h3>
        <p>Cliquez sur le lien pour réinitialiser :</p>
        <a href="${resetURL}" target="_blank">${resetURL}</a>
      `,
    });

    return res
      .status(200)
      .json({ message: "Email de réinitialisation envoyé !" });
  } catch (error) {
    console.error("Erreur forgotPassword:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

//  RÉINITIALISATION DU MOT DE PASSE
export const ChangementMdp = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        message: "Le mot de passe est requis",
      });
    }

    //  Hasher le token reçu
    const resetTokenHash = crypto
      .createHash("sha256")
      .update(token)
      .digest("hex");

    //  Trouver utilisateur valide
    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({
        message: "Token invalide ou expiré",
      });
    }

    //  Hash nouveau mot de passe
    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt); 
    //  change en user.password si besoin

    //  Invalider token
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    return res.status(200).json({
      message: "Mot de passe réinitialisé avec succès",
    });
  } catch (error) {
    console.error("Erreur resetPassword:", error);
    return res.status(500).json({ message: "Erreur serveur" });
  }
};


// ajouter PATCH /api/auth/change-password
export const changePassword = async (req, res) => {
  try {
    const userId = req.user.id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        message: "Tous les champs sont obligatoires",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    //  Comparer le mot de passe actuel avec passwordHash
    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Mot de passe actuel incorrect" });
    }

    //  Hasher et sauvegarder le nouveau mot de passe
    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    res.json({ message: "Mot de passe modifié avec succès" });
  } catch (error) {
    console.error("Erreur changePassword:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};


