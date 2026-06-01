/**
 * esp32cam_waste_classifier.ino
 * =============================
 * Sketch Arduino untuk ESP32-CAM (AI-Thinker board).
 *
 * Fungsi:
 * 1. IR sensor mendeteksi objek di depan kamera
 * 2. Capture foto dari kamera OV2640
 * 3. Kirim gambar ke server Node.js via HTTP POST
 * 4. Terima hasil klasifikasi (Organik/Anorganik)
 * 5. Gerakkan servo ke arah yang sesuai
 * 6. Ukur kedalaman bin Organik & Anorganik via ultrasonik
 * 7. Kirim data level bin ke server
 *
 * Wiring:
 * - Servo signal       → GPIO 12
 * - IR sensor OUT      → GPIO 13  (LOW = ada objek)
 * - HC-SR04 shared TRIG→ GPIO 14
 * - HC-SR04 #1 ECHO    → GPIO 15  (bin Organik)
 * - HC-SR04 #2 ECHO    → GPIO 2   (bin Anorganik)
 * - LED flash (built-in) → GPIO 4
 *
 * Server endpoints:
 *   POST http://SERVER_IP:3000/api/classify
 *   POST http://SERVER_IP:3000/api/bins/level
 */

#include "esp_camera.h"
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

// ============================================================================
// CONFIGURATION - UBAH SESUAI KEBUTUHAN
// ============================================================================

// WiFi credentials
const char* WIFI_SSID     = "Maul";              // ← Ganti dengan SSID WiFi
const char* WIFI_PASSWORD = "satusampedelapan";   // ← Ganti dengan password WiFi

// Server configuration
const char* SERVER_IP   = "192.168.112.197";   // ← Ganti dengan IP server Node.js
const int   SERVER_PORT = 3000;
const char* BIN_ID      = "bin-001";

// Servo configuration
#define SERVO_PIN       12
#define SERVO_ORGANIK   0      // Posisi servo untuk sampah Organik (derajat)
#define SERVO_ANORGANIK 180    // Posisi servo untuk sampah Anorganik (derajat)
#define SERVO_NETRAL    90     // Posisi servo netral/tengah
#define SERVO_HOLD_MS   3000   // Berapa lama servo di posisi pemilahan (ms)

// IR Obstacle Avoidance Sensor (trigger kamera)
#define IR_SENSOR_PIN   13     // OUT pin IR sensor (LOW = ada objek terdeteksi)

// Ultrasonik HC-SR04 (kedalaman bin)
#define TRIG_PIN        14     // Shared TRIG untuk kedua sensor
#define ECHO_ORGANIK    15     // ECHO sensor bin Organik
#define ECHO_ANORGANIK  2      // ECHO sensor bin Anorganik

// Parameter fisik bin
#define BIN_DEPTH_CM    26.0   // Jarak sensor ke dasar bin (cm)
#define MIN_DISTANCE_CM 2.0    // Jarak minimum sensor (cm)

// Timing
#define TRIGGER_COOLDOWN 3000  // Cooldown setelah deteksi (ms)
#define SCAN_INTERVAL    200   // Interval polling IR sensor (ms)

// LED
#define LED_FLASH       4      // Built-in flash LED

// ============================================================================
// AI-Thinker ESP32-CAM Pin Configuration
// ============================================================================

#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

// ============================================================================
// Global Variables
// ============================================================================

Servo servo;
bool cameraReady = false;
unsigned long lastTriggerTime = 0;  // Untuk cooldown

// ============================================================================
// Setup
// ============================================================================

