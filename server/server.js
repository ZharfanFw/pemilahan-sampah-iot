require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get("/uploads/latest.jpg", (req, res) => {
  const filePath = path.join(__dirname, "uploads", "latest.jpg");
  if (fs.existsSync(filePath)) {
    // Selalu kirim gambar terakhir, tanpa cek umur file
    // Dashboard menampilkan gambar terakhir yang di-capture ESP32-CAM
    res.set("Cache-Control", "no-cache, no-store, must-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");
    return res.sendFile(filePath);
  }
  return res.status(404).send("Gambar tidak ditemukan");
});

app.use("/uploads", express.static(path.join(__dirname, "uploads")));

const authRoutes = require("./routes/auth");
const classifyRoutes = require("./routes/classify");
const binsRoutes = require("./routes/bins");
const wasteRoutes = require("./routes/waste");

const classificationService = require("./services/classificationService");
const { startBroker } = require("./config/aedesBroker");
const mqttService = require("./services/mqttService");

app.use("/api/auth", authRoutes);
app.use("/api/classify", classifyRoutes);
app.use("/api/bins", binsRoutes);
app.use("/api/waste", wasteRoutes);

app.get("/", (req, res) => res.send("API SmartBin Server Running..."));

app.listen(PORT, async () => {
  console.log(`🚀 Server berjalan di http://localhost:${PORT}`);

  // 1. Broker dulu
  await startBroker();

  // 2. Baru client connect ke broker
  mqttService.connect();
  console.log("📡 MQTT Client connecting...");

  // 3. Load model AI
  console.log("🤖 Memulai load model AI...");
  await classificationService.loadModel();
  console.log("✅ Model siap!");
});
