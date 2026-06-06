/**
 * mqttService.js
 * ==============
 * MQTT Client internal Node.js.
 * Broker dijalankan terpisah oleh aedesBroker.js
 */

const mqtt = require("mqtt");
const { setData } = require("../config/firebase");
const MQTT_CONFIG = require("../config/mqtt");

let client = null;
let isConnected = false;

function connect() {
  client = mqtt.connect(MQTT_CONFIG.brokerUrl, {
    clientId: MQTT_CONFIG.clientId,
    ...MQTT_CONFIG.options,
  });

  client.on("connect", () => {
    isConnected = true;
    console.log("✅ Node.js MQTT Client connected!");
    // Hanya subscribe sensorLevel — TIDAK subscribe smartbin/#
    client.subscribe(MQTT_CONFIG.topics.sensorLevel, (err) => {
      if (err) console.error("❌ Gagal subscribe sensorLevel:", err);
      else console.log(`📡 Subscribed to: ${MQTT_CONFIG.topics.sensorLevel}`);
    });
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

        const kapasitas_persen = Math.max(organik_persen, anorganik_persen);

        let status = "normal";
        if (kapasitas_persen >= 90) status = "full";
        else if (kapasitas_persen >= 75) status = "warning";

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
    isConnected = false;
  });

  client.on("offline", () => {
    console.warn("⚠️ MQTT client offline");
    isConnected = false;
  });

  client.on("reconnect", () => {
    console.log("🔄 MQTT client reconnecting...");
  });
}

function publish(topic, payload) {
  if (client && client.connected) {
    client.publish(topic, JSON.stringify(payload));
    console.log(`📤 [MQTT] Publish ke ${topic}: ${JSON.stringify(payload)}`);
  } else {
    console.error("❌ [MQTT] Client tidak terhubung, gagal publish.");
  }
}

module.exports = {
  connect,
  publish,
  get connected() {
    return isConnected;
  },
};