void setup() {
  Serial.begin(115200);
  Serial.println("\n===================================");
  Serial.println("🗑️  SmartBin Waste Classifier");
  Serial.println("   ESP32-CAM + IR + Ultrasonik");
  Serial.println("===================================\n");

  // Init LED (nyala terus untuk menerangi objek)
  pinMode(LED_FLASH, OUTPUT);
  digitalWrite(LED_FLASH, HIGH);

  // Init IR sensor
  pinMode(IR_SENSOR_PIN, INPUT);
  Serial.println("🔴 IR sensor initialized (GPIO " + String(IR_SENSOR_PIN) + ")");

  // Init ultrasonic pins
  pinMode(TRIG_PIN, OUTPUT);
  digitalWrite(TRIG_PIN, LOW);
  pinMode(ECHO_ORGANIK, INPUT);
  pinMode(ECHO_ANORGANIK, INPUT);
  Serial.println("📏 Ultrasonic sensors initialized");
  Serial.println("   TRIG (shared): GPIO " + String(TRIG_PIN));
  Serial.println("   ECHO Organik : GPIO " + String(ECHO_ORGANIK));
  Serial.println("   ECHO Anorganik: GPIO " + String(ECHO_ANORGANIK));

  // Init servo
  servo.attach(SERVO_PIN);
  servo.write(SERVO_NETRAL);
  Serial.println("🔧 Servo initialized (netral: " + String(SERVO_NETRAL) + "°)");

  // Init camera
  initCamera();

  // Connect WiFi
  connectWiFi();

  // Ukur bin level awal
  Serial.println("\n📏 Pengukuran awal level bin...");
  float distOrganik = measureDistance(ECHO_ORGANIK);
  float distAnorganik = measureDistance(ECHO_ANORGANIK);
  Serial.printf("   Organik  : %.1f cm\n", distOrganik);
  Serial.printf("   Anorganik: %.1f cm\n", distAnorganik);

  Serial.println("\n✅ System ready!");
  Serial.println("   Mode: IR Trigger (menunggu objek di depan kamera)");
  Serial.println("   Server: http://" + String(SERVER_IP) + ":" + String(SERVER_PORT));
  Serial.println("-----------------------------------\n");
}

// ============================================================================
// Loop
// ============================================================================

void loop() {
  if (!cameraReady) {
    Serial.println("❌ Camera not ready");
    delay(5000);
    return;
  }

  // Check WiFi connection
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("⚠️  WiFi disconnected, reconnecting...");
    connectWiFi();
  }

  // Check cooldown
  if (millis() - lastTriggerTime < TRIGGER_COOLDOWN) {
    delay(SCAN_INTERVAL);
    return;
  }

  // Cek IR sensor: ada objek di depan kamera?
  if (checkObjectPresence()) {
    Serial.println("\n🔔 OBJEK TERDETEKSI oleh IR sensor!");
    lastTriggerTime = millis();

    // 1. Capture + classify + servo
    Serial.println("📸 Capturing image...");
    classifyAndSort();

    // 2. Setelah servo kembali netral, ukur kedalaman bin
    Serial.println("📏 Mengukur kedalaman bin...");
    measureAndSendBinLevels();

    Serial.println("⏳ Cooldown " + String(TRIGGER_COOLDOWN / 1000) + " detik...\n");
  }

  delay(SCAN_INTERVAL);
}

// ============================================================================
// IR Sensor - Deteksi Objek
// ============================================================================

/**
 * Cek apakah IR obstacle sensor mendeteksi objek.
 * IR sensor FC-51: OUT = LOW saat ada objek, HIGH saat tidak ada.
 */
bool checkObjectPresence() {
  return digitalRead(IR_SENSOR_PIN) == LOW;
}

// ============================================================================
// Ultrasonic HC-SR04 - Ukur Jarak
// ============================================================================

/**
 * Mengukur jarak menggunakan sensor ultrasonik HC-SR04.
 * Menggunakan shared TRIG pin (GPIO 14) dan echo pin yang ditentukan.
 *
 * @param echoPin - Pin ECHO sensor yang ingin dibaca
 * @return Jarak dalam cm, atau -1 jika timeout/error
 */
