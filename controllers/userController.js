const User = require("../models/User");

// Exemple simple : récupérer tous les utilisateurs
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select("-password");
    res.json(users);
  } catch (error) {
    console.error("Erreur getUsers :", error.message);
    res.status(500).json({ message: "Erreur serveur" });
  }
};

module.exports = {
  getUsers
};
