require("dotenv").config();

const MQTT_CONFIG = {
  brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
  clientId: `smartbin_server_${Math.random().toString(16).substring(2, 10)}`, // Pakai substring lebih aman dari substr
  options: {
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
  },
  topics: {
    servoControl: "smartbin/kontrol/servo",
    sensorLevel: "smartbin/sensor/level",
    status: "smartbin/status",
    all: "smartbin/#",
  },
};

module.exports = MQTT_CONFIG;
