/**
 * esp32cam_waste_classifier.ino
 * =============================
 * Sketch Arduino untuk ESP32-CAM (AI-Thinker board).
 *
 * Fungsi:
 * 1. Capture foto dari kamera OV2640
 * 2. Kirim gambar ke server Node.js via HTTP POST
 * 3. Terima hasil klasifikasi (Organik/Anorganik)
 * 4. Gerakkan servo ke arah yang sesuai
 *
 * Wiring:
 * - Servo signal → GPIO 12
 * - (Optional) Push button → GPIO 13
 * - (Optional) LED indicator → GPIO 4 (built-in flash)
 *
 * Server endpoint: POST http://SERVER_IP:5000/api/classify
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
const char* WIFI_SSID     = "SSID";      // ← Ganti dengan SSID WiFi
const char* WIFI_PASSWORD = "PASSWORD";   // ← Ganti dengan password WiFi

// Server configuration
const char* SERVER_IP   = "IPLOKAL";   // ← Ganti dengan IP server Node.js
const int   SERVER_PORT = 3000;
const char* BIN_ID      = "bin-001";

// Servo configuration
#define SERVO_PIN       12
#define SERVO_ORGANIK   0      // Posisi servo untuk sampah Organik (derajat)
#define SERVO_ANORGANIK 180    // Posisi servo untuk sampah Anorganik (derajat)
#define SERVO_NETRAL    90     // Posisi servo netral/tengah

// Timing
#define SERVO_HOLD_MS   3000   // Berapa lama servo di posisi pemilahan (ms)
#define CAPTURE_DELAY   1000   // Delay antar capture (ms) - Nyala terus menerus

// Button (optional, set ke -1 jika tidak pakai)
#define BUTTON_PIN      13     // GPIO untuk push button trigger
#define USE_BUTTON      false  // true = pakai button, false = auto capture

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

// ============================================================================
// Setup
// ============================================================================

void setup() {
  Serial.begin(115200);
  Serial.println("\n===================================");
  Serial.println("🗑️  SmartBin Waste Classifier");
  Serial.println("   ESP32-CAM + MobileNetV2");
  Serial.println("===================================\n");

  // Init LED (nyala terus menerus untuk menerangi objek)
  pinMode(LED_FLASH, OUTPUT);
  digitalWrite(LED_FLASH, HIGH);

  // Init button (optional)
  if (USE_BUTTON && BUTTON_PIN >= 0) {
    pinMode(BUTTON_PIN, INPUT_PULLUP);
    Serial.println("🔘 Button mode: tekan tombol untuk capture");
  } else {
    Serial.println("🔄 Auto mode: capture otomatis setiap " + String(CAPTURE_DELAY / 1000) + " detik");
  }

  // Init servo
  servo.attach(SERVO_PIN);
  servo.write(SERVO_NETRAL);
  Serial.println("🔧 Servo initialized (netral: " + String(SERVO_NETRAL) + "°)");

  // Init camera
  initCamera();

  // Connect WiFi
  connectWiFi();

  Serial.println("\n✅ System ready!");
  Serial.println("   Server: http://" + String(SERVER_IP) + ":" + String(SERVER_PORT) + "/api/classify");
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

  bool shouldCapture = false;

  if (USE_BUTTON && BUTTON_PIN >= 0) {
    // Button mode: capture saat tombol ditekan
    if (digitalRead(BUTTON_PIN) == LOW) {
      delay(50);  // Debounce
      if (digitalRead(BUTTON_PIN) == LOW) {
        shouldCapture = true;
        // Wait for button release
        while (digitalRead(BUTTON_PIN) == LOW) {
          delay(10);
        }
      }
    }
  } else {
    // Auto mode: capture otomatis
    shouldCapture = true;
  }

  if (shouldCapture) {
    Serial.println("📸 Capturing image...");
    classifyAndSort();

    if (!USE_BUTTON) {
      delay(CAPTURE_DELAY);
    }
  }

  delay(100);  // Small delay to prevent tight loop
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

  // Gunakan QVGA untuk kecepatan, atau VGA untuk kualitas lebih baik
  // Model akan resize ke 224x224 di server
  if (psramFound()) {
    config.frame_size   = FRAMESIZE_CIF;     // 640x480
    config.jpeg_quality = 10;                // 0-63 (lower = better quality)
    config.fb_count     = 1;
    Serial.println("   PSRAM found → VGA mode (640x480)");
  } else {
    config.frame_size   = FRAMESIZE_QVGA;    // 320x240
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
    s->set_brightness(s, 1);    // Brightness: -2 to 2
    s->set_contrast(s, 1);      // Contrast: -2 to 2
    s->set_saturation(s, 0);    // Saturation: -2 to 2
    s->set_whitebal(s, 1);      // White balance: 0 = disable, 1 = enable
    s->set_awb_gain(s, 1);      // AWB gain: 0 = disable, 1 = enable
    s->set_wb_mode(s, 0);       // WB mode: 0 = auto
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
  WiFi.setSleep(false);  // Disable WiFi sleep for faster response

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
  // 1. Capture image
  camera_fb_t *fb = esp_camera_fb_get();
  if (!fb) {
    Serial.println("❌ Camera capture failed!");
    return;
  }

  Serial.printf("   Image size: %d bytes (%dx%d)\n", fb->len, fb->width, fb->height);

  // 2. Flash LED stays ON continuously, no need to toggle
  delay(50); // Small delay for camera exposure adjustment if needed

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
  http.setTimeout(15000);  // 15 second timeout

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
