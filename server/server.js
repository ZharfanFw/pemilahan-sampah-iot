require("dotenv").config();
const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs"); // ✅ Ditambahkan: Modul untuk mengecek file di sistem

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// 👇 BARU: Rute "Satpam" Pengecek Umur Gambar 👇
// Ditaruh sebelum express.static agar rute ini dieksekusi lebih dulu
app.get("/uploads/latest.jpg", (req, res) => {
  const filePath = path.join(__dirname, "uploads", "latest.jpg");

  if (fs.existsSync(filePath)) {
    const stats = fs.statSync(filePath);
    const fileAge = Date.now() - stats.mtimeMs; // Hitung umur file (dalam milidetik)

    // Jika gambar tidak diperbarui lebih dari 5 detik, anggap Python offline (Kirim 404)
    if (fileAge > 5000) {
      return res.status(404).send("Kamera Offline (Gambar kedaluwarsa)");
    }

    // Jika masih baru (di bawah 5 detik), kirim gambarnya ke React
    return res.sendFile(filePath);
  }

  return res.status(404).send("Gambar tidak ditemukan");
});

// Serve folder uploads untuk file selain latest.jpg atau jika lolos pengecekan di atas
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Import Routes
const authRoutes = require("./routes/auth");
const classifyRoutes = require("./routes/classify");
const binsRoutes = require("./routes/bins");
const wasteRoutes = require("./routes/waste");

// Import Services
const classificationService = require("./services/classificationService");

require("./services/mqttService");

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
