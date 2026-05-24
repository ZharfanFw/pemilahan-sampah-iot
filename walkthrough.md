# Walkthrough: Waste Classification Model (Organik vs Anorganik)

Implementasi sistem klasifikasi sampah menggunakan **MobileNetV2 transfer learning**, terintegrasi dengan server Node.js dan ESP32-CAM.

## Files Created/Modified

### Komponen 1: Training Model (Python) — `model/`

#### [NEW] [train_model.py](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/model/train_model.py)
Script training lengkap dengan:
- **Download dataset** otomatis dari Kaggle via `opendatasets`
- **Data augmentation**: rotation, shift, zoom, flip, brightness
- **Two-phase training**:
  - Phase 1: Train custom head saja (MobileNetV2 frozen, 15 epochs, lr=1e-3)
  - Phase 2: Fine-tune top 55 layers MobileNetV2 (10 epochs, lr=1e-5)
- **Evaluasi**: confusion matrix, classification report, training history plot
- **Export otomatis** ke format TFJS (`server/ml-model/`)

#### [NEW] [convert_model.py](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/model/convert_model.py)
Script terpisah untuk konversi model `.h5` → TFJS jika perlu re-convert.

#### [NEW] [requirements.txt](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/model/requirements.txt)
Dependencies: tensorflow, tensorflowjs, numpy, matplotlib, scikit-learn, Pillow, opendatasets, seaborn.

---

### Komponen 2: Server Inference (Node.js) — `server/`

#### [NEW] [classificationService.js](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/server/services/classificationService.js)
Singleton service yang:
- Load model TFJS **satu kali** saat startup (warm-up included)
- Method `classify(imageBuffer)` — decode JPEG → resize 224×224 → normalize → predict
- Memory-safe: semua tensor di-dispose setelah inference
- Return: `{ jenis, confidence, raw_score, inference_time_ms }`

#### [NEW] [classifyController.js](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/server/controllers/classifyController.js)
Controller yang:
- Menerima raw JPEG dari `req.body`
- Panggil `classificationService.classify()`
- Simpan hasil ke **Firebase RTDB** (reuse struktur data dari `mqttService`)
- Publish ke **MQTT** topic `smartbin/classification`
- Tambah field `source: "esp32cam_http"` untuk membedakan dari MQTT-based classification

#### [NEW] [classify.js](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/server/routes/classify.js)
Routes:
- `POST /api/classify` — terima image JPEG, max 5MB
- `GET /api/classify/status` — cek status model

#### [MODIFY] [server.js](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/server/server.js)
- Register route `/api/classify`
- Load ML model async saat startup (tidak block server)

#### [MODIFY] [package.json](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/server/package.json)
- Tambah dependency `@tensorflow/tfjs-node: ^4.22.0`

---

### Komponen 3: ESP32-CAM Arduino — `esp32cam/`

#### [NEW] [esp32cam_waste_classifier.ino](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/esp32cam/esp32cam_waste_classifier.ino)
Sketch lengkap untuk AI-Thinker ESP32-CAM:
- **Kamera**: OV2640, auto-detect PSRAM (VGA jika ada, QVGA jika tidak)
- **WiFi**: auto-reconnect
- **Capture mode**: auto-capture per 5 detik atau button-trigger (configurable)
- **HTTP POST**: kirim raw JPEG ke `POST /api/classify`
- **Servo**: Organik → 0°, Anorganik → 180°, kembali ke netral setelah 3 detik
- **Serial output**: formatted table dengan hasil klasifikasi

---

### Komponen 4: Housekeeping

#### [MODIFY] [.gitignore](file:///c:/Maulana/College/CODING/Semester%204/IOT/Tubes/Project/pemilahan-sampah-iot/.gitignore)
- Ignore: `model/dataset/`, `model/*.h5`, training artifacts
- Keep: `server/ml-model/` (TFJS model files, committed to repo)

---

## Cara Penggunaan

### Step 1: Training Model (Python)
```bash
cd model
pip install -r requirements.txt
python train_model.py
# → Output: waste_classifier.h5 + server/ml-model/ (TFJS)
```

> Atau gunakan Google Colab: upload `train_model.py` dan `requirements.txt`, lalu jalankan.

### Step 2: Jalankan Server
```bash
cd server
npm install
npm run dev
# → Model auto-loaded saat startup
# → Endpoint: POST http://localhost:5000/api/classify
```

### Step 3: Test Endpoint
```bash
curl -X POST http://localhost:5000/api/classify \
  -H "Content-Type: image/jpeg" \
  --data-binary @test_image.jpg
```

### Step 4: Upload Sketch ke ESP32-CAM
1. Buka `esp32cam/esp32cam_waste_classifier.ino` di Arduino IDE
2. Edit WiFi credentials dan server IP
3. Install library: `ArduinoJson`, `ESP32Servo`
4. Board: AI-Thinker ESP32-CAM
5. Upload dan monitor via Serial Monitor (115200 baud)
