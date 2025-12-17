// controllers/beneficiaryController.js
import Beneficiary from "../models/Beneficiary.js";
import User from "../models/User.js";

// POST /api/beneficiaries
// POST /api/beneficiaries
export const createBeneficiary = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;
    if (!userId) return res.status(401).json({ message: "Accès non autorisé" });

    const { name, bankName, bankCode, accountNumber } = req.body;

    if (!name || !accountNumber) {
      return res.status(400).json({ message: "Le nom et le numéro de compte sont obligatoires" });
    }

    const normalized = String(accountNumber).trim();

    // ✅ On n'accepte que des bénéficiaires internes (doit exister dans User)
    const internalUser = await User.findOne({ phone: normalized });
    if (!internalUser) {
      return res.status(404).json({
        message: "le beneficiaire n'a pas de compte Wethio (transfert refusé)",
      });
    }

    // ✅ éviter doublon
    const exists = await Beneficiary.findOne({ user: userId, accountNumber: normalized });
    if (exists) {
      return res.status(409).json({ message: "Bénéficiaire déjà existant", beneficiary: exists });
    }

    const beneficiary = await Beneficiary.create({
      user: userId,
      name,
      bankName,
      bankCode,
      accountNumber: normalized,
      linkedUser: internalUser._id,
      type: "INTERNAL",
    });

    return res.status(201).json({ message: "Bénéficiaire interne créé", beneficiary });
  } catch (error) {
    console.error("Erreur createBeneficiary :", error);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};


// GET /api/beneficiaries
export const getBeneficiary = async (req, res) => {
  try {
    const userId = req.user?.id || req.userId;

    if (!userId) {
      return res.status(401).json({ message: "Accès non autorisé" });
    }

    const beneficiary = await Beneficiary.find({ user: userId }).sort({
      createdAt: -1,
    });

    // ✅ On garde ta réponse: { beneficiary }
    return res.json({ beneficiary });
  } catch (error) {
    console.error("Erreur getBeneficiary :", error);
    return res
      .status(500)
      .json({ message: "Erreur serveur", error: error.message });
  }
};
