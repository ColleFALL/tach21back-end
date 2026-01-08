
import "dotenv/config"; //ajouter

import express from "express";
import cors from "cors";

import authRoutes from "./routes/authRoutes.js";    
import accountRoutes from "./routes/accountRoutes.js";
import transactionRoutes from "./routes/transactionRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";
import preferenceRoutes from "./routes/preferenceRoutes.js";
import supportRoutes from "./routes/supportRoutes.js";
import beneficiaryRoutes from "./routes/beneficiaryRoutes.js";
import  ChangementMdp  from "./routes/authRoutes.js";
import notificationRoutes from "./routes/notificationRoutes.js"; 
import cardRoutes from "./routes/cardRoutes.js";

// dotenv.config();
console.log(" MONGO_URI lu par le serveur :", process.env.MONGO_URI);
console.log("MONGO_URI :", process.env.MONGO_URI);
console.log("PORT :", process.env.PORT);
console.log("JWT_SECRET :", process.env.JWT_SECRET);
console.log("SMTP_HOST :", process.env.SMTP_HOST);
console.log("SMTP_USER :", process.env.SMTP_USER);
console.log("SMTP_FROM :", process.env.SMTP_FROM);
console.log("ENV EMAIL_USER =", process.env.EMAIL_USER);
console.log("ENV EMAIL_PASS =", process.env.EMAIL_PASS ? "OK" : "MISSING");


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
app.use("/api/beneficiaries", beneficiaryRoutes); //pour les beneficier
app.use("/uploads", express.static("uploads"));
app.use("/api/notifications", notificationRoutes);
app.post("/ChangementMdp/:token", ChangementMdp);
app.use("/api/cards", cardRoutes); //ajouter 
// Connexion MongoDB
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log(" Connecté à MongoDB"); 
       console.log(" DB utilisée :", mongoose.connection.name);  //  AJOUT

    // Lancement du serveur
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(` Serveur démarré sur le port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error(" Erreur connexion MongoDB :", err.message);
  });



app.get("/api/charts", async (req, res) => {
  try {
    // ===============================
    // TYPES MÉTIER (mêmes que l’historique)
    // ===============================
    const INCOME_TYPES = [
      "DEPOSIT",
      "TRANSFER_INTERNAL_CREDIT",
      "TRANSFER_USER_CREDIT",
    ];

    const EXPENSE_TYPES = [
      "WITHDRAWAL",
      "TRANSFER_INTERNAL_DEBIT",
      "TRANSFER_USER_DEBIT",
      "BILL_PAYMENT",
    ];

    // ===============================
    // 1. LINE CHART (Revenus vs Dépenses par mois)
    // ===============================
    const lineAgg = await Transaction.aggregate([
      {
        $group: {
          _id: { $month: "$createdAt" },

          revenus: {
            $sum: {
              $cond: [{ $in: ["$type", INCOME_TYPES] }, "$amount", 0],
            },
          },

          depenses: {
            $sum: {
              $cond: [{ $in: ["$type", EXPENSE_TYPES] }, "$amount", 0],
            },
          },
        },
      },
      { $sort: { "_id": 1 } },
    ]);

    const MONTHS = [
      "Jan", "Fév", "Mar", "Avr", "Mai", "Jun",
      "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc",
    ];

    const line = lineAgg.map((m) => ({
      month: MONTHS[m._id - 1],
      revenus: m.revenus,
      depenses: m.depenses,
    }));

    // ===============================
    // 2. BAR + PIE (factures depuis l’historique)
    // ===============================
    const billsAgg = await Transaction.aggregate([
      {
        $match: {
          type: "BILL_PAYMENT",
          status: "SUCCESS",
        },
      },
      {
        $group: {
          _id: "$serviceName",
          total: { $sum: "$amount" },
        },
      },
    ]);

    // Correspondance EXACTE avec le frontend
    const CATEGORIES = [
      { label: "Eau", keys: ["eau"] },
      { label: "Électricité", keys: ["electricite", "électricité"] },
      { label: "Internet", keys: ["internet"] },
      { label: "Mobile", keys: ["mobile", "telephone", "tel"] },
    ];

    const bar = CATEGORIES.map((cat) => {
      const found = billsAgg.find((b) =>
        cat.keys.some((k) =>
          (b._id || "").toLowerCase().includes(k)
        )
      );

      return {
        name: cat.label,
        value: found ? found.total : 0,
      };
    });

    const pie = bar.map((b) => ({
      name: b.name,
      value: b.value,
    }));

    // ===============================
    // RESPONSE
    // ===============================
    res.json({ line, bar, pie });
  } catch (error) {
    console.error("Erreur charts :", error);
    res.status(500).json({
      message: "Erreur lors du chargement des graphiques",
    });
  }
});

import mongoose from "mongoose";
import Transaction from "./models/Transaction.js";