float measureDistance(int echoPin) {
  // Pastikan TRIG LOW dulu
  digitalWrite(TRIG_PIN, LOW);
  delayMicroseconds(2);

  // Kirim pulse 10µs
  digitalWrite(TRIG_PIN, HIGH);
  delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);

  // Baca durasi echo (timeout 30ms = ~500cm max)
  long duration = pulseIn(echoPin, HIGH, 30000);

  if (duration == 0) {
    return -1;  // Timeout — sensor tidak mendeteksi echo
  }

  // Hitung jarak: kecepatan suara = 343 m/s = 0.0343 cm/µs
  // Jarak = (duration / 2) * 0.0343
  float distance = (duration / 2.0) * 0.0343;

  // Filter noise: jarak di luar range wajar
  if (distance < MIN_DISTANCE_CM || distance > BIN_DEPTH_CM + 10) {
    return -1;
  }

  return distance;
}

/**
 * Hitung rata-rata dari beberapa pengukuran untuk akurasi lebih baik.
 * Mengambil 3 sampel dan mengembalikan median.
 */
float measureDistanceAvg(int echoPin) {
  float readings[3];
  int validCount = 0;

  for (int i = 0; i < 3; i++) {
    float d = measureDistance(echoPin);
    if (d > 0) {
      readings[validCount++] = d;
    }
    delay(60);  // Delay antar pengukuran untuk menghindari interference
  }

  if (validCount == 0) return -1;
  if (validCount == 1) return readings[0];

  // Urutkan dan ambil median
  for (int i = 0; i < validCount - 1; i++) {
    for (int j = i + 1; j < validCount; j++) {
      if (readings[i] > readings[j]) {
        float temp = readings[i];
        readings[i] = readings[j];
        readings[j] = temp;
      }
    }
  }

  return readings[validCount / 2];
}

// ============================================================================
// Measure & Send Bin Levels
// ============================================================================

/**
 * Mengukur kedalaman kedua bin dan mengirim data level ke server.
 */
void measureAndSendBinLevels() {
  float distOrganik = measureDistanceAvg(ECHO_ORGANIK);
  float distAnorganik = measureDistanceAvg(ECHO_ANORGANIK);

  // Hitung persentase kepenuhan
  float levelOrganik = 0;
  float levelAnorganik = 0;

  if (distOrganik > 0) {
    levelOrganik = ((BIN_DEPTH_CM - distOrganik) / BIN_DEPTH_CM) * 100.0;
    if (levelOrganik < 0) levelOrganik = 0;
    if (levelOrganik > 100) levelOrganik = 100;
  }

  if (distAnorganik > 0) {
    levelAnorganik = ((BIN_DEPTH_CM - distAnorganik) / BIN_DEPTH_CM) * 100.0;
    if (levelAnorganik < 0) levelAnorganik = 0;
    if (levelAnorganik > 100) levelAnorganik = 100;
  }

  Serial.println("\n   ┌─────────────────────────────┐");
  Serial.println("   │ 📏 LEVEL BIN                 │");
  Serial.printf( "   │ Organik  : %.1f cm → %.0f%%    │\n", distOrganik, levelOrganik);
  Serial.printf( "   │ Anorganik: %.1f cm → %.0f%%    │\n", distAnorganik, levelAnorganik);
  Serial.println("   └─────────────────────────────┘\n");

  // Kirim ke server
  sendBinLevels(levelOrganik, levelAnorganik, distOrganik, distAnorganik);
}

/**
 * Kirim data level bin ke server via HTTP POST.
 */
