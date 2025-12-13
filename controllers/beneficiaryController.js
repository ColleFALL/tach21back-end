// controllers/beneficiaryController.js
import Beneficiary from "../models/Beneficiary.js";
import User from "../models/User.js";

// POST /api/beneficiaries
export const createBeneficiary = async (req, res) => {
  try {
    const { name, bankName, bankCode, accountNumber } = req.body;

    if (!name || !accountNumber) {
      return res
        .status(400)
        .json({ message: "Le nom et le numéro de compte sont obligatoires" });
    }

    const normalized = String(accountNumber).trim();

    // ✅ Détection : est-ce un user interne (même banque) ?
    const internalUser = await User.findOne({ phone: normalized });

    const beneficiary = await Beneficiary.create({
      user: req.user.id,
      name,
      bankName,
      bankCode,
      accountNumber: normalized,
      linkedUser: internalUser ? internalUser._id : null,
      type: internalUser ? "INTERNAL" : "EXTERNAL",
    });

    return res.status(201).json({ message: "Bénéficiaire créé", beneficiary });
  } catch (error) {
    console.error("Erreur createBeneficiary :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// GET /api/beneficiaries
export const getBeneficiary = async (req, res) => {
  try {
    const beneficiary = await Beneficiary.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    return res.json({ beneficiary });
  } catch (error) {
    console.error("Erreur getBeneficiary :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
