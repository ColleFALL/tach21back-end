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

//ajouter fonction pour activer ou desactiver alerte
// export const updateEmailNotification = async (req, res) => {
//   try {
//     const userId = req.user.id;
//     const { emailNotifications } = req.body;

//     const user = await User.findByIdAndUpdate(
//       userId,
//       { emailNotifications },
//       { new: true }
//     );

//     res.status(200).json({
//       success: true,
//       message: emailNotifications
//         ? "Alertes email activées"
//         : "Alertes email désactivées",
//       emailNotifications: user.emailNotifications,
//     });
//   } catch (error) {
//     res.status(500).json({
//       success: false,
//       message: "Erreur lors de la mise à jour",
//     });
//   }
// };

