// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";

export const authMiddleware = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Authorization header reçu :", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res
        .status(401)
        .json({ message: "Accès non autorisé (pas de Bearer)" });
    }

    const token = authHeader.split(" ")[1];

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token décodé :", decoded);

    // ✅ On récupère l'ID dans le token (userId, id ou _id)
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Token invalide (id manquant dans le token)" });
    }

    // ✅ On stocke l'ID utilisateur dans la requête
    req.userId = userId.toString();7777777777777777777777777777777777777777
    console.log("✅ Utilisateur authentifié (userId) :", req.userId);

    next();
  } catch (error) {
    console.error("Erreur authMiddleware :", error.message);
    return res
      .status(401)
      .json({ message: "Token invalide", error: error.message });
  }
};
