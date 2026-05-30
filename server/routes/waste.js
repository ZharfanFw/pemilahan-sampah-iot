/**
 * waste.js (routes)
 * =================
 * Route untuk endpoint data sampah.
 * Mengambil riwayat, statistik, dan data terbaru dari Firebase via wasteController.
 */

const express = require("express");
const router = express.Router();
const wasteController = require("../controllers/wasterController");

/**
 * GET /api/waste/latest
 * Mendapatkan data sampah terbaru hari ini.
 */
router.get("/latest", wasteController.getLatest);

/**
 * GET /api/waste/history?date=2026-05-30&limit=50
 * Mendapatkan riwayat pemilahan sampah.
 */
router.get("/history", wasteController.getHistory);

/**
 * GET /api/waste/stats?period=today&binId=bin-001
 * Mendapatkan statistik sampah (today/weekly/monthly).
 */
router.get("/stats", wasteController.getStats);

module.exports = router;
