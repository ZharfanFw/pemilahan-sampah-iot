/**
 * classifyController.js
 */

const classificationService = require("../services/classificationService");
const { db, setData } = require("../config/firebase");
const logger = require("../utils/logger");

let mqttService = null;
try {
  mqttService = require("../services/mqttService");
} catch (e) {}

const classifyController = {
  classify: async (req, res) => {
    try {
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

      // Simpan gambar terbaru ke disk
      try {
        const fs = require("fs");
        const path = require("path");
        const uploadsDir = path.join(__dirname, "..", "uploads");
        if (!fs.existsSync(uploadsDir))
          fs.mkdirSync(uploadsDir, { recursive: true });
        fs.writeFileSync(path.join(uploadsDir, "latest.jpg"), imageBuffer);
        logger.success("Latest camera image saved!");
      } catch (saveError) {
        logger.error("Failed to save image (non-critical)", saveError);
      }

      if (!classificationService.isReady) {
        return res.status(503).json({
          success: false,
          message: "Classification model not loaded.",
        });
      }

      const result = await classificationService.classify(imageBuffer);
      const timestamp = Date.now();
      const binId = req.query.binId || req.headers["x-bin-id"] || "bin-001";

      // Simpan ke Firebase — SATU-SATUNYA titik tulis ke sampah/
      try {
        await saveClassificationResult(result, timestamp, binId);
      } catch (fbError) {
        logger.error("Failed to save to Firebase (non-critical)", fbError);
      }

      // Publish HANYA ke topik servo — tidak ke topik lain
      try {
        if (mqttService && mqttService.connected) {
          mqttService.publish("smartbin/kontrol/servo", {
            jenis: result.jenis,
            confidence: result.confidence,
            binId,
            timestamp,
          });
        }
      } catch (mqttError) {
        logger.error("Failed to publish to MQTT", mqttError);
      }

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

  getStatus: async (req, res) => {
    try {
      const status = classificationService.getStatus();
      res.json({ success: true, data: status });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: "Failed to get model status",
        error: error.message,
      });
    }
  },
};

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
    source: "esp32cam_http",
    imageUrl: null,
  });

  logger.success(`Waste saved: ${result.jenis} (${wastePath})`);
}

module.exports = classifyController;
