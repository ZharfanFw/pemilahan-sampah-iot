/**
 * aedesBroker.js
 * ==============
 * MQTT Broker lokal menggunakan Aedes.
 * Broker ini berjalan di dalam proses Node.js yang sama dengan server Express.
 *
 * Keuntungan:
 * - Tidak perlu install Mosquitto atau layanan broker eksternal
 * - Tidak perlu TLS/SSL untuk komunikasi lokal
 * - ESP32 cukup mengarah ke IP server Node.js (port 1883)
 * - Semua berjalan dalam satu proses
 */

const { Aedes } = require("aedes");
const net = require("net");
const logger = require("../utils/logger");

const MQTT_PORT = parseInt(process.env.MQTT_BROKER_PORT) || 1883;

/**
 * Membuat dan menjalankan broker Aedes.
 * @returns {Promise<Object>} { broker, server } — instance Aedes & net.Server
 */
async function startBroker() {
  const broker = await Aedes.createBroker();

  const server = net.createServer(broker.handle.bind(broker));

  server.listen(MQTT_PORT, "0.0.0.0", () => {
    logger.success(`📡 MQTT Broker (Aedes) berjalan di port ${MQTT_PORT}`);
  });

  // ── Event Handlers ──

  broker.on("client", (client) => {
    logger.info(`[Aedes] Client connected: ${client.id}`);
  });

  broker.on("clientDisconnect", (client) => {
    logger.warning(`[Aedes] Client disconnected: ${client.id}`);
  });

  broker.on("publish", (packet, client) => {
    // Hanya log pesan dari client nyata (bukan internal Aedes)
    if (client) {
      logger.mqtt(
        `[Aedes] ${client.id} → ${packet.topic}: ${packet.payload.toString().substring(0, 100)}`
      );
    }
  });

  broker.on("subscribe", (subscriptions, client) => {
    if (client) {
      const topics = subscriptions.map((s) => s.topic).join(", ");
      logger.info(`[Aedes] ${client.id} subscribed to: ${topics}`);
    }
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      logger.error(
        `Port ${MQTT_PORT} sudah digunakan! Pastikan tidak ada broker MQTT lain yang berjalan.`
      );
    } else {
      logger.error("[Aedes] Server error:", err);
    }
  });

  return { broker, server };
}

module.exports = { startBroker };
