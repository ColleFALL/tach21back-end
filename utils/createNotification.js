import Notification from "../models/Notification.js";

const createNotification = async ({
  userId,
  category,
  title,
  message,
  redirectUrl = null,
}) => {
  try {
    await Notification.create({
      user: userId,
      category,
      title,
      message,
      redirectUrl,
    });
  } catch (error) {
    console.error("Erreur création notification :", error.message);
  }
};

export default createNotification;
