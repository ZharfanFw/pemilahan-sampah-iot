const { db, getData, setData, updateData } = require("../config/firebase");
const logger = require("../utils/logger");

const binController = {
  // Get bin status
  getStatus: async (req, res) => {
    try {
      const { binId = "bin-001" } = req.query;

      const binData = await getData(`bins/${binId}`);

      if (!binData) {
        return res.status(404).json({
          success: false,
          message: "Bin not found",
        });
      }

      res.json({
        success: true,
        data: {
          binId,
          info: binData.info,
          status: binData.status,
          stats: binData.stats,
        },
      });
    } catch (error) {
      logger.error("Error getting bin status", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  // Get all bins
  getAllBins: async (req, res) => {
    try {
      const binsData = await getData("bins");

      if (!binsData) {
        return res.json({
          success: true,
          data: [],
        });
      }

      const bins = Object.entries(binsData).map(([id, bin]) => ({
        binId: id,
        ...bin,
      }));

      res.json({
        success: true,
        data: bins,
      });
    } catch (error) {
      logger.error("Error getting all bins", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  // Get alerts
  getAlerts: async (req, res) => {
    try {
      const { binId = "bin-001", resolved = "false" } = req.query;

      const alertsData = await getData(`alerts/${binId}`);

      if (!alertsData) {
        return res.json({
          success: true,
          data: [],
        });
      }

      let alerts = Object.entries(alertsData).map(([id, alert]) => ({
        id,
        ...alert,
      }));

      // Filter by resolved status
      if (resolved === "false") {
        alerts = alerts.filter((alert) => !alert.resolved);
      }

      // Sort by timestamp (latest first)
      alerts.sort((a, b) => b.timestamp - a.timestamp);

      res.json({
        success: true,
        data: alerts,
      });
    } catch (error) {
      logger.error("Error getting alerts", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  // Update bin depth level and status
  updateLevel: async (req, res) => {
    try {
      const {
        binId = "bin-001",
        organik_persen = 0,
        anorganik_persen = 0,
        organik_cm = -1,
        anorganik_cm = -1,
      } = req.body;

      const timestamp = Date.now();

      // Hitung kapasitas total (ambil yang paling penuh untuk safety)
      const kapasitas_persen = Math.max(organik_persen, anorganik_persen);

      // Tentukan status bin berdasarkan kapasitas tertinggi
      let status = "normal";
      if (kapasitas_persen >= 90) {
        status = "full";
      } else if (kapasitas_persen >= 75) {
        status = "warning";
      }

      // Update data di Firebase Realtime Database
      const updatePayload = {
        kapasitas_persen: parseFloat(kapasitas_persen),
        level_organik: parseFloat(organik_persen),
        level_anorganik: parseFloat(anorganik_persen),
        jarak_organik: parseFloat(organik_cm),
        jarak_anorganik: parseFloat(anorganik_cm),
        status,
        is_online: true,
        lastUpdate: timestamp,
      };

      await updateData(`bins/${binId}/status`, updatePayload);
      logger.success(
        `Bin level updated via HTTP POST for ${binId}: Organik: ${organik_persen}%, Anorganik: ${anorganik_persen}%`
      );

      // Buat alert jika salah satu atau kedua bin penuh
      if (status === "full") {
        let message = "Tempat sampah Organik & Anorganik PENUH!";
        if (organik_persen >= 90 && anorganik_persen < 90) {
          message = "Tempat sampah Organik PENUH!";
        } else if (anorganik_persen >= 90 && organik_persen < 90) {
          message = "Tempat sampah Anorganik PENUH!";
        }

        const alertPath = `alerts/${binId}/${timestamp}`;
        await setData(alertPath, {
          type: "bin_full",
          message,
          severity: "warning",
          timestamp,
          resolved: false,
        });
        logger.warning(`Auto-alert created: ${message}`);
      }

      res.json({
        success: true,
        message: "Bin levels updated successfully",
        data: updatePayload,
      });
    } catch (error) {
      logger.error("Error updating bin levels", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
};

module.exports = binController;
