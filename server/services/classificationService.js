const { Worker } = require("worker_threads");
const path = require("path");
const logger = require("../utils/logger");

class ClassificationService {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.isFallbackMode = false;
    this.pendingRequests = new Map(); // requestId → { resolve, reject }
    this.requestCounter = 0;
  }

  async loadModel() {
    return new Promise((resolve) => {
      this.worker = new Worker(path.join(__dirname, "classificationWorker.js"));

      this.worker.on("message", (msg) => {
        if (msg.type === "status") {
          this.isReady = msg.ready;
          this.isFallbackMode = msg.fallback || false;
          if (msg.error)
            logger.error("[Worker] Error loading model:", msg.error);
          logger.info(`[ML] Worker siap. Fallback: ${this.isFallbackMode}`);
          resolve(true);
        }

        if (msg.type === "result") {
          const pending = this.pendingRequests.get(msg.requestId);
          if (!pending) return;
          this.pendingRequests.delete(msg.requestId);
          if (msg.error) pending.reject(new Error(msg.error));
          else pending.resolve(msg.data);
        }
      });

      this.worker.on("error", (err) => {
        logger.error("[Worker] Worker crash:", err);
        // Resolve semua pending request dengan error
        for (const [id, pending] of this.pendingRequests) {
          pending.reject(new Error("Worker error"));
          this.pendingRequests.delete(id);
        }
      });

      this.worker.on("exit", (code) => {
        logger.warning(`[Worker] Worker berhenti dengan kode ${code}`);
        this.isReady = false;
      });
    });
  }

  classify(imageBuffer) {
    if (!this.isReady) {
      return Promise.reject(new Error("Model belum siap"));
    }

    return new Promise((resolve, reject) => {
      const requestId = ++this.requestCounter;
      this.pendingRequests.set(requestId, { resolve, reject });

      // Kirim buffer sebagai Uint8Array (transferable)
      const uint8 = new Uint8Array(imageBuffer);
      this.worker.postMessage(
        { type: "classify", buffer: uint8, requestId },
        [uint8.buffer], // Transfer ownership — zero-copy
      );

      // Timeout 30 detik
      setTimeout(() => {
        if (this.pendingRequests.has(requestId)) {
          this.pendingRequests.delete(requestId);
          reject(new Error("Klasifikasi timeout"));
        }
      }, 30000);
    });
  }

  getStatus() {
    return { is_ready: this.isReady, is_fallback: this.isFallbackMode };
  }
}

module.exports = new ClassificationService();
