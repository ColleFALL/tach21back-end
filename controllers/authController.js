// // controllers/authController.js
// import bcrypt from "bcryptjs";
// import jwt from "jsonwebtoken";
// import User from "../models/User.js";
// import crypto from "crypto";
// import nodemailer from "nodemailer";



// //  fonction utilitaire pour générer un token JWT
// const generateToken = (userId) => {
//   return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
//     expiresIn: "7d",
//   });
// };

// //  INSCRIPTION
// export const registerUser = async (req, res) => {
//   try {
//     const { fullName, email, phone, password, confirmPassword } = req.body;

//     // Vérifier les champs obligatoires
//     if (!fullName || !email || !password || !confirmPassword) {
//       return res
//         .status(400)
//         .json({ message: "Tous les champs sont obligatoires" });
//     }

//     // Vérifier la correspondance des mots de passe
//     if (password !== confirmPassword) {
//       return res.status(400).json({
//         message: "Les mots de passe ne correspondent pas",
//       });
//     }

//     // Vérifier si l'utilisateur existe déjà
//     const existingUser = await User.findOne({ email });
//     if (existingUser) {
//       return res
//         .status(400)
//         .json({ message: "Cet email est déjà utilisé" });
//     }

//     // Hasher le mot de passe
//     const salt = await bcrypt.genSalt(10);
//     const hashedPassword = await bcrypt.hash(password, salt);

//     // Créer l'utilisateur
//     const user = await User.create({
//       fullName,
//       email,
//       phone,
//       passwordHash: hashedPassword,
//     });

//     // Générer un token
//     const token = generateToken(user._id);

//     // Réponse
//     res.status(201).json({
//       message: "Utilisateur créé avec succès",
//       user: {
//         id: user._id,
//         fullName: user.fullName,
//         email: user.email,
//         phone: user.phone,
//         role: user.role,
//         isVerified: user.isVerified,
//       },
//       token,
//     });
//   } catch (error) {
//     console.error("Erreur inscription:", error);
//     res
//       .status(500)
//       .json({ message: "Erreur serveur", error: error.message });
//   }
// };

// //  CONNEXION
// export const loginUser = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Vérifier les champs
//     if (!email || !password) {
//       return res
//         .status(400)
//         .json({ message: "Email et mot de passe sont obligatoires" });
//     }

//     // Chercher l'utilisateur
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res
//         .status(400)
//         .json({ message: "Identifiants invalides" });
//     }

//     // Comparer le mot de passe
//     const isMatch = await bcrypt.compare(password, user.passwordHash);
//     if (!isMatch) {
//       return res
//         .status(400)
//         .json({ message: "Identifiants invalides" });
//     }

//     // Générer un token
//     const token = generateToken(user._id);

//     // Réponse
//     res.status(200).json({
//       message: "Connexion réussie",
//       user: {
//         id: user._id,
//         fullName: user.fullName,
//         email: user.email,
//         phone: user.phone,
//         role: user.role,
//         isVerified: user.isVerified,
//       },
//       token,
//     });
//   } catch (error) {
//     console.error("Erreur connexion:", error);
//     res
//       .status(500)
//       .json({ message: "Erreur serveur", error: error.message });
//   }
// };



// // MOT DE PASSE OUBLIÉ
// export const forgotPassword = async (req, res) => {
//   try {
//     const { email } = req.body;

//     // Vérifier si l'email existe
//     const user = await User.findOne({ email });
//     if (!user) {
//       return res.status(400).json({ message: "Aucun compte trouvé avec cet email" });
//     }

//     // Générer token
//     const resetToken = crypto.randomBytes(32).toString("hex");
//     const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

//     // Stocker token dans DB
//     user.resetPasswordToken = resetTokenHash;
//     user.resetPasswordExpires = Date.now() + 15 * 60 * 1000; // 15 min
//     await user.save();

//     // Lien à envoyer
//     const resetURL = `http://localhost:5173/reset-password/${resetToken}`;

