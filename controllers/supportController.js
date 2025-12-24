
import { transporter } from "../utils/mailer.js";
import User from "../models/User.js";
import mongoose from "mongoose";

export const contactSupport = async (req, res) => {
  try {
    const { subject, message } = req.body;

    if (!message) {
      return res.status(400).json({ message: "Le message est obligatoire" });
    }

    //  récupérer userId quel que soit le middleware
    const userId = req.userId || req.user?.id || req.user?._id;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(401).json({ message: "Utilisateur non authentifié (token invalide ou manquant)" });
    }

    const user = await User.findById(userId).select("fullName email");

    if (!user) {
      return res.status(404).json({ message: "Utilisateur introuvable" });
    }

    await transporter.sendMail({
      from: `"WECCO Support" <${process.env.EMAIL_USER}>`,
      to: process.env.EMAIL_USER,
      replyTo: user.email,
      subject: `[Support] ${subject || "Nouveau message"}`,
      html: `
        <h3>Nouveau message de support</h3>
        <p><strong>Nom :</strong> ${user.fullName || "Non renseigné"}</p>
        <p><strong>Email :</strong> ${user.email}</p>
        <hr />
        <p>${message}</p>
      `,
    });

    return res.json({ message: "Message envoyé au support" });
  } catch (error) {
    console.error("contactSupport error:", error);
    return res.status(500).json({ message: "Erreur envoi email" });
  }
};

