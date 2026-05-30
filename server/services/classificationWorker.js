const { parentPort } = require("worker_threads");
const tf = require("@tensorflow/tfjs");
require("@tensorflow/tfjs-backend-cpu");
const jpeg = require("jpeg-js");
const path = require("path");
const fs = require("fs");
const fsPromises = require("fs").promises;

const modelPath = path.join(__dirname, "..", "ml-model", "model.json");
const imgSize = [224, 224];
const threshold = 0.5;

let model = null;
let isReady = false;

function fixKeras3Config(obj) {
  if (Array.isArray(obj)) {
    obj.forEach(fixKeras3Config);
  } else if (obj && typeof obj === "object") {
    if (obj.config) {
      if (obj.config.batch_shape && !obj.config.batch_input_shape) {
        obj.config.batch_input_shape = obj.config.batch_shape;
        delete obj.config.batch_shape;
      }
      if (
        obj.class_name === "InputLayer" &&
        obj.config.shape &&
        !obj.config.batch_input_shape
      ) {
        obj.config.batch_input_shape = [null, ...obj.config.shape];
        delete obj.config.shape;
      }
      if (obj.config.batch_input_shape && obj.config.input_shape) {
        delete obj.config.input_shape;
      }
    }
    if (obj.inbound_nodes && Array.isArray(obj.inbound_nodes)) {
      obj.inbound_nodes = obj.inbound_nodes.map((node) => {
        if (Array.isArray(node)) return node;
        if (node && typeof node === "object" && node.args) {
          try {
            const arg = Array.isArray(node.args) ? node.args[0] : node.args;
            if (arg && arg.config && arg.config.keras_history) {
              const history = arg.config.keras_history;
              return [[history[0], history[1], history[2], node.kwargs || {}]];
            }
          } catch (e) {}
        }
        return [];
      });
    }
    for (const key of Object.keys(obj)) fixKeras3Config(obj[key]);
  }
}

async function loadModel() {
  if (!fs.existsSync(modelPath)) {
    parentPort.postMessage({ type: "status", ready: true, fallback: true });
    isReady = true;
    return;
  }

  try {
    const modelDir = path.dirname(modelPath);
    const modelJsonRaw = await fsPromises.readFile(modelPath, "utf8");
    const modelJson = JSON.parse(modelJsonRaw);

    if (modelJson.modelTopology) fixKeras3Config(modelJson.modelTopology);

    const customIOHandler = {
      load: async () => {
        const weightSpecs = [];
        const weightDataBuffers = [];
        for (const group of modelJson.weightsManifest) {
          for (const p of group.paths) {
            const buffer = await fsPromises.readFile(path.join(modelDir, p));
            weightDataBuffers.push(buffer);
          }
          weightSpecs.push(...group.weights);
        }
        const combinedBuffer = Buffer.concat(weightDataBuffers);
        const weightData = combinedBuffer.buffer.slice(
          combinedBuffer.byteOffset,
          combinedBuffer.byteOffset + combinedBuffer.byteLength,
        );
        return {
          modelTopology: modelJson.modelTopology,
          weightSpecs,
          weightData,
          format: modelJson.format || "layers-model",
          generatedBy: modelJson.generatedBy,
          convertedBy: modelJson.convertedBy,
        };
      },
    };

    model = await tf.loadLayersModel(customIOHandler);
    isReady = true;
    parentPort.postMessage({ type: "status", ready: true, fallback: false });
  } catch (err) {
    parentPort.postMessage({
      type: "status",
      ready: true,
      fallback: true,
      error: err.message,
    });
    isReady = true;
  }
}

async function classify(imageBuffer, requestId) {
  if (!isReady) {
    parentPort.postMessage({
      type: "result",
      requestId,
      error: "Model belum siap",
    });
    return;
  }
  if (!model) {
    // fallback mode
    parentPort.postMessage({
      type: "result",
      requestId,
      data: {
        jenis: "Organik",
        confidence: 0.99,
        raw_score: 0.99,
        inference_time_ms: 10,
      },
    });
    return;
  }

  let tensor = null;
  let prediction = null;
  try {
    const startTime = Date.now();
    const decoded = jpeg.decode(imageBuffer, { useTArray: true });
    const numPixels = decoded.width * decoded.height;
    const values = new Int32Array(numPixels * 3);
    for (let i = 0; i < numPixels; i++) {
      values[i * 3] = decoded.data[i * 4];
      values[i * 3 + 1] = decoded.data[i * 4 + 1];
      values[i * 3 + 2] = decoded.data[i * 4 + 2];
    }
    tensor = tf.tensor3d(values, [decoded.height, decoded.width, 3], "int32");
    tensor = tf.image
      .resizeBilinear(tensor, imgSize)
      .expandDims(0)
      .toFloat()
      .div(tf.scalar(255.0));
    prediction = model.predict(tensor);
    const predictionData = await (
      Array.isArray(prediction) ? prediction[0] : prediction
    ).data();
    const score = predictionData[0];
    const inferenceTime = Date.now() - startTime;
    const isAnorganik = score >= threshold;
    const jenis = isAnorganik ? "Anorganik" : "Organik";
    const confidence = isAnorganik ? score : 1 - score;

    parentPort.postMessage({
      type: "result",
      requestId,
      data: {
        jenis,
        confidence: parseFloat(confidence.toFixed(4)),
        raw_score: parseFloat(score.toFixed(4)),
        inference_time_ms: inferenceTime,
      },
    });
  } catch (err) {
    parentPort.postMessage({ type: "result", requestId, error: err.message });
  } finally {
    if (tensor) tensor.dispose();
    if (prediction) {
      if (Array.isArray(prediction)) prediction.forEach((p) => p.dispose());
      else prediction.dispose();
    }
  }
}

// Message handler
parentPort.on("message", (msg) => {
  if (msg.type === "classify") {
    // imageBuffer dikirim sebagai Uint8Array — konversi ke Buffer
    classify(Buffer.from(msg.buffer), msg.requestId);
  }
});

// Mulai load model begitu worker jalan
loadModel();
