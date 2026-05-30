/**
 * bins.js (routes)
 * ================
 * Route untuk endpoint tempat sampah (bins).
 * Mengambil status, daftar, dan alert dari Firebase via binController.
 */

const express = require("express");
const router = express.Router();
const binController = require("../controllers/binController");

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

module.exports = router;
