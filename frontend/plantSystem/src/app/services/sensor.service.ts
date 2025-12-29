import { Injectable, signal, PLATFORM_ID, inject } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set, Database } from 'firebase/database';

@Injectable({
  providedIn: 'root'
})
export class SensorService {
  readonly temperature = signal(0);
  readonly isLEDon = signal(false);
  readonly pumpOn = signal(false);
  readonly soilMoisture = signal(0);
  readonly co = signal(0);
  readonly nh3 = signal(0);
  readonly ch4 = signal(0);
  readonly light = signal(0);
  readonly lastDataTimestamp = signal<number>(Date.now());
  readonly sensorOnline = signal<boolean>(false);

  private platformId = inject(PLATFORM_ID);
  private database: Database | null = null;
  private offlineTimer: any;
  private readonly OFFLINE_TIMEOUT = 10000;
  private initialized = false;

  initialize() {
    if (this.initialized || !isPlatformBrowser(this.platformId)) return;
    this.initialized = true;

    const firebaseConfig = {
      databaseURL: 'https://smart-plant-system-92d20-default-rtdb.europe-west1.firebasedatabase.app/'
    };

    const app = initializeApp(firebaseConfig);
    this.database = getDatabase(app);

    this.setupListeners();
  }

  private setupListeners() {
    if (!this.database) return;

    const db = this.database;

    onValue(ref(db, 'temperature'), (snapshot) => {
      this.temperature.set(snapshot.val() ?? 0);
      this.dataReceived();
    });

    onValue(ref(db, 'isLEDon'), (snapshot) => {
      this.isLEDon.set(!!snapshot.val());
      this.dataReceived();
    });

    onValue(ref(db, 'soilMoisture'), (snapshot) => {
      this.soilMoisture.set(snapshot.val() ?? 0);
      this.dataReceived();
    });

    onValue(ref(db, 'CO'), (snapshot) => {
      this.co.set(snapshot.val() ?? 0);
      this.dataReceived();
    });

    onValue(ref(db, 'NH3'), (snapshot) => {
      this.nh3.set(snapshot.val() ?? 0);
      this.dataReceived();
    });

    onValue(ref(db, 'CH4'), (snapshot) => {
      this.ch4.set(snapshot.val() ?? 0);
      this.dataReceived();
    });

    onValue(ref(db, 'lightPercent'), (snapshot) => {
      this.light.set(snapshot.val() ?? 0);
      this.dataReceived();
    });

    onValue(ref(db, 'pump'), (snapshot) => {
      this.pumpOn.set(snapshot.val());
      this.dataReceived();
    });
  }

  private dataReceived() {
    this.lastDataTimestamp.set(Date.now());
    this.sensorOnline.set(true);

    clearTimeout(this.offlineTimer);
    this.offlineTimer = setTimeout(() => {
      this.sensorOnline.set(false);
    }, this.OFFLINE_TIMEOUT);
  }

  toggleLED() {
    if (!this.database) return;
    const newValue = !this.isLEDon();
    this.isLEDon.set(newValue);

    const ledRef = ref(this.database, 'isLEDon');
    set(ledRef, newValue)
      .then(() => console.log('LED state updated to', newValue))
      .catch((error) => console.error('Error updating LED state:', error));
  }

  togglePump() {
    if (!this.database) return;
    const newValue = !this.pumpOn();
    this.pumpOn.set(newValue);

    const pumpRef = ref(this.database, 'pump');
    set(pumpRef, newValue)
      .then(() => console.log('Pump state updated to', newValue))
      .catch((error) => console.error('Error updating pump state:', error));
  }
}
