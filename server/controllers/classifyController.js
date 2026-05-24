/**
 * classifyController.js
 * =====================
 * Controller untuk endpoint klasifikasi sampah.
 * Menerima gambar JPEG dari ESP32-CAM, klasifikasi menggunakan model ML,
 * simpan hasil ke Firebase, dan publish ke MQTT.
 */

const classificationService = require("../services/classificationService");
const { db, setData, updateData } = require("../config/firebase");
const logger = require("../utils/logger");

// Optional: import MQTT service jika tersedia
let mqttService = null;
try {
  mqttService = require("../services/mqttService");
} catch (e) {
  // MQTT service mungkin belum aktif
}

const classifyController = {
  /**
   * POST /api/classify
   *
   * Menerima gambar JPEG mentah dari ESP32-CAM.
   * Content-Type: image/jpeg
   * Body: raw binary JPEG data
   *
   * Response:
   * {
   *   success: true,
   *   data: {
   *     jenis: "Organik" | "Anorganik",
   *     confidence: 0.95,
   *     inference_time_ms: 120
   *   }
   * }
   */
  classify: async (req, res) => {
    try {
      // Validate request body
      if (!req.body || req.body.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No image data received. Send raw JPEG in request body.",
        });
      }

      const imageBuffer = req.body;
      logger.info(
        `Received image for classification: ${imageBuffer.length} bytes`,
      );

      // Check if model is ready
      if (!classificationService.isReady) {
        return res.status(503).json({
          success: false,
          message:
            "Classification model is not loaded. Please train and deploy the model first.",
        });
      }

      // Run classification
      const result = await classificationService.classify(imageBuffer);

      // Save to Firebase
      const timestamp = Date.now();
      const binId = req.query.binId || req.headers["x-bin-id"] || "bin-001";

      try {
        await saveClassificationResult(result, timestamp, binId);
      } catch (fbError) {
        logger.error("Failed to save to Firebase (non-critical)", fbError);
      }

      // Publish to MQTT
      try {
        if (mqttService && mqttService.connected) {
          mqttService.publish("smartbin/classification", {
            jenis: result.jenis,
            confidence: result.confidence,
            binId,
            timestamp,
          });
        }
      } catch (mqttError) {
        logger.error("Failed to publish to MQTT (non-critical)", mqttError);
      }

      // Send response to ESP32-CAM
      res.json({
        success: true,
        data: {
          jenis: result.jenis,
          confidence: result.confidence,
          inference_time_ms: result.inference_time_ms,
        },
      });
    } catch (error) {
      logger.error("Classification endpoint error", error);
      res.status(500).json({
        success: false,
        message: "Classification failed",
        error: error.message,
      });
    }
  },

  /**
   * GET /api/classify/status
   *
   * Check status model klasifikasi.
   */
  getStatus: async (req, res) => {
    try {
      const status = classificationService.getStatus();
      res.json({
        success: true,
        data: status,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get model status",
        error: error.message,
      });
    }
  },
};

/**
 * Simpan hasil klasifikasi ke Firebase Realtime Database.
 * Mengikuti struktur yang sama dengan mqttService.handleClassification().
 */
async function saveClassificationResult(result, timestamp, binId) {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  const wasteId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  const wastePath = `sampah/${year}-${month}/${day}/${wasteId}`;

  await setData(wastePath, {
    jenis: result.jenis,
    confidence: result.confidence,
    timestamp,
    binId,
    source: "esp32cam_http", // Distinguish from MQTT-based classification
    imageUrl: null,
  });

  logger.success(`Waste saved to Firebase: ${result.jenis} (${wastePath})`);

  // Update bin stats
  try {
    const statsRef = db.ref(`bins/${binId}/stats/today`);
    const snapshot = await statsRef.once("value");
    const stats = snapshot.val() || { total: 0, organik: 0, anorganik: 0 };

    stats.total += 1;
    if (result.jenis === "Organik") {
      stats.organik += 1;
    } else if (result.jenis === "Anorganik") {
      stats.anorganik += 1;
    }

    await statsRef.update(stats);
  } catch (statsError) {
    logger.error("Failed to update bin stats", statsError);
  }
}

module.exports = classifyController;
