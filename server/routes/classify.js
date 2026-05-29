/**
 * classify.js (routes)
 * ====================
 * Route untuk endpoint klasifikasi sampah via HTTP.
 * ESP32-CAM mengirim gambar JPEG mentah ke endpoint ini.
 */

const express = require("express");
const router = express.Router();
const classifyController = require("../controllers/classifyController");

/**
 * POST /api/classify
 *
 * Menerima raw JPEG image dari ESP32-CAM.
 * Content-Type harus "image/jpeg".
 * Body berisi raw binary JPEG data (bukan base64, bukan multipart).
 *
 * Query params (optional):
 *   - binId: ID tempat sampah (default: "bin-001")
 *
 * Headers (optional):
 *   - X-Bin-Id: ID tempat sampah (alternative to query param)
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "jenis": "Organik",
 *     "confidence": 0.95,
 *     "inference_time_ms": 120
 *   }
 * }
 */
router.post(
  "/",
  express.raw({ type: "image/jpeg", limit: "5mb" }),
  classifyController.classify,
);

/**
 * GET /api/classify/status
 *
 * Cek status model klasifikasi (apakah sudah loaded, info model, dll).
 */
router.get("/status", classifyController.getStatus);

module.exports = router;
