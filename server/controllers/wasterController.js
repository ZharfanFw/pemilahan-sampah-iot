const { db, getData } = require("../config/firebase");
const logger = require("../utils/logger");

const wasteController = {
  // Get latest waste entry
  getLatest: async (req, res) => {
    try {
      const today = new Date();
      const year = today.getFullYear();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const day = String(today.getDate()).padStart(2, "0");

      const todayPath = `sampah/${year}-${month}/${day}`;
      const snapshot = await db.ref(todayPath).limitToLast(1).once("value");
      const data = snapshot.val();

      if (!data) {
        return res.json({
          success: true,
          data: null,
          message: "No waste data found for today",
        });
      }

      const latest = Object.values(data)[0];

      res.json({
        success: true,
        data: latest,
      });
    } catch (error) {
      logger.error("Error getting latest waste", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  // Get waste history with pagination
  getHistory: async (req, res) => {
    try {
      const { limit = 50, date } = req.query;

      let targetDate;
      if (date) {
        targetDate = new Date(date);
      } else {
        targetDate = new Date();
      }

      const year = targetDate.getFullYear();
      const month = String(targetDate.getMonth() + 1).padStart(2, "0");
      const day = String(targetDate.getDate()).padStart(2, "0");

      const path = `sampah/${year}-${month}/${day}`;
      const snapshot = await db
        .ref(path)
        .limitToLast(parseInt(limit))
        .once("value");
      const data = snapshot.val();

      if (!data) {
        return res.json({
          success: true,
          data: [],
          total: 0,
          date: `${year}-${month}-${day}`,
        });
      }

      const wasteArray = Object.entries(data).map(([id, waste]) => ({
        id,
        ...waste,
      }));

      res.json({
        success: true,
        data: wasteArray.reverse(), // Latest first
        total: wasteArray.length,
        date: `${year}-${month}-${day}`,
      });
    } catch (error) {
      logger.error("Error getting waste history", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },

  // Get waste statistics
  // Get waste statistics
  getStats: async (req, res) => {
    try {
      const { period = "today", binId = "bin-001" } = req.query;

      // ✅ PERBAIKAN: Jika yang diminta adalah "today", hitung langsung dari data histori hari ini
      if (period === "today") {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, "0");
        const day = String(today.getDate()).padStart(2, "0");

        const todayPath = `sampah/${year}-${month}/${day}`;
        const snapshot = await db.ref(todayPath).once("value");
        const data = snapshot.val();

        let total = 0;
        let organik = 0;
        let anorganik = 0;

        if (data) {
          const wasteArray = Object.values(data);
          total = wasteArray.length;
          // Hitung organik dan anorganik dengan filter
          organik = wasteArray.filter(
            (w) => w.jenis && w.jenis.toLowerCase() === "organik",
          ).length;
          anorganik = wasteArray.filter(
            (w) => w.jenis && w.jenis.toLowerCase() === "anorganik",
          ).length;
        }

        return res.json({
          success: true,
          data: { total, organik, anorganik },
          period,
        });
      }

      // Jika periodenya bukan "today" (misal weekly/monthly), biarkan pakai cara lama
      const statsPath = `bins/${binId}/stats/${period}`;
      const stats = await db.ref(statsPath).once("value");
      const statsData = stats.val();

      if (!statsData) {
        return res.json({
          success: true,
          data: {
            total: 0,
            organik: 0,
            anorganik: 0,
          },
          period,
        });
      }

      res.json({
        success: true,
        data: statsData,
        period,
      });
    } catch (error) {
      logger.error("Error getting waste stats", error);
      res.status(500).json({
        success: false,
        message: "Internal server error",
        error: error.message,
      });
    }
  },
};

module.exports = wasteController;
