#include <WiFi.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <secrets.h>

#define ONE_WIRE_BUS 33
#define LED_PIN 25
#define ANALOG_PIN 35
#define DIGITAL_PIN 13
#define AIR_QUALITY_PIN 34
#define LIGHT_DIGITAL_PIN 27
#define LIGHT_ANALOG_PIN 32
#define READ_INTERVAL_MS 1000
#define PUMP_PIN 17

bool pumpState = false;
unsigned long lastPumpCheck = 0;
const unsigned long PUMP_CHECK_INTERVAL = 2000;

// Millis-based timing variables
unsigned long lastSensorRead = 0;
unsigned long lastTempRequest = 0;
bool tempRequested = false;
const unsigned long SENSOR_READ_INTERVAL = 5000;      // 5 sekundi između čitanja senzora
const unsigned long TEMP_CONVERSION_TIME = 750;       // DS18B20 treba ~750ms za konverziju
const unsigned long LED_CHECK_INTERVAL = 500;         // Provjera LED svakih 500ms
unsigned long lastLedCheck = 0;


const char* ssid = WLAN_SSID;
const char* password = WLAN_PASSWORD;
const char* temperatureURL = TEMPERATURE_URL;
const char* ledURL = LED_URL;
const char* soilMoistureURL = SOIL_MOISTURE_URL;
const char* coURL = CO_URL;
const char* nh3URL = NH3_URL;
const char* ch4URL = CH4_URL;
const char* lightPercentURL = LIGHT_PERCENT_URL;
const char* lightStatusURL = LIGHT_STATUS_URL;
const char* pumpURL = PUMP_URL;

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void sendDataToFirebase(const char* url, float value) {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    String json = String(value);
    int httpResponseCode = http.PUT(json);
    if (httpResponseCode > 0) {
      Serial.print("\nFirebase response code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Error prilikom povezivanja sa firebase: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
}

bool readPumpStatusFromFirebase() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(pumpURL);
    int httpCode = http.GET();

    if (httpCode == 200) {
      String payload = http.getString();
      payload.trim();
      http.end();

      Serial.print("Pump status: ");
      Serial.println(payload);

      return (payload == "true");
    }

    http.end();
  }
  return false;
}


bool readLEDStatusFromFirebase() {
  if (WiFi.status() == WL_CONNECTED) {
    HTTPClient http;
    http.begin(ledURL);
    int httpResponseCode = http.GET();
    if (httpResponseCode == 200) {
      String payload = http.getString();
      http.end();
      payload.trim();
      Serial.print("Status LED diode: ");
      Serial.println(payload);
      return (payload == "true");
    } else {
      Serial.print("Greska prilikom citanja podataka sa firebase-a: ");
      Serial.println(httpResponseCode);
      http.end();
      return false;
    }
    return false;
  }
  return false;
}

float analogToPPM(float voltage, const char* gasType) {
  if (strcmp(gasType, "CO") == 0) {
    return voltage * 100.0;  // aproksimacija
  } else if (strcmp(gasType, "NH3") == 0) {
    return voltage * 50.0;  // aproksimacija
  } else if (strcmp(gasType, "CH4") == 0) {
    return voltage * 80.0;  // aproksimacija
  }
  return 0;
}

void setup(void) {
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(DIGITAL_PIN, INPUT);
  pinMode(AIR_QUALITY_PIN, INPUT);
  pinMode(LIGHT_DIGITAL_PIN, INPUT);
  pinMode(PUMP_PIN, OUTPUT);
  digitalWrite(PUMP_PIN, LOW);
  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  delay(1000);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid, password);
  Serial.println("\nConnecting");
  while (WiFi.status() != WL_CONNECTED) {
    Serial.print(".");
    delay(100);
  }

  Serial.print("\nConnected to the WiFi network");
  Serial.print("\nLocal ESP32 IP: ");
  Serial.print(WiFi.localIP());

  sensors.begin();
}

