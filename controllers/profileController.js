// controllers/profileController.js
import User from "../models/User.js";
import bcrypt from "bcrypt";

// 🔹 GET /api/profile
export const getProfile = async (req, res) => {
  try {
    const userId = req.userId; // vient du authMiddleware

    const user = await User.findById(userId).select(
      "fullName email phone avatarUrl role createdAt"
    );

    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    return res.status(200).json({
      message: "Profil récupéré avec succès",
      profile: user,
    });
  } catch (error) {
    console.error("Erreur getProfile :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la récupération du profil",
      error: error.message,
    });
  }
};

// 🔹 PUT /api/profile
export const updateProfile = async (req, res) => {
  try {
    const userId = req.userId;
    const { fullName, phone, avatarUrl } = req.body;

    if (!fullName && !phone && !avatarUrl) {
      return res.status(400).json({
        message:
          "Aucune donnée à mettre à jour (fullName, phone ou avatarUrl requis)",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    if (fullName) user.fullName = fullName;
    if (phone) user.phone = phone;
    if (avatarUrl) user.avatarUrl = avatarUrl;

    await user.save();

    return res.status(200).json({
      message: "Profil mis à jour avec succès",
      profile: {
        id: user._id,
        fullName: user.fullName,
        email: user.email,
        phone: user.phone,
        avatarUrl: user.avatarUrl,
        role: user.role,
      },
    });
  } catch (error) {
    console.error("Erreur updateProfile :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la mise à jour du profil",
      error: error.message,
    });
  }
};

// 🔹 PUT /api/profile/change-password
export const changePassword = async (req, res) => {
  try {
    const userId = req.userId;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({
        message: "oldPassword et newPassword sont obligatoires",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    const isMatch = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isMatch) {
      return res
        .status(401)
        .json({ message: "Ancien mot de passe incorrect" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    user.passwordHash = hashed;

    await user.save();

    return res.status(200).json({
      message: "Mot de passe mis à jour avec succès",
    });
  } catch (error) {
    console.error("Erreur changePassword :", error);
    return res.status(500).json({
      message: "Erreur serveur lors du changement de mot de passe",
      error: error.message,
    });
  }
};

// 🔹 (Optionnel) POST /api/profile/set-pin
export const setPin = async (req, res) => {
  try {
    const userId = req.userId;
    const { pin } = req.body;

    if (!pin) {
      return res.status(400).json({ message: "Le PIN est obligatoire" });
    }

    // simple validation : 4 chiffres
    const pinRegex = /^[0-9]{4}$/;
    if (!pinRegex.test(pin)) {
      return res.status(400).json({
        message: "Le PIN doit être un code à 4 chiffres",
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Utilisateur non trouvé" });
    }

    // On peut le stocker en clair ou hashé. Pour une vraie app, mieux vaut hasher.
    user.pin = pin;
    await user.save();

    return res.status(200).json({
      message: "PIN défini/mis à jour avec succès",
    });
  } catch (error) {
    console.error("Erreur setPin :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de la mise à jour du PIN",
      error: error.message,
    });
  }
};

//fonction pour le photo de profile
export const updateAvatar = async (req, res) => {
  try {
    const userId = req.userId;

    if (!req.file) {
      return res.status(400).json({ message: "Aucun fichier envoyé" });
    }

    const avatarUrl = `/uploads/${req.file.filename}`;

    const user = await User.findById(userId);
    user.avatarUrl = avatarUrl;
    await user.save();

    res.status(200).json({
      message: "Photo de profil mise à jour",
      avatarUrl,
    });
  } catch (error) {
    res.status(500).json({
      message: "Erreur lors de la mise à jour de l'avatar",
      error: error.message,
    });
  }
};

