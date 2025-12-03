import jwt from "jsonwebtoken";
import User from "../models/User.js";

export const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Authorization header reçu :", req.headers.authorization);


    // Pas de token ?
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Accès non autorisé" });
    }

    const token = authHeader.split(" ")[1];

    // Vérifier token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Récupérer l'utilisateur
    const user = await User.findById(decoded.id).select("-passwordHash");

    if (!user) {
      return res.status(401).json({ message: "Utilisateur introuvable" });
    }

    req.user = user; // 👈 très important
    next();
  } catch (error) {
    return res.status(401).json({ message: "Token invalide", error: error.message });
  }
};
