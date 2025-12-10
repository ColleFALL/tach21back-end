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
console.log("MONGO_URI :", process.env.MONGO_URI);
console.log("PORT :", process.env.PORT);
console.log("JWT_SECRET :", process.env.JWT_SECRET);
console.log("SMTP_HOST :", process.env.SMTP_HOST);
console.log("SMTP_USER :", process.env.SMTP_USER);
console.log("SMTP_FROM :", process.env.SMTP_FROM);


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

// app.get("/api/health", (req, res) => {
//   res.json({ status: "ok", message: "Backend Tache21 fonctionne sur Render" });
// });


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

  // Route temporaire pour les graphiques
app.get("/api/charts", (req, res) => {
  const line = [
    { month: "Jan", revenus: 4000, depenses: 2500 },
    { month: "Fév", revenus: 3000, depenses: 1400 },
    { month: "Mar", revenus: 5000, depenses: 3500 },
    { month: "Avr", revenus: 4500, depenses: 3600 },
    { month: "Mai", revenus: 6000, depenses: 4700 },
    { month: "Jun", revenus: 5500, depenses: 3600 },
  ];

  const bar = [
    { name: "Alimentation", value: 850 },
    { name: "Transport", value: 400 },
    { name: "Logement", value: 1200 },
    { name: "Loisirs", value: 350 },
    { name: "Santé", value: 280 },
  ];

  const pie = [
    { name: "Dépenses", value: 3130 },
    { name: "Revenus", value: 5500 },
  ];

  res.json({ line, bar, pie });
});
