/**
 * mqttService.js
 * ==============
 * MQTT Client internal Node.js.
 * Broker dijalankan terpisah oleh aedesBroker.js
 */

const mqtt = require("mqtt");
const { setData, updateData } = require("../config/firebase");
const MQTT_CONFIG = require("../config/mqtt");
const logger = require("../utils/logger");

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
    
    // Subscribe ke sensorLevel dan status
    const topicsToSubscribe = [
      MQTT_CONFIG.topics.sensorLevel,
      MQTT_CONFIG.topics.status
    ];
    
    client.subscribe(topicsToSubscribe, (err) => {
      if (err) console.error("❌ Gagal subscribe MQTT topics:", err);
      else console.log(`📡 Subscribed to: ${topicsToSubscribe.join(", ")}`);
    });
  });

  client.on("message", async (topic, message) => {
    // 1. TOPIK: sensorLevel (ESP32-CAM mengirim level kedalaman tong)
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
          bin_depth_cm = 19.5, // Selaras dengan 19.5 cm sesuai request user
        } = payload;

        // Hitung kapasitas total (ambil yang paling penuh untuk safety)
        const kapasitas_persen = Math.max(
          organik_persen >= 0 ? organik_persen : 0,
          anorganik_persen >= 0 ? anorganik_persen : 0
        );

        // Tentukan status bin berdasarkan kapasitas tertinggi
        let status = "normal";
        if (kapasitas_persen >= 90) {
          status = "full";
        } else if (kapasitas_persen >= 75) {
          status = "warning";
        }

        const timestamp = Date.now();

        // Update data di Firebase Realtime Database di path status
        const updatePayload = {
          kapasitas_persen: parseFloat(kapasitas_persen),
          level_organik: parseFloat(organik_persen),
          level_anorganik: parseFloat(anorganik_persen),
          jarak_organik: parseFloat(organik_cm),
          jarak_anorganik: parseFloat(anorganik_cm),
          bin_depth_cm: parseFloat(bin_depth_cm),
          status,
          is_online: true,
          lastUpdate: timestamp,
        };

        await updateData(`bins/${binId}/status`, updatePayload);
        logger.success(
          `✅ [MQTT] Level bin ${binId} diperbarui: Organik ${organik_persen}%, Anorganik ${anorganik_persen}%`
        );

        // Buat alert jika salah satu atau kedua bin penuh
        if (status === "full") {
          let alertMsg = "Tempat sampah Organik & Anorganik PENUH!";
          if (organik_persen >= 90 && anorganik_persen < 90) {
            alertMsg = "Tempat sampah Organik PENUH!";
          } else if (anorganik_persen >= 90 && organik_persen < 90) {
            alertMsg = "Tempat sampah Anorganik PENUH!";
          }

          const alertPath = `alerts/${binId}/${timestamp}`;
          await setData(alertPath, {
            type: "bin_full",
            message: alertMsg,
            severity: "warning",
            timestamp,
            resolved: false,
          });
          logger.warning(`Auto-alert created via MQTT: ${alertMsg}`);
        }
      } catch (error) {
        console.error("❌ Error parsing/processing MQTT message:", error);
      }
    }

    // 2. TOPIK: status (online dari ESP32-CAM)
    // 2. TOPIK: status (online dari ESP32-CAM)
    if (topic === MQTT_CONFIG.topics.status) {
      try {
        const payload = JSON.parse(message.toString());
        console.log(`📥 [MQTT] Status device diterima: ${message.toString()}`);

        const { binId = "bin-001", is_online = false } = payload;

        // Hilangkan pengecekan if (is_online) agar 'false' juga ikut tersimpan
        await updateData(`bins/${binId}/status`, {
          is_online: is_online, // Simpan nilai asli (true atau false)
          lastUpdate: Date.now()
        });
        
        logger.info(`✅ [MQTT] Status online bin ${binId} diperbarui: ${is_online}`);
        
      } catch (error) {
        console.error("❌ Error parsing status MQTT message:", error);
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