void sendBinLevels(float levelOrganik, float levelAnorganik, float distOrganik, float distAnorganik) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected, skip sending bin levels");
    return;
  }

  HTTPClient http;
  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/bins/level";

  // Buat JSON payload
  JsonDocument doc;
  doc["binId"] = BIN_ID;
  doc["organik_persen"] = round(levelOrganik);
  doc["anorganik_persen"] = round(levelAnorganik);
  doc["organik_cm"] = round(distOrganik * 10) / 10.0;
  doc["anorganik_cm"] = round(distAnorganik * 10) / 10.0;
  doc["bin_depth_cm"] = BIN_DEPTH_CM;

  String jsonPayload;
  serializeJson(doc, jsonPayload);

  Serial.println("📤 Sending bin levels to: " + url);
  Serial.println("   Payload: " + jsonPayload);

  http.begin(url);
  http.addHeader("Content-Type", "application/json");
  http.setTimeout(10000);

  int httpCode = http.POST(jsonPayload);

  if (httpCode > 0) {
    String response = http.getString();
    Serial.printf("   Response: HTTP %d\n", httpCode);
    Serial.println("   " + response);
  } else {
    Serial.printf("   ❌ HTTP error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
}

// ============================================================================
// Camera Initialization
// ============================================================================

void initCamera() {
  Serial.println("📷 Initializing camera...");

  camera_config_t config;
  config.ledc_channel = LEDC_CHANNEL_0;
  config.ledc_timer   = LEDC_TIMER_0;
  config.pin_d0       = Y2_GPIO_NUM;
  config.pin_d1       = Y3_GPIO_NUM;
  config.pin_d2       = Y4_GPIO_NUM;
  config.pin_d3       = Y5_GPIO_NUM;
  config.pin_d4       = Y6_GPIO_NUM;
  config.pin_d5       = Y7_GPIO_NUM;
  config.pin_d6       = Y8_GPIO_NUM;
  config.pin_d7       = Y9_GPIO_NUM;
  config.pin_xclk     = XCLK_GPIO_NUM;
  config.pin_pclk     = PCLK_GPIO_NUM;
  config.pin_vsync    = VSYNC_GPIO_NUM;
  config.pin_href     = HREF_GPIO_NUM;
  config.pin_sccb_sda = SIOD_GPIO_NUM;
  config.pin_sccb_scl = SIOC_GPIO_NUM;
  config.pin_pwdn     = PWDN_GPIO_NUM;
  config.pin_reset    = RESET_GPIO_NUM;
  config.xclk_freq_hz = 20000000;
  config.pixel_format = PIXFORMAT_JPEG;

  // Gunakan CIF untuk balance kecepatan dan kualitas
  if (psramFound()) {
    config.frame_size   = FRAMESIZE_CIF;      // 400x296
    config.jpeg_quality = 10;
    config.fb_count     = 1;
    Serial.println("   PSRAM found → CIF mode (400x296)");
  } else {
    config.frame_size   = FRAMESIZE_QVGA;     // 320x240
    config.jpeg_quality = 15;
    config.fb_count     = 1;
    Serial.println("   No PSRAM → QVGA mode (320x240)");
  }

  // Init camera
  esp_err_t err = esp_camera_init(&config);
  if (err != ESP_OK) {
    Serial.printf("❌ Camera init failed with error 0x%x\n", err);
    cameraReady = false;
    return;
  }

  // Camera settings optimization
  sensor_t *s = esp_camera_sensor_get();
  if (s) {
    s->set_brightness(s, 1);
    s->set_contrast(s, 1);
    s->set_saturation(s, 0);
    s->set_whitebal(s, 1);
    s->set_awb_gain(s, 1);
    s->set_wb_mode(s, 0);
  }

  cameraReady = true;
  Serial.println("✅ Camera initialized!");
}

// ============================================================================
// WiFi Connection
// ============================================================================

void connectWiFi() {
  Serial.print("📶 Connecting to WiFi: " + String(WIFI_SSID));

  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  WiFi.setSleep(false);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30) {
    delay(500);
    Serial.print(".");
    attempts++;
  }

  if (WiFi.status() == WL_CONNECTED) {
    Serial.println(" Connected!");
    Serial.println("   IP Address: " + WiFi.localIP().toString());
    Serial.println("   Signal: " + String(WiFi.RSSI()) + " dBm");
  } else {
    Serial.println(" FAILED!");
    Serial.println("   ❌ Could not connect to WiFi. Check credentials.");
  }
}

// ============================================================================
// Main Classification + Sorting Logic
// ============================================================================

