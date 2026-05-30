require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Import Routes
const authRoutes = require("./routes/auth");
const classifyRoutes = require("./routes/classify");
const binsRoutes = require("./routes/bins");
const wasteRoutes = require("./routes/waste");

// Import Classification Service
const classificationService = require("./services/classificationService");

// Gunakan Routes
app.use("/api/auth", authRoutes);
app.use("/api/classify", classifyRoutes);
app.use("/api/bins", binsRoutes);
app.use("/api/waste", wasteRoutes);

// Test Route Utama
app.get("/", (req, res) => {
  res.send("API SmartBin Server Running...");
});

// Jalankan Server & Load AI
app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
  console.log("🤖 Memulai load model AI di worker thread...");

  // Tidak perlu setTimeout — worker thread tidak memblokir login/dashboard
  await classificationService.loadModel();
  console.log("✅ Worker thread siap!");
});
