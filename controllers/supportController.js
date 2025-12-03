// controllers/supportController.js
import ContactMessage from "../models/ContactMessage.js";

export const createContactMessage = async (req, res) => {
  try {
    const { name, email, message } = req.body;

    // 1️⃣ Validation des champs
    if (!name || !email || !message) {
      return res.status(400).json({
        message: "Les champs name, email et message sont obligatoires",
      });
    }

    // Optionnel : petite validation simple de l'email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        message: "L'email fourni n'est pas valide",
      });
    }

    // 2️⃣ Enregistrer en base
    const contact = await ContactMessage.create({
      name,
      email,
      message,
    });

    // 3️⃣ Réponse au frontend
    return res.status(201).json({
      message: "Votre message a bien été reçu. Nous vous répondrons prochainement.",
      contactId: contact._id,
    });
  } catch (error) {
    console.error("Erreur createContactMessage :", error);
    return res.status(500).json({
      message: "Erreur serveur lors de l'envoi du message de contact",
      error: error.message,
    });
  }
};
