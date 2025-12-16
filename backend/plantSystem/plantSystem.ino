#include <WiFi.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <secrets.h>

#define ONE_WIRE_BUS 33
#define LED_PIN 32
#define ANALOG_PIN 35
#define DIGITAL_PIN 13
#define AIR_QUALITY_PIN 34
#define READ_INTERVAL_MS 1000

const char* ssid = WLAN_SSID;
const char* password = WLAN_PASSWORD;
const char* temperatureURL = TEMPERATURE_URL;
const char* ledURL = LED_URL;
const char* soilMoistureURL = SOIL_MOISTURE_URL;

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void sendDataToFirebase(const char* url, float value){
  if(WiFi.status() == WL_CONNECTED){
    HTTPClient http;
    http.begin(url);
    http.addHeader("Content-Type", "application/json");
    String json = String(value);
    int httpResponseCode = http.PUT(json);
    if(httpResponseCode > 0){
      Serial.print("\nFirebase response code: ");
      Serial.println(httpResponseCode);
    } else {
      Serial.print("Error prilikom povezivanja sa firebase: ");
      Serial.println(httpResponseCode);
    }
    http.end();
  }
}

bool readLEDStatusFromFirebase(){
  if(WiFi.status() == WL_CONNECTED){
    HTTPClient http;
    http.begin(ledURL);
    int httpResponseCode = http.GET();
    if(httpResponseCode == 200){
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

float analogToPPM(float voltage, const char* gasType){
  if(strcmp(gasType, "CO") == 0){
    return voltage * 100.0;  // aproksimacija
  } else if(strcmp(gasType, "NH3") == 0){
    return voltage * 50.0;   // aproksimacija
  } else if(strcmp(gasType, "CH4") == 0){
    return voltage * 80.0;   // aproksimacija
  }
  return 0;
}

void setup(void){
  Serial.begin(115200);
  pinMode(LED_PIN, OUTPUT);
  pinMode(DIGITAL_PIN, INPUT);
  pinMode(AIR_QUALITY_PIN, INPUT);

  analogReadResolution(12);
  analogSetAttenuation(ADC_11db);

  delay(1000);
  WiFi.mode(WIFI_STA);
  WiFi.begin(ssid,password);
  Serial.println("\nConnecting");
  while(WiFi.status() != WL_CONNECTED){
    Serial.print(".");
    delay(100);
  }

  Serial.print("\nConnected to the WiFi network");
  Serial.print("\nLocal ESP32 IP: ");
  Serial.print(WiFi.localIP());

  sensors.begin();
}

void loop(void){
  // ---------- TEMPERATURA ----------
  Serial.print("\nDohvacanje temperature...");
  sensors.requestTemperatures(); 
  Serial.println("Zavrseno");
  delay(1500);

  float tempC = sensors.getTempCByIndex(0);
  if(tempC != DEVICE_DISCONNECTED_C){
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

    delay(1000);

    // ---------- KVALITETA ZRAKA ----------
    int airRaw = analogRead(AIR_QUALITY_PIN);
    float airVoltage = (airRaw / 4095.0) * 5.0;

    Serial.print("Air Quality AO Raw: ");
    Serial.print(airRaw);
    Serial.print(" | Voltage: ");
    Serial.print(airVoltage);
    Serial.println(" V");

    float coPPM = analogToPPM(airVoltage, "CO");
    float nh3PPM = analogToPPM(airVoltage, "NH3");
    float ch4PPM = analogToPPM(airVoltage, "CH4");

    Serial.print("CO: "); Serial.print(coPPM); Serial.println(" ppm");
    Serial.print("NH3: "); Serial.print(nh3PPM); Serial.println(" ppm");
    Serial.print("CH4: "); Serial.print(ch4PPM); Serial.println(" ppm");
    Serial.println("-------------------------");

    delay(500);

    // ---------- LED ----------
    bool ledStatus = readLEDStatusFromFirebase();
    digitalWrite(LED_PIN, ledStatus ? HIGH : LOW);
  }
  else{
    Serial.println("Error: Greska prilikom ucitavanja senzora temperature");
  }

  delay(READ_INTERVAL_MS);
}
