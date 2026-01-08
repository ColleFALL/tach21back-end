import Notification from "../models/Notification.js";

// 🔔 Récupérer toutes les notifications de l'utilisateur
export const getUserNotifications = async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.user.id,
    }).sort({ createdAt: -1 });

    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ message: "Erreur récupération notifications" });
  }
};

// 🔴 Compter les notifications non lues
export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      user: req.user.id,
      isRead: false,
    });

    res.status(200).json({ count });
  } catch (error) {
    res.status(500).json({ message: "Erreur compteur notifications" });
  }
};

// ✅ Marquer une notification comme lue
export const markAsRead = async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { isRead: true },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ message: "Notification introuvable" });
    }

    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ message: "Erreur mise à jour notification" });
  }
};
