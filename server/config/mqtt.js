require("dotenv").config();

const MQTT_CONFIG = {
  brokerUrl: process.env.MQTT_BROKER_URL || "mqtt://localhost:1883",
  clientId: `smartbin_server_${Math.random().toString(16).substr(2, 8)}`,
  options: {
    clean: true,
    reconnectPeriod: 5000,
    connectTimeout: 30000,
  },
  topics: {
    classification: "smartbin/classification",
    capacity: "smartbin/capacity",
    status: "smartbin/status",
    all: "smartbin/#", // Subscribe to all smartbin topics
  },
};

module.exports = MQTT_CONFIG;
