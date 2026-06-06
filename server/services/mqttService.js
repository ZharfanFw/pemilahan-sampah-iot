const { Aedes } = require("aedes");
const aedes = new Aedes();
const net = require("net");
const mqtt = require("mqtt");
const { db, setData } = require("../config/firebase");
const MQTT_CONFIG = require("../config/mqtt");

const MQTT_PORT = 1883;

// 1. Jalankan MQTT Broker Lokal
const server = net.createServer(aedes.handle);
server.listen(MQTT_PORT, function () {
  console.log(`✅ MQTT Broker running on port ${MQTT_PORT}`);
});

// ============================================================================
// 👇 FITUR BARU: Deteksi ESP32 Terhubung / Terputus (Online/Offline)
// ============================================================================

// Saat ESP32 berhasil connect ke Broker
aedes.on("client", async (client) => {
  if (client.id && client.id.startsWith("bin-")) {
    console.log(`🟢 [Status] Alat ${client.id} ONLINE`);
    try {
      // ✅ Ubah path untuk spesifik mengupdate nilai is_online menjadi boolean true
      await setData(`bins/${client.id}/status/is_online`, true);
    } catch (err) {
      console.error("Gagal update status online:", err);
    }
  }
});

// Saat ESP32 mati, hilang WiFi, atau terputus
aedes.on("clientDisconnect", async (client) => {
  if (client.id && client.id.startsWith("bin-")) {
    console.log(`🔴 [Status] Alat ${client.id} OFFLINE`);
    try {
      // ✅ Ubah path untuk spesifik mengupdate nilai is_online menjadi boolean false
      await setData(`bins/${client.id}/status/is_online`, false);
    } catch (err) {
      console.error("Gagal update status offline:", err);
    }
  }
});

// ============================================================================

// 2. Hubungkan Node.js MQTT Client internal ke Broker
const client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
  clientId: MQTT_CONFIG.clientId,
  ...MQTT_CONFIG.options,
});

client.on("connect", () => {
  console.log("✅ Node.js Internal MQTT Client connected!");
  client.subscribe(MQTT_CONFIG.topics.sensorLevel);
});

client.on("message", async (topic, message) => {
  if (topic === MQTT_CONFIG.topics.sensorLevel) {
    try {
      const payload = JSON.parse(message.toString());
      console.log(
        `📥 [MQTT Broker] Menerima data sensor: ${message.toString()}`,
      );

      const { binId, organik_persen, anorganik_persen } = payload;
      await setData(`bins/${binId}/level`, {
        organik_persen,
        anorganik_persen,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error("❌ Error parsing MQTT message:", error);
    }
  }
});

module.exports = {
  connected: true,
  publish: (topic, payload) => {
    if (client.connected) {
      client.publish(topic, JSON.stringify(payload));
      console.log(
        `📤 [MQTT Broker] Mem-publish ke ${topic}: ${JSON.stringify(payload)}`,
      );
    }
  },
};
