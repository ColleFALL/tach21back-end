import Card from "../models/Card.js";
import User from "../models/User.js";

const genLast4 = () => String(Math.floor(1000 + Math.random() * 9000));

export const getMyCard = async (req, res) => {
  try {
    let card = await Card.findOne({ user: req.userId });

    // ✅ Auto-création si aucune carte
    if (!card) {
      const user = await User.findById(req.userId).select("fullName");
      if (!user) {
        return res.status(404).json({ message: "Utilisateur introuvable" });
      }

      const now = new Date();
      const expiryYear = now.getFullYear() + 3;

      card = await Card.create({
        user: req.userId,
        brand: "VISA",
        last4: genLast4(),
        expiryMonth: 12,
        expiryYear,
        status: "ACTIVE",
        cardholderName: user.fullName || "Client",
      });
    }

    return res.json({ card });
  } catch (e) {
    console.error("getMyCard error:", e);
    return res.status(500).json({ message: "Erreur récupération carte" });
  }
};

// (Optionnel) Si tu veux un endpoint création manuelle.
// Avec auto-création dans getMyCard, tu peux ne plus l'utiliser.
export const createMyCard = async (req, res) => {
  try {
    const exists = await Card.findOne({ user: req.userId });
    if (exists) {
      return res
        .status(409)
        .json({ message: "Carte déjà existante", card: exists });
    }

    const user = await User.findById(req.userId).select("fullName");
    if (!user) return res.status(404).json({ message: "Utilisateur introuvable" });

    const now = new Date();
    const expiryYear = now.getFullYear() + 3;

    const card = await Card.create({
      user: req.userId,
      brand: "VISA",
      last4: genLast4(),
      expiryMonth: 12,
      expiryYear,
      status: "ACTIVE",
      cardholderName: user.fullName || "Client",
    });

    return res.status(201).json({ message: "Carte créée", card });
  } catch (e) {
    console.error("createMyCard error:", e);
    return res.status(500).json({ message: "Erreur création carte" });
  }
};

export const toggleFreeze = async (req, res) => {
  try {
    const card = await Card.findOne({ _id: req.params.id, user: req.userId });
    if (!card) return res.status(404).json({ message: "Carte introuvable" });

    if (card.status === "BLOCKED") {
      return res
        .status(400)
        .json({ message: "Carte bloquée, action impossible" });
    }

    card.status = card.status === "FROZEN" ? "ACTIVE" : "FROZEN";
    await card.save();

    return res.json({ message: "Statut mis à jour", card });
  } catch (e) {
    console.error("toggleFreeze error:", e);
    return res.status(500).json({ message: "Erreur freeze/unfreeze" });
  }
};

export const blockCard = async (req, res) => {
  try {
    const card = await Card.findOne({ _id: req.params.id, user: req.userId });
    if (!card) return res.status(404).json({ message: "Carte introuvable" });

    card.status = "BLOCKED";
    await card.save();

    return res.json({ message: "Carte bloquée", card });
  } catch (e) {
    console.error("blockCard error:", e);
    return res.status(500).json({ message: "Erreur blocage carte" });
  }
};

export const updateCardLimits = async (req, res) => {
  try {
    const { daily, monthly } = req.body;

    // validations simples
    if (daily !== undefined) {
      const d = Number(daily);
      if (Number.isNaN(d) || d < 0) {
        return res.status(400).json({ message: "daily invalide" });
      }
    }
    if (monthly !== undefined) {
      const m = Number(monthly);
      if (Number.isNaN(m) || m < 0) {
        return res.status(400).json({ message: "monthly invalide" });
      }
    }

    const card = await Card.findOne({ _id: req.params.id, user: req.userId });
    if (!card) return res.status(404).json({ message: "Carte introuvable" });

    if (card.status === "BLOCKED") {
      return res.status(400).json({ message: "Carte bloquée, action impossible" });
    }

    // règle : monthly >= daily (optionnel mais logique)
    const newDaily = daily !== undefined ? Number(daily) : card.limits?.daily;
    const newMonthly = monthly !== undefined ? Number(monthly) : card.limits?.monthly;
    if (newDaily !== undefined && newMonthly !== undefined && newMonthly < newDaily) {
      return res.status(400).json({ message: "monthly doit être >= daily" });
    }

    card.limits = {
      daily: newDaily,
      monthly: newMonthly,
    };
    
    if (!card.cardholderName) card.cardholderName = "Client";


    await card.save();
    return res.json({ message: "Limites mises à jour", card });
  } catch (e) {
    console.error("updateCardLimits error:", e);
    return res.status(500).json({ message: "Erreur mise à jour limites" });
  }
};

