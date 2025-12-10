// middlewares/authMiddleware.js
import jwt from "jsonwebtoken";

// 🔹 Middleware générique (si tu l'utilises ailleurs)
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
    req.userId = userId.toString();
    // ✅ On stocke l'ID utilisateur dans la requête (compatibilité)
    req.userId = userId.toString();
    // On peut aussi peupler req.user si besoin
    req.user = { id: userId.toString(), userId: userId.toString() };

git 
    console.log("✅ Utilisateur authentifié (userId) :", req.userId);

    next();
  } catch (error) {
    console.error("Erreur authMiddleware :", error.message);
    return res
      .status(401)
      .json({ message: "Token invalide", error: error.message });
  }
};

// 🔹 Middleware requireAuth (celui utilisé sur les routes transactions)
export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    console.log("Authorization header reçu :", authHeader);

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Token manquant ou invalide" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log("Token décodé :", decoded);

    // ✅ Même logique que authMiddleware : on extrait l'id proprement
    const userId = decoded.userId || decoded.id || decoded._id;

    if (!userId) {
      return res
        .status(401)
        .json({ message: "Token invalide (id manquant dans le token)" });
    }

    // ✅ On fixe bien req.user avec une propriété "id"
    req.user = {
      id: userId.toString(),
      userId: userId.toString(), // si tu veux garder ce nom aussi
    };

    // ✅ Pour compatibilité avec tes anciens logs
    req.userId = userId.toString();

    console.log("✅ Utilisateur authentifié (userId) :", req.userId);
    next();
  } catch (error) {
    console.error("Erreur auth middleware :", error.message);
    return res
      .status(401)
      .json({ message: "Non autorisé", error: error.message });
  }
};
