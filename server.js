// server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import userRoutes from "./routes/userRoutes.js";


// import authRoutes from "./routes/authRoutes.js";        // si tu l'as déjà
import accountRoutes from "./routes/accountRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";

dotenv.config();
console.log("🔑 MONGO_URI lu par le serveur :", process.env.MONGO_URI);

const app = express();

// routes pour les tests ajouter mercredi
// app.use("/api/auth", authRoutes);           // pour register/login (collègue)
app.use("/api/accounts", accountRoutes);    // pour les comptes
app.use("/api/transactions", transactionRoutes); // pour les transactions

// Middlewares
app.use(cors());
app.use(express.json());

// Connexion MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log("✅ Connecté à MongoDB");
       console.log("📌 DB utilisée :", mongoose.connection.name);  // 👈 AJOUT

    // Routes
    app.use("/api", userRoutes);
    // app.use("/api", testRoutes);

    // Lancement du serveur
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`🚀 Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error("❌ Erreur connexion MongoDB :", err.message);
  });