//     // Configure l’email
//     const transporter = nodemailer.createTransport({
//       service: "gmail",
//       auth: {
//         user: process.env.EMAIL_USER,
//         pass: process.env.EMAIL_PASS
//       }
//     });

//     const message = {
//       from: process.env.EMAIL_USER,
//       to: email,
//       subject: "Réinitialisation de mot de passe",
//       html: `
//         <h3>Demande de réinitialisation du mot de passe</h3>
//         <p>Cliquez sur le lien pour réinitialiser :</p>
//         <a href="${resetURL}" target="_blank">${resetURL}</a>
//       `
//     };

//     await transporter.sendMail(message);

//     res.status(200).json({ message: "Email de réinitialisation envoyé !" });

//   } catch (error) {
//     console.error("Erreur forgotPassword:", error);
//     res.status(500).json({ message: "Erreur serveur" });
//   }
// };
// // RÉINITIALISATION DU MOT DE PASSE
// export const resetPassword = async (req, res) => {
//   try {
//     const { token } = req.params;
//     const { password } = req.body;

//     // Hasher le token reçu pour le comparer avec celui en DB
//     const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

//     // Chercher l'utilisateur avec le token valide et non expiré
//     const user = await User.findOne({
//       resetPasswordToken: resetTokenHash,
//       resetPasswordExpires: { $gt: Date.now() }
//     });

//     if (!user) {
//       return res.status(400).json({ message: "Token invalide ou expiré" });
//     }

//     // Hasher le nouveau mot de passe
//     const salt = await bcrypt.genSalt(10);
//     user.passwordHash = await bcrypt.hash(password, salt);

//     // Supprimer le token et sa date d'expiration
//     user.resetPasswordToken = undefined;
//     user.resetPasswordExpires = undefined;

//     await user.save();

//     res.status(200).json({ message: "Mot de passe réinitialisé avec succès !" });
//   } catch (error) {
//     console.error("Erreur resetPassword:", error);
//     res.status(500).json({ message: "Erreur serveur" });
//   }
// };

// controllers/authController.js
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import User from "../models/User.js";
import crypto from "crypto";
import nodemailer from "nodemailer";

//  fonction utilitaire pour générer un token JWT
const generateToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
};

//  fonction utilitaire pour envoyer des emails
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

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const user = await User.create({
      fullName,
      email,
      phone,
      passwordHash: hashedPassword,
    });

    const token = generateToken(user._id);

    res.status(201).json({
      message: "Utilisateur créé avec succès",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
      },
      token,
    });
  } catch (error) {
    console.error("Erreur inscription:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

//  CONNEXION
export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "Email et mot de passe sont obligatoires" });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: "Identifiants invalides" });
    }

    const token = generateToken(user._id);

    res.status(200).json({
      message: "Connexion réussie",
      user: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        role: user.role,
        isVerified: user.isVerified,
      },
      token,
    });
  } catch (error) {
    console.error("Erreur connexion:", error);
    res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// MOT DE PASSE OUBLIÉ
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: "Aucun compte trouvé avec cet email" });
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");

    user.resetPasswordToken = resetTokenHash;
    user.resetPasswordExpires = Date.now() + 15 * 60 * 1000;
    await user.save();

    const resetURL = `http://localhost:5173/reset-password/${resetToken}`;

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

    res.status(200).json({ message: "Email de réinitialisation envoyé !" });
  } catch (error) {
    console.error("Erreur forgotPassword:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

// RÉINITIALISATION DU MOT DE PASSE
export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const resetTokenHash = crypto.createHash("sha256").update(token).digest("hex");

    const user = await User.findOne({
      resetPasswordToken: resetTokenHash,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).json({ message: "Token invalide ou expiré" });
    }

    const salt = await bcrypt.genSalt(10);
    user.passwordHash = await bcrypt.hash(password, salt);

    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;

    await user.save();

    res.status(200).json({ message: "Mot de passe réinitialisé avec succès !" });
  } catch (error) {
    console.error("Erreur resetPassword:", error);
    res.status(500).json({ message: "Erreur serveur" });
  }
};
