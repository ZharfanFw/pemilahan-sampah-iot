/**
 * classificationService.js
 * ========================
 * Service untuk klasifikasi sampah menggunakan model TensorFlow.js (MobileNetV2).
 * Model di-load sekali saat startup dan digunakan untuk semua request (singleton).
 *
 * Input : Buffer gambar JPEG dari ESP32-CAM
 * Output: { jenis: "Organik"|"Anorganik", confidence: 0.95 }
 */

const tf = require("@tensorflow/tfjs");
const wasm = require("@tensorflow/tfjs-backend-wasm");
const jpeg = require("jpeg-js");
const path = require("path");
const logger = require("../utils/logger");

// Set local WASM binary file paths for completely offline high-performance execution
const wasmDistPath = path.join(__dirname, "..", "node_modules", "@tensorflow/tfjs-backend-wasm", "dist");
wasm.setWasmPaths({
  "tfjs-backend-wasm.wasm": path.join(wasmDistPath, "tfjs-backend-wasm.wasm"),
  "tfjs-backend-wasm-simd.wasm": path.join(wasmDistPath, "tfjs-backend-wasm-simd.wasm"),
  "tfjs-backend-wasm-threaded-simd.wasm": path.join(wasmDistPath, "tfjs-backend-wasm-threaded-simd.wasm"),
});

/**
 * Custom TFJS IOHandler to load local Graph Model files using native Node.js filesystem APIs.
 */
function graphFileLoader(jsonPath) {
  return {
    load: async () => {
      const content = await fs.promises.readFile(jsonPath, 'utf8');
      const json = JSON.parse(content);

      const dir = path.dirname(jsonPath);
      const buffers = [];
      if (json.weightsManifest) {
        for (const group of json.weightsManifest) {
          for (const p of group.paths) {
            const buf = await fs.promises.readFile(path.join(dir, p));
            buffers.push(buf);
          }
        }
      }

      // Native Node.js Buffer concatenation (highly optimized C++ implementation)
      const combinedBuffer = Buffer.concat(buffers);
      
      // Extract weight specifications
      const weightSpecs = [];
      if (json.weightsManifest) {
        for (const group of json.weightsManifest) {
          weightSpecs.push(...group.weights);
        }
      }

      return {
        modelTopology: json.modelTopology,
        format: json.format,
        generatedBy: json.generatedBy,
        convertedBy: json.convertedBy,
        signature: json.signature,
        weightSpecs: weightSpecs,
        weightData: combinedBuffer.buffer.slice(
          combinedBuffer.byteOffset,
          combinedBuffer.byteOffset + combinedBuffer.byteLength
        )
      };
    }
  };
}

class ClassificationService {
  constructor() {
    this.worker = null;
    this.isReady = false;
    this.isFallbackMode = false;
    this.pendingRequests = new Map(); // requestId → { resolve, reject }
    this.requestCounter = 0;
  }

  async loadModel() {
    try {
      // Check if TensorFlow.js is available
      if (!tf) {
        logger.warning(
          "TensorFlow.js not available. Switching to MOCK/FALLBACK mode for testing.",
        );
        this.isFallbackMode = true;
        this.isReady = true;
        return true;
      }

      // Set high-performance WASM backend
      logger.info("Initializing high-performance WebAssembly (WASM) backend...");
      await tf.setBackend("wasm");
      logger.success(`TensorFlow.js backend successfully set to: ${tf.getBackend()}`);

      // Check if model files exist
      if (!fs.existsSync(this.modelPath)) {
        logger.warning(
          `Model file not found at: ${this.modelPath}. Switching to MOCK/FALLBACK mode for testing.`,
        );
        logger.info(
          "To enable classification, run: cd model && python train_model.py",
        );
        this.isFallbackMode = true;
        this.isReady = true;
        return true;
      }

      logger.info(`Loading classification graph model from: ${this.modelPath}`);
      const startTime = Date.now();

      // Load TFJS Graph Model (instantly, no layers compilation loop!)
      this.model = await tf.loadGraphModel(graphFileLoader(this.modelPath));

      const loadTime = Date.now() - startTime;
      logger.success(`Classification graph model loaded successfully in ${loadTime}ms`);

      // Load metadata if available
      const metadataPath = path.join(
        __dirname,
        "..",
        "..",
        "model",
        "model_metadata.json",
      );
      if (fs.existsSync(metadataPath)) {
        this.metadata = JSON.parse(fs.readFileSync(metadataPath, "utf8"));
        logger.info(
          `Model metadata loaded: ${this.metadata.model_name} (${this.metadata.architecture})`,
        );
      }

      // Warmup: run a dummy prediction to initialize execution kernels
      const dummyInput = tf.zeros([1, ...this.imgSize, 3]);
      const warmupResult = this.model.predict(dummyInput);
      warmupResult.dispose();
      dummyInput.dispose();
      logger.info("Model warmup complete");

      this.isReady = true;
      this.isFallbackMode = false;
      return true;
    } catch (error) {
      logger.error("Failed to load classification model", error);
      logger.warning("Switching to MOCK/FALLBACK mode due to error.");
      this.isFallbackMode = true;
      this.isReady = true;
      return true;
    }
  }

  classify(imageBuffer) {
    if (!this.isReady) {
      return Promise.reject(new Error("Model belum siap"));
    }

    let tensor = null;
    let prediction = null;

    try {
      const startTime = Date.now();

      // 1. Decode JPEG buffer ke tensor menggunakan jpeg-js (pure JS)
      const rawImageData = jpeg.decode(imageBuffer, { useTensors: false });
      const { width, height, data } = rawImageData;

      // Extract RGB values and create a 3D tensor [height, width, 3]
      const numPixels = width * height;
      const rgbBuffer = new Float32Array(numPixels * 3);
      for (let i = 0; i < numPixels; i++) {
        rgbBuffer[i * 3] = data[i * 4];       // R
        rgbBuffer[i * 3 + 1] = data[i * 4 + 1]; // G
        rgbBuffer[i * 3 + 2] = data[i * 4 + 2]; // B
      }
      tensor = tf.tensor3d(rgbBuffer, [height, width, 3]);

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
