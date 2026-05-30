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
const fs = require("fs");
const logger = require("../utils/logger");

// Set local WASM binary file paths for completely offline high-performance execution
const wasmDistPath = path.join(__dirname, "..", "node_modules", "@tensorflow/tfjs-backend-wasm", "dist");
wasm.setWasmPaths({
  "tfjs-backend-wasm.wasm": path.join(wasmDistPath, "tfjs-backend-wasm.wasm"),
  "tfjs-backend-wasm-simd.wasm": path.join(wasmDistPath, "tfjs-backend-wasm-simd.wasm"),
  "tfjs-backend-wasm-threaded-simd.wasm": path.join(wasmDistPath, "tfjs-backend-wasm-threaded-simd.wasm"),
});

/**
 * Helper to convert Keras v3 inbound_nodes to Keras v2 format that TFJS expects.
 */
function convertV3ToV2InboundNodes(inboundNodesV3) {
  if (!Array.isArray(inboundNodesV3)) return inboundNodesV3;
  return inboundNodesV3.map(node => {
    if (Array.isArray(node)) return node;
    const args = node.args || [];
    const convertedLinks = [];
    for (const arg of args) {
      if (arg && arg.class_name === '__keras_tensor__' && arg.config && arg.config.keras_history) {
        const hist = arg.config.keras_history;
        convertedLinks.push([hist[0], hist[1], hist[2], {}]);
      }
    }
    return convertedLinks;
  });
}

/**
 * Recursively convert Keras v3 layer configs to Keras v2 format.
 */
function convertKerasV3ToV2(layer) {
  if (!layer || typeof layer !== 'object') return;

  // 1. Simplify dtype object if it exists
  if (layer.config && layer.config.dtype && typeof layer.config.dtype === 'object') {
    layer.config.dtype = layer.config.dtype.config ? layer.config.dtype.config.name : 'float32';
  }
  if (layer.dtype && typeof layer.dtype === 'object') {
    layer.dtype = layer.dtype.config ? layer.dtype.config.name : 'float32';
  }

  // 2. Convert batch_shape to batchInputShape in InputLayer
  if (layer.class_name === 'InputLayer' && layer.config) {
    if (layer.config.batch_shape && !layer.config.batchInputShape) {
      layer.config.batchInputShape = layer.config.batch_shape;
      delete layer.config.batch_shape;
    }
  }

  // 3. Convert inbound_nodes
  if (layer.inbound_nodes) {
    layer.inbound_nodes = convertV3ToV2InboundNodes(layer.inbound_nodes);
  }

  // 4. Recurse down nested layers
  if (layer.config && Array.isArray(layer.config.layers)) {
    layer.config.layers.forEach(convertKerasV3ToV2);
  }
  if (Array.isArray(layer.layers)) {
    layer.layers.forEach(convertKerasV3ToV2);
  }
}

/**
 * Custom TFJS IOHandler to load local model files and adapt Keras v3 configuration.
 */
function kerasV3FileLoader(jsonPath) {
  return {
    load: async () => {
      const content = await fs.promises.readFile(jsonPath, 'utf8');
      const json = JSON.parse(content);

      if (json.modelTopology && json.modelTopology.model_config) {
        convertKerasV3ToV2(json.modelTopology.model_config);
      }

      const dir = path.dirname(jsonPath);
      const buffers = [];
      if (json.weightsManifest) {
        for (const group of json.weightsManifest) {
          for (const p of group.paths) {
            const buf = await fs.promises.readFile(path.join(dir, p));
            buffers.push(buf);
          }
        }
        
        // Native Node.js Buffer concatenation (highly optimized C++ implementation)
        const combinedBuffer = Buffer.concat(buffers);
        // Precisely slice the ArrayBuffer to match the exact weights size
        json.weightData = combinedBuffer.buffer.slice(
          combinedBuffer.byteOffset,
          combinedBuffer.byteOffset + combinedBuffer.byteLength
        );
      }
      return json;
    }
  };
}

