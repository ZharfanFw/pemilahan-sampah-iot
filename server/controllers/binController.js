const { getData } = require("../config/firebase");
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
};

module.exports = binController;