void loop(void) {
  unsigned long currentMillis = millis();

  // ---------- LED CHECK (brza provjera svakih 500ms) ----------
  if (currentMillis - lastLedCheck >= LED_CHECK_INTERVAL) {
    lastLedCheck = currentMillis;
    bool ledStatus = readLEDStatusFromFirebase();
    digitalWrite(LED_PIN, ledStatus ? HIGH : LOW);
  }

  // ---------- PUMP CHECK (svakih 2 sekunde) ----------
  if (currentMillis - lastPumpCheck >= PUMP_CHECK_INTERVAL) {
    lastPumpCheck = currentMillis;
    bool firebasePumpState = readPumpStatusFromFirebase();
    if (firebasePumpState != pumpState) {
      pumpState = firebasePumpState;
      digitalWrite(PUMP_PIN, pumpState ? LOW : HIGH);
      Serial.print("Pumpa promijenila stanje: ");
      Serial.println(pumpState ? "ON" : "OFF");
    }
  }

  // ---------- TEMPERATURA - zatraži konverziju ----------
  if (!tempRequested && (currentMillis - lastSensorRead >= SENSOR_READ_INTERVAL)) {
    Serial.print("\nDohvacanje temperature...");
    sensors.setWaitForConversion(false);
    sensors.requestTemperatures();
    tempRequested = true;
    lastTempRequest = currentMillis;
  }

  // ---------- ČITANJE SENZORA (nakon što temperatura bude spremna) ----------
  if (tempRequested && (currentMillis - lastTempRequest >= TEMP_CONVERSION_TIME)) {
    tempRequested = false;
    lastSensorRead = currentMillis;
    Serial.println("Zavrseno");

    float tempC = sensors.getTempCByIndex(0);
    if (tempC != DEVICE_DISCONNECTED_C) {
      Serial.print("Temperatura: ");
      Serial.print(tempC);
      Serial.println(" C");
      sendDataToFirebase(temperatureURL, tempC);

      // ---------- VLAGA TLA ----------
      int analogValue = analogRead(ANALOG_PIN);
      int digitalValue = digitalRead(DIGITAL_PIN);
      float soilPercent = 100.0 - ((analogValue / 4095.0) * 100.0);

      Serial.print("Analogna vrijednost: ");
      Serial.print(analogValue);
      Serial.print("\nDigitalna vrijednost: ");
      Serial.println(digitalValue);
      Serial.print("Percent: ");
      Serial.print(soilPercent);
      Serial.println("%");

      sendDataToFirebase(soilMoistureURL, soilPercent);

      // ---------- KVALITETA ZRAKA ----------
      int airRaw = analogRead(AIR_QUALITY_PIN);
      float airVoltage = (airRaw / 4095.0) * 3.3;

      Serial.print("Air Quality AO Raw: ");
      Serial.print(airRaw);
      Serial.print(" | Voltage: ");
      Serial.print(airVoltage);
      Serial.println(" V");

      float coPPM = analogToPPM(airVoltage, "CO");
      float nh3PPM = analogToPPM(airVoltage, "NH3");
      float ch4PPM = analogToPPM(airVoltage, "CH4");

      Serial.print("CO: ");
      Serial.print(coPPM);
      Serial.println(" ppm");
      Serial.print("NH3: ");
      Serial.print(nh3PPM);
      Serial.println(" ppm");
      Serial.print("CH4: ");
      Serial.print(ch4PPM);
      Serial.println(" ppm");
      Serial.println("-------------------------");

      sendDataToFirebase(coURL, coPPM);
      sendDataToFirebase(nh3URL, nh3PPM);
      sendDataToFirebase(ch4URL, ch4PPM);

      // ---------- SVJETLOST ----------
      int lightDigital = digitalRead(LIGHT_DIGITAL_PIN);
      bool isDay = (lightDigital == LOW);
      sendDataToFirebase(lightStatusURL, isDay ? 1.0 : 0.0);

      Serial.print("Svjetlost digitalno: ");
      if (isDay) {
        Serial.println("DAN (dovoljno svjetla)");
      } else {
        Serial.println("NOĆ / SLABO SVJETLO)");
      }

      int lightAnalog = analogRead(LIGHT_ANALOG_PIN);
      float lightPercent = 100.0 - ((lightAnalog / 4095.0) * 100.0);

      Serial.print("Svjetlost analogno: ");
      Serial.print(lightPercent);
      Serial.println("%");

      sendDataToFirebase(lightPercentURL, lightPercent);

    } else {
      Serial.println("Error: Greska prilikom ucitavanja senzora temperature");
    }
  }
}


// #define PUMP_PIN 17

// void setup() {
//   Serial.begin(115200);
//   pinMode(PUMP_PIN, OUTPUT);
//   digitalWrite(PUMP_PIN, HIGH); // OFF (active LOW)
// }

// void loop() {
//   digitalWrite(PUMP_PIN, LOW);
//   delay(3000);
//   digitalWrite(PUMP_PIN, HIGH);
//   delay(3000);
// }