class ClassificationService {
  constructor() {
    this.model = null;
    this.isReady = false;
    this.isFallbackMode = false;
    this.modelPath = path.join(__dirname, "..", "ml-model", "model.json");
    this.metadata = null;

    // Class mapping: model output sigmoid
    // < 0.5 = class 0 = O = Organik
    // >= 0.5 = class 1 = R = Anorganik (Recyclable)
    this.classNames = ["Organik", "Anorganik"];
    this.imgSize = [224, 224];
    this.threshold = 0.5;
  }

  /**
   * Load model dari file system.
   * Dipanggil saat server startup.
   */
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

      logger.info(`Loading classification model from: ${this.modelPath}`);
      const startTime = Date.now();

      // Load TFJS model using our custom Keras v3 compatibility loader
      this.model = await tf.loadLayersModel(kerasV3FileLoader(this.modelPath));

      const loadTime = Date.now() - startTime;
      logger.success(`Classification model loaded in ${loadTime}ms`);

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

      // Warmup: run a dummy prediction to initialize
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

  /**
   * Klasifikasi gambar sampah.
   *
   * @param {Buffer} imageBuffer - Raw JPEG image buffer dari ESP32-CAM
   * @returns {Object} { jenis: string, confidence: number, raw_score: number }
   */
  async classify(imageBuffer) {
    if (!this.isReady) {
      throw new Error(
        "Classification service is not initialized.",
      );
    }

    if (this.isFallbackMode) {
      // Mock/Fallback classification logic
      const classes = ["Organik", "Anorganik"];
      const jenis = classes[Math.floor(Math.random() * classes.length)];
      const confidence = parseFloat((0.75 + Math.random() * 0.23).toFixed(4)); // Random between 75% and 98%
      const inferenceTime = Math.floor(50 + Math.random() * 100);

      logger.warning(
        `[FALLBACK MOCK CLASSIFICATION] Image classified as ${jenis} (confidence: ${(confidence * 100).toFixed(1)}%, size: ${imageBuffer ? imageBuffer.length : 0} bytes)`,
      );

      return {
        jenis,
        confidence,
        raw_score: jenis === "Anorganik" ? confidence : 1 - confidence,
        inference_time_ms: inferenceTime,
      };
    }

    if (!this.model) {
      throw new Error(
        "Classification model is not loaded.",
      );
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

      // 2. Resize ke model input size (224x224)
      tensor = tf.image.resizeBilinear(tensor, this.imgSize);

      // 3. Normalize pixel values [0, 1]
      tensor = tensor.toFloat().div(tf.scalar(255.0));

      // 4. Add batch dimension: [224, 224, 3] → [1, 224, 224, 3]
      tensor = tensor.expandDims(0);

      // 5. Run inference
      prediction = this.model.predict(tensor);
      const score = (await prediction.data())[0]; // Sigmoid output [0, 1]

      const inferenceTime = Date.now() - startTime;

      // 6. Interpret result
      // score < 0.5 → Organik (class 0 = O)
      // score >= 0.5 → Anorganik (class 1 = R)
      const isAnorganik = score >= this.threshold;
      const jenis = isAnorganik ? "Anorganik" : "Organik";
      const confidence = isAnorganik ? score : 1 - score;

      logger.info(
        `Classification: ${jenis} (confidence: ${(confidence * 100).toFixed(1)}%, raw_score: ${score.toFixed(4)}, time: ${inferenceTime}ms)`,
      );

      return {
        jenis,
        confidence: parseFloat(confidence.toFixed(4)),
        raw_score: parseFloat(score.toFixed(4)),
        inference_time_ms: inferenceTime,
      };
    } catch (error) {
      logger.error("Classification inference error", error);
      throw new Error(`Classification failed: ${error.message}`);
    } finally {
      // Cleanup tensors to prevent memory leaks
      if (tensor) tensor.dispose();
      if (prediction) prediction.dispose();
    }
  }

  /**
   * Get model status info.
   */
  getStatus() {
    return {
      is_ready: this.isReady,
      is_fallback_mode: this.isFallbackMode,
      model_path: this.modelPath,
      model_loaded: this.model !== null,
      class_names: this.classNames,
      input_size: this.imgSize,
      metadata: this.metadata,
    };
  }
}

// Singleton instance
module.exports = new ClassificationService();
