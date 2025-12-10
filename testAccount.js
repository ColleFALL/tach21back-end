// testAccountModel.js
import mongoose from "mongoose";
import dotenv from "dotenv";
// import User from "./models/User.js";
import User from "./models/User.js"
import Account from "./models/Account.js";

dotenv.config();

const MONGO_URI = process.env.MONGO_URI;

const testAccountModel = async () => {
  try {
    // 1. Connexion MongoDB
    await mongoose.connect(MONGO_URI);
    console.log("✅ MongoDB connecté");

    // 2. Récupérer un user existant ou en créer un
    let user = await User.findOne();

    if (!user) {
      console.log("ℹ️ Aucun user trouvé, création d'un user de test…");
      user = await User.create({
        name: "User Account Test",
        email: "accounttest@example.com",
        password: "password123"
      });
    }

    console.log("👤 User utilisé :", user._id.toString());

    // 3. Créer un compte pour ce user
    const account = await Account.create({
      user: user._id,
      number: "ACC-" + Date.now(),
      type: "COURANT",
      balance: 50000,
      currency: "XOF"
    });

    console.log("✅ Compte créé :", account);

    // 4. Lire les comptes avec le user populé
    const accounts = await Account.find().populate("user", "name email");
    console.log("📂 Tous les comptes :", accounts);

    // 5. Fermer la connexion
    await mongoose.connection.close();
    console.log("🔚 Connexion fermée");
  } catch (err) {
    console.error("❌ Erreur testAccountModel :", err.message);
    await mongoose.connection.close();
  }
};

testAccountModel();
