require("dotenv").config();
const express = require("express");
const cors = require("cors"); // Pastikan sudah npm install cors

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); // Supaya server bisa membaca req.body berupa JSON

// Import Routes
const authRoutes = require("./routes/auth"); // Mengarah ke server/routes/auth.js

// Gunakan Routes
app.use("/api/auth", authRoutes);

// Test Route Utama
app.get("/", (req, res) => {
  res.send("API SmartBin Server Running...");
});

app.listen(PORT, () => {
  console.log(
    `🚀 Server berjalan dengan aman di port http://localhost:${PORT}`,
  );
});
