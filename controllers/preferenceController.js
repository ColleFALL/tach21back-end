// controllers/preferenceController.js
import User from "../models/User.js";

// GET /api/preferences
export const getPreferences = async (req, res) => {
  try {
    const user = await User.findById(req.userId).select("preferences");

    return res.status(200).json({
      message: "Préférences récupérées avec succès",
      preferences: user.preferences,
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur" });
  }
};

// PUT /api/preferences
export const updatePreferences = async (req, res) => {
  try {
    const { language, notifications } = req.body;
    const user = await User.findById(req.userId);

    if (language) user.preferences.language = language;
    if (notifications) {
      user.preferences.notifications = {
        ...user.preferences.notifications,
        ...notifications,
      };
    }

    await user.save();

    return res.status(200).json({
      message: "Préférences mises à jour avec succès",
      preferences: user.preferences,
    });
  } catch (err) {
    return res.status(500).json({ message: "Erreur serveur" });
  }
};