void classifyAndSort() {
  // 1. Bersihkan buffer kamera (Buang frame usang/stale yang mengendap di DMA memori)
  // Kita melakukan capture dan langsung mengembalikannya untuk memicu sensor mengambil frame baru
  camera_fb_t *fbTemp = esp_camera_fb_get();
  if (fbTemp) {
    esp_camera_fb_return(fbTemp);
    fbTemp = NULL;
  }
  
  // Berikan delay sangat singkat (100ms) agar sensor kamera sempat menyesuaikan pencahayaan/eksposur otomatis
  delay(100);

  // 2. Capture image yang sesungguhnya (Fresh Frame!)
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Camera capture failed!");
    return;
  }

  Serial.printf("   Image size: %d bytes (%dx%d)\n", fb->len, fb->width, fb->height);

  // 3. Send to server
  String result = sendImageToServer(fb->buf, fb->len);

  // 4. Release camera buffer immediately
  esp_camera_fb_return(fb);

  // 5. Parse response and move servo
  if (result.length() > 0) {
    parseAndAct(result);
  }
}

// ============================================================================
// Send Image to Server
// ============================================================================

String sendImageToServer(uint8_t *imageData, size_t imageLen) {
  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("❌ WiFi not connected!");
    return "";
  }

  HTTPClient http;
  String url = "http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/classify?binId=" + String(BIN_ID);

  Serial.println("📤 Sending to: " + url);

  http.begin(url);
  http.addHeader("Content-Type", "image/jpeg");
  http.addHeader("X-Bin-Id", BIN_ID);
  http.setTimeout(15000);

  unsigned long startTime = millis();
  int httpCode = http.POST(imageData, imageLen);
  unsigned long elapsed = millis() - startTime;

  String response = "";

  if (httpCode > 0) {
    response = http.getString();
    Serial.printf("   Response (%dms): HTTP %d\n", elapsed, httpCode);
    Serial.println("   " + response);
  } else {
    Serial.printf("   ❌ HTTP error: %s\n", http.errorToString(httpCode).c_str());
  }

  http.end();
  return response;
}

// ============================================================================
// Parse Server Response & Move Servo
// ============================================================================

void parseAndAct(String jsonResponse) {
  // Parse JSON response
  JsonDocument doc;
  DeserializationError error = deserializeJson(doc, jsonResponse);

  if (error) {
    Serial.println("   ❌ JSON parse error: " + String(error.c_str()));
    return;
  }

  bool success = doc["success"] | false;
  if (!success) {
    String message = doc["message"] | "Unknown error";
    Serial.println("   ❌ Server error: " + message);
    return;
  }

  // Extract classification result
  const char* jenis = doc["data"]["jenis"] | "Unknown";
  float confidence = doc["data"]["confidence"] | 0.0;
  int inferenceTime = doc["data"]["inference_time_ms"] | 0;

  Serial.println("\n   ┌─────────────────────────────┐");
  Serial.println("   │ 🗑️  HASIL KLASIFIKASI        │");
  Serial.printf( "   │ Jenis     : %-15s │\n", jenis);
  Serial.printf( "   │ Confidence: %.1f%%           │\n", confidence * 100);
  Serial.printf( "   │ Inference : %dms             │\n", inferenceTime);
  Serial.println("   └─────────────────────────────┘\n");

  // Move servo based on classification
  if (String(jenis) == "Organik") {
    Serial.println("   🟢 Servo → ORGANIK (" + String(SERVO_ORGANIK) + "°)");
    servo.write(SERVO_ORGANIK);
  } else if (String(jenis) == "Anorganik") {
    Serial.println("   🔴 Servo → ANORGANIK (" + String(SERVO_ANORGANIK) + "°)");
    servo.write(SERVO_ANORGANIK);
  } else {
    Serial.println("   ⚪ Unknown type, staying neutral");
    return;
  }

  // Hold position
  delay(SERVO_HOLD_MS);

  // Return to neutral
  servo.write(SERVO_NETRAL);
  Serial.println("   ⬜ Servo → NETRAL (" + String(SERVO_NETRAL) + "°)\n");
}
