const mqtt = require("mqtt");
const MQTT_CONFIG = require("../config/mqtt");
const { db, updateData, setData } = require("../config/firebase");
const logger = require("../utils/logger");

class MQTTService {
  constructor() {
    this.client = null;
    this.connected = false;
  }

  connect() {
    logger.info(`Connecting to MQTT broker: ${MQTT_CONFIG.brokerUrl}`);

    this.client = mqtt.connect(MQTT_CONFIG.brokerUrl, MQTT_CONFIG.options);

    this.client.on("connect", () => {
      this.connected = true;
      logger.success("MQTT broker connected");

      // Update system status
      updateData("system/mqtt_status", {
        broker_connected: true,
        last_message: Date.now(),
      });

      // Subscribe to all smartbin topics
      this.client.subscribe(MQTT_CONFIG.topics.all, (err) => {
        if (err) {
          logger.error("Failed to subscribe to topics", err);
        } else {
          logger.success(`Subscribed to: ${MQTT_CONFIG.topics.all}`);
        }
      });
    });

    this.client.on("message", async (topic, message) => {
      try {
        const payload = JSON.parse(message.toString());
        logger.mqtt(`Received on ${topic}: ${JSON.stringify(payload)}`);

        await this.handleMessage(topic, payload);
      } catch (error) {
        logger.error(`Error parsing message from ${topic}`, error);
      }
    });

    this.client.on("error", (error) => {
      logger.error("MQTT connection error", error);
      this.connected = false;

      updateData("system/mqtt_status", {
        broker_connected: false,
        last_error: error.message,
      });
    });

    this.client.on("offline", () => {
      logger.warning("MQTT client offline");
      this.connected = false;
    });

    this.client.on("reconnect", () => {
      logger.info("Reconnecting to MQTT broker...");
    });
  }

  async handleMessage(topic, payload) {
    const now = Date.now();

    switch (topic) {
      case MQTT_CONFIG.topics.classification:
        await this.handleClassification(payload, now);
        break;

      case MQTT_CONFIG.topics.capacity:
        await this.handleCapacity(payload, now);
        break;

      case MQTT_CONFIG.topics.status:
        await this.handleStatus(payload, now);
        break;

      default:
        logger.warning(`Unknown topic: ${topic}`);
    }

    // Update last message timestamp
    await updateData("system/mqtt_status", {
      last_message: now,
    });
  }

  async handleClassification(payload, timestamp) {
    try {
      const { jenis, confidence, binId = "bin-001" } = payload;

      // Validate data
      if (!jenis || !confidence) {
        logger.warning("Invalid classification data received");
        return;
      }

      // Save to sampah collection (organized by date)
      const date = new Date(timestamp);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");

      const wasteId = `${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
      const wastePath = `sampah/${year}-${month}/${day}/${wasteId}`;

      await setData(wastePath, {
        jenis,
        confidence: parseFloat(confidence),
        timestamp,
        binId,
        imageUrl: null,
      });

      logger.success(`Waste classified: ${jenis} (${confidence})`);

      // Update bin stats
      await this.updateBinStats(binId, jenis);
    } catch (error) {
      logger.error("Error handling classification", error);
    }
  }

  async handleCapacity(payload, timestamp) {
    try {
      const { level_cm, kapasitas_persen, binId = "bin-001" } = payload;

      // Determine status based on capacity
      let status = "normal";
      if (kapasitas_persen >= 90) {
        status = "full";
      } else if (kapasitas_persen >= 75) {
        status = "warning";
      }

      // Update bin status
      await updateData(`bins/${binId}/status`, {
        kapasitas_persen: parseFloat(kapasitas_persen),
        level_cm: parseFloat(level_cm),
        status,
        lastUpdate: timestamp,
      });

      logger.info(`Bin capacity updated: ${kapasitas_persen}% (${status})`);

      // Create alert if bin is full
      if (status === "full") {
        await this.createAlert(
          binId,
          "bin_full",
          `Tempat sampah penuh (${kapasitas_persen}%)`,
          timestamp,
        );
      }
    } catch (error) {
      logger.error("Error handling capacity", error);
    }
  }

  async handleStatus(payload, timestamp) {
    try {
      const { servo_position, is_online, binId = "bin-001" } = payload;

      await updateData(`bins/${binId}/status`, {
        servo_position: parseInt(servo_position),
        is_online: Boolean(is_online),
        lastUpdate: timestamp,
      });

      logger.info(`System status updated: ${is_online ? "Online" : "Offline"}`);
    } catch (error) {
      logger.error("Error handling status", error);
    }
  }

  async updateBinStats(binId, jenis) {
    try {
      const statsRef = db.ref(`bins/${binId}/stats/today`);
      const snapshot = await statsRef.once("value");
      const stats = snapshot.val() || { total: 0, organik: 0, anorganik: 0 };

      // Increment counters
      stats.total += 1;
      if (jenis === "Organik") {
        stats.organik += 1;
      } else if (jenis === "Anorganik") {
        stats.anorganik += 1;
      }

      await statsRef.update(stats);
    } catch (error) {
      logger.error("Error updating bin stats", error);
    }
  }

  async createAlert(binId, type, message, timestamp) {
    try {
      const alertPath = `alerts/${binId}/${timestamp}`;

      await setData(alertPath, {
        type,
        message,
        severity: type === "bin_full" ? "warning" : "info",
        timestamp,
        resolved: false,
      });

      logger.warning(`Alert created: ${message}`);
    } catch (error) {
      logger.error("Error creating alert", error);
    }
  }

  publish(topic, message) {
    if (!this.connected) {
      logger.error("Cannot publish: MQTT not connected");
      return false;
    }

    this.client.publish(topic, JSON.stringify(message), { qos: 1 });
    logger.mqtt(`Published to ${topic}: ${JSON.stringify(message)}`);
    return true;
  }

  disconnect() {
    if (this.client) {
      this.client.end();
      logger.info("MQTT client disconnected");
    }
  }
}

module.exports = new MQTTService();
