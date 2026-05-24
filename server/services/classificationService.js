/**
 * classificationService.js
 * ========================
 * Service untuk klasifikasi sampah menggunakan model TensorFlow.js (MobileNetV2).
 * Model di-load sekali saat startup dan digunakan untuk semua request (singleton).
 *
 * Input : Buffer gambar JPEG dari ESP32-CAM
 * Output: { jenis: "Organik"|"Anorganik", confidence: 0.95 }
 */

const tf = require("@tensorflow/tfjs-node");
const path = require("path");
const fs = require("fs");
const logger = require("../utils/logger");

class ClassificationService {
  constructor() {
    this.model = null;
    this.isReady = false;
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
      // Check if model files exist
      if (!fs.existsSync(this.modelPath)) {
        logger.warning(
          `Model file not found at: ${this.modelPath}. Classification service will be unavailable.`,
        );
        logger.info(
          "To enable classification, run: cd model && python train_model.py",
        );
        return false;
      }

      logger.info(`Loading classification model from: ${this.modelPath}`);
      const startTime = Date.now();

      // Load TFJS model (LayersModel from Keras conversion)
      this.model = await tf.loadLayersModel(`file://${this.modelPath}`);

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
      return true;
    } catch (error) {
      logger.error("Failed to load classification model", error);
      this.isReady = false;
      return false;
    }
  }

  /**
   * Klasifikasi gambar sampah.
   *
   * @param {Buffer} imageBuffer - Raw JPEG image buffer dari ESP32-CAM
   * @returns {Object} { jenis: string, confidence: number, raw_score: number }
   */
  async classify(imageBuffer) {
    if (!this.isReady || !this.model) {
      throw new Error(
        "Classification model is not loaded. Run train_model.py first.",
      );
    }

    let tensor = null;
    let prediction = null;

    try {
      const startTime = Date.now();

      // 1. Decode JPEG buffer ke tensor
      tensor = tf.node.decodeImage(imageBuffer, 3); // Force 3 channels (RGB)

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
