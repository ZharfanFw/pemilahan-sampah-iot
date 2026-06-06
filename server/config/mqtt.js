require("dotenv").config();

const MQTT_CONFIG = {
  brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
  clientId: `smartbin_server_${Math.random().toString(16).substring(2, 10)}`,
  options: {
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
  },
  topics: {
    kontrolServo: "smartbin/kontrol/servo", // Server → ESP32
    sensorLevel: "smartbin/sensor/level", // ESP32 → Server
    status: "smartbin/status",
  },
};

module.exports = MQTT_CONFIG;
