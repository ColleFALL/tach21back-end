const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");

dotenv.config();

// Connexion à MongoDB (on gérera la vraie URL plus tard)
// connectDB();

const app = express();

app.use(cors());
app.use(express.json());

// Route test
app.get("/", (req, res) => {
  res.send("API Tache21 backend fonctionne ✅");
});

// Routes utilisateurs
app.use("/api/users", userRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Serveur démarré sur le port ${PORT}`);
});
