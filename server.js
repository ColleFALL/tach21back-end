// server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import mongoose from "mongoose";
import authRoutes from "./routes/authRoutes.js";    
import accountRoutes from "./routes/accountRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import preferenceRoutes from "./routes/preferenceRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import beneficiaryRoutes from "./routes/beneficiaryRoutes.js";

dotenv.config();
console.log(" MONGO_URI lu par le serveur :", process.env.MONGO_URI);

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());

// routes des api
app.use("/api/auth", authRoutes);           // pour register/login (collègue)
app.use("/api/accounts", accountRoutes);    // pour les comptes
app.use("/api/transactions", transactionRoutes); // pour les transactions 
app.use("/api", profileRoutes); //pour le parametre et profile
app.use("/api", preferenceRoutes); //pour les pereferences
app.use("/api", supportRoutes);   // pour le support des mssages
app.use("/api/beneficiary", beneficiaryRoutes); //pour les beneficier
 app.use("/uploads", express.static("uploads"));



// Connexion MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(" Connecté à MongoDB"); 
       console.log(" DB utilisée :", mongoose.connection.name);  // 👈 AJOUT

    // Lancement du serveur
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(` Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(" Erreur connexion MongoDB :", err.message);
  });
