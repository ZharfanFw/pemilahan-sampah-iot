/**
 * bins.js (routes)
 * ================
 * Route untuk endpoint tempat sampah (bins).
 * Mengambil status, daftar, alert, dan konfigurasi kalibrasi.
 */

const express = require("express");
const router = express.Router();
const binController = require("../controllers/binController");
const admin = require("firebase-admin");
const mqttService = require("../services/mqttService"); // 1. Import langsung service MQTT kamu di sini

/**
 * GET /api/bins
 * Mendapatkan daftar semua bin.
 */
router.get("/", binController.getAllBins);

/**
 * GET /api/bins/status?binId=bin-001
 * Mendapatkan status satu bin.
 */
router.get("/status", binController.getStatus);

/**
 * GET /api/bins/alerts?binId=bin-001&resolved=false
 * Mendapatkan alert/peringatan bin.
 */
router.get("/alerts", binController.getAlerts);

/**
 * POST /api/bins/level
 * Mengupdate data kedalaman dan tingkat kepenuhan bin dari ESP32-CAM.
 */
router.post("/level", binController.updateLevel);

/**
 * POST /api/bins/config
 * Mengupdate konfigurasi kalibrasi sensor ultrasonik dari Web Dashboard ke Firebase & ESP32.
 */
router.post("/config", async (req, res) => {
  const { binId, tinggiMaks, batasPenuh } = req.body;

  if (!binId || !tinggiMaks || !batasPenuh) {
    return res
      .status(400)
      .json({ success: false, message: "Data tidak lengkap" });
  }

  try {
    const db = admin.database();

    // 2. Simpan konfigurasi kalibrasi ke Firebase Realtime Database
    await db.ref(`smartbin/config/${binId}`).set({
      tinggi_maks: Number(tinggiMaks),
      batas_penuh: Number(batasPenuh),
      updatedAt: admin.database.ServerValue.TIMESTAMP,
    });

    // 3. Gunakan fungsi publish bawaan dari mqttService kamu
    // Fungsi ini otomatis mengubah object menjadi string JSON di dalamnya
    mqttService.publish("smartbin/kontrol/config", {
      binId: binId,
      tinggiMaks: Number(tinggiMaks),
      batasPenuh: Number(batasPenuh),
    });

    return res
      .status(200)
      .json({
        success: true,
        message:
          "Kalibrasi berhasil diperbarui di Firebase dan dikirim ke ESP32 via MQTT!",
      });
  } catch (error) {
    console.error("Gagal simpan config:", error);
    return res.status(500).json({ success: false, message: error.message });
  }
});

module.exports = router;
