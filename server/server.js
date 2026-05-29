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
const classifyRoutes = require("./routes/classify"); // Route klasifikasi sampah

// Import Classification Service
const classificationService = require("./services/classificationService");

// Gunakan Routes
app.use("/api/auth", authRoutes);
app.use("/api/classify", classifyRoutes); // ESP32-CAM kirim gambar ke sini

// Test Route Utama
app.get("/", (req, res) => {
  res.send("API SmartBin Server Running...");
});

app.listen(PORT, async () => {
  console.log(
    `🚀 Server berjalan dengan aman di port http://localhost:${PORT}`,
  );

  // Load ML model saat startup (async, tidak block server)
  console.log("🤖 Loading classification model...");
  const modelLoaded = await classificationService.loadModel();
  if (modelLoaded) {
    console.log("✅ Classification model ready!");
    console.log(`   Endpoint: POST http://localhost:${PORT}/api/classify`);
  } else {
    console.log("⚠️  Classification model not available.");
    console.log("   Run: cd model && python train_model.py");
  }
});
