/**
 * mqttService.js
 * ==============
 * MQTT Broker lokal (Aedes) + Node.js internal client.
 * - Broker: menerima koneksi dari ESP32
 * - Client internal: subscribe sensorLevel, update Firebase
 */

const { Aedes } = require("aedes");
const aedes = new Aedes();
const net = require("net");
const mqtt = require("mqtt");
const { setData } = require("../config/firebase");
const MQTT_CONFIG = require("../config/mqtt");

const MQTT_PORT = 1883;

// ============================================================================
// 1. Jalankan MQTT Broker Lokal
// ============================================================================

const server = net.createServer(aedes.handle);
server.listen(MQTT_PORT, function () {
  console.log(`✅ MQTT Broker running on port ${MQTT_PORT}`);
});

// ============================================================================
// 2. Deteksi ESP32 Online / Offline
// ============================================================================

aedes.on("client", async (client) => {
  if (client.id && client.id.startsWith("bin-")) {
    console.log(`🟢 [Status] Alat ${client.id} ONLINE`);
    try {
      await setData(`bins/${client.id}/status/is_online`, true);
    } catch (err) {
      console.error("Gagal update status online:", err);
    }
  }
});

aedes.on("clientDisconnect", async (client) => {
  if (client.id && client.id.startsWith("bin-")) {
    console.log(`🔴 [Status] Alat ${client.id} OFFLINE`);
    try {
      await setData(`bins/${client.id}/status/is_online`, false);
    } catch (err) {
      console.error("Gagal update status offline:", err);
    }
  }
});

// ============================================================================
// 3. Node.js Internal MQTT Client
//    Hanya subscribe sensorLevel — TIDAK subscribe smartbin/#
//    agar tidak ikut menerima pesan servo dan tidak menulis riwayat ganda
// ============================================================================

const client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
  clientId: MQTT_CONFIG.clientId,
  ...MQTT_CONFIG.options,
});

client.on("connect", () => {
  console.log("✅ Node.js Internal MQTT Client connected!");
  // Hanya listen level bin, bukan semua topik
  client.subscribe(MQTT_CONFIG.topics.sensorLevel);
});

client.on("message", async (topic, message) => {
  if (topic === MQTT_CONFIG.topics.sensorLevel) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(`📥 [MQTT] Data sensor diterima: ${message.toString()}`);

      const {
        binId = "bin-001",
        organik_persen = 0,
        anorganik_persen = 0,
        organik_cm = -1,
        anorganik_cm = -1,
        bin_depth_cm = 26.0,
      } = payload;

      // Hitung kapasitas total
      const kapasitas_persen = Math.max(organik_persen, anorganik_persen);

      // Tentukan status bin
      let status = "normal";
      if (kapasitas_persen >= 90) status = "full";
      else if (kapasitas_persen >= 75) status = "warning";

      // Update level bin di Firebase
      await setData(`bins/${binId}/level`, {
        organik_persen,
        anorganik_persen,
        organik_cm,
        anorganik_cm,
        bin_depth_cm,
        kapasitas_persen,
        status,
        is_online: true,
        timestamp: Date.now(),
      });

      console.log(
        `✅ [MQTT] Level bin ${binId} diperbarui: Organik ${organik_persen}%, Anorganik ${anorganik_persen}%`,
      );
    } catch (error) {
      console.error("❌ Error parsing MQTT message:", error);
    }
  }
});

client.on("error", (error) => {
  console.error("❌ MQTT connection error:", error.message);
});

// ============================================================================
// 4. Export publish function untuk dipakai classifyController
// ============================================================================

module.exports = {
  connected: true,
  publish: (topic, payload) => {
    if (client.connected) {
      client.publish(topic, JSON.stringify(payload));
      console.log(`📤 [MQTT] Publish ke ${topic}: ${JSON.stringify(payload)}`);
    } else {
      console.error("❌ [MQTT] Client tidak terhubung, gagal publish.");
    }
  },
};
