// controllers/beneficiaryController.js
import Beneficiary from "../models/Beneficiary.js";

// POST /api/beneficiaries
export const createBeneficiary = async (req, res) => {
  try {
    const { name, bankName, bankCode, accountNumber, linkedUser, type } = req.body;

    if (!name || !accountNumber) {
      return res
        .status(400)
        .json({ message: "Le nom et le numéro de compte sont obligatoires" });
    }

    const beneficiary = await Beneficiary.create({
      user: req.user.id,
      name,
      bankName,
      bankCode,
      accountNumber,
      linkedUser: linkedUser || null,
      type: type || "EXTERNAL",
    });

    return res.status(201).json({ message: "Bénéficiaire créé", beneficiary });
  } catch (error) {
    console.error("Erreur createBeneficiary :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};

// GET /api/beneficiaries
export const getBeneficiaries = async (req, res) => {
  try {
    const beneficiaries = await Beneficiary.find({ user: req.user.id }).sort({
      createdAt: -1,
    });
    return res.json({ beneficiaries });
  } catch (error) {
    console.error("Erreur getBeneficiaries :", error.message);
    return res.status(500).json({ message: "Erreur serveur", error: error.message });
  }
};
