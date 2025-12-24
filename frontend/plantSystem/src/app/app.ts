import { Component, signal, OnInit, PLATFORM_ID, inject } from '@angular/core';
import {DatePipe, isPlatformBrowser, NgClass} from '@angular/common';
import { initializeApp } from 'firebase/app';
import { getDatabase, ref, onValue, set } from 'firebase/database';

@Component({
  selector: 'app-root',
  imports: [NgClass, DatePipe],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly temperature = signal(20.5);
  protected readonly isLEDon = signal(false);
  protected readonly soilMoisture = signal(0);
  protected readonly co = signal(0);
  protected readonly nh3 = signal(0);
  protected readonly ch4 = signal(0);
  protected readonly light = signal(0);

  protected readonly lastDataTimestamp = signal<number>(Date.now());
  protected readonly sensorOnline = signal<boolean>(false);
  private offlineTimer: any;
  private readonly OFFLINE_TIMEOUT = 10000;

  private platformId = inject(PLATFORM_ID);
  private database: any;

  private dataReceived() {
    this.lastDataTimestamp.set(Date.now());
    this.sensorOnline.set(true);

    clearTimeout(this.offlineTimer);
    this.offlineTimer = setTimeout(() => {
      this.sensorOnline.set(false);
    }, this.OFFLINE_TIMEOUT);
  }



  ngOnInit() {
    if (isPlatformBrowser(this.platformId)) {
      const firebaseConfig = {
        databaseURL: 'https://smart-plant-system-92d20-default-rtdb.europe-west1.firebasedatabase.app/'
      };

      const app = initializeApp(firebaseConfig);
      this.database = getDatabase(app);

      const temperatureRef = ref(this.database, 'temperature');
      onValue(temperatureRef, (snapshot) => {
        const data = snapshot.val();
        this.temperature.set(data);
        this.dataReceived();
      });

      const ledRef = ref(this.database, 'isLEDon');
      onValue(ledRef, (snapshot) => {
        const data = snapshot.val();
        this.isLEDon.set(data);
        this.dataReceived();
      });

      const moistureRef = ref(this.database, 'soilMoisture');
      onValue(moistureRef, (snapshot) => {
        const data = snapshot.val();
        this.soilMoisture.set(data);
        this.dataReceived();
      });

      const airQualityRef = ref(this.database, 'CO');
      onValue(airQualityRef, snapshot => {
        const data = snapshot.val();
        this.co.set(data);
        this.dataReceived();
      });

      const nh3Ref = ref(this.database, 'NH3');
      onValue(nh3Ref, snapshot => {
        const data = snapshot.val();
        this.nh3.set(data);
        this.dataReceived();
      });

      const ch4Ref = ref(this.database, 'CH4');
      onValue(ch4Ref, snapshot => {
        const data = snapshot.val();
        this.ch4.set(data);
        this.dataReceived();
      });

      const lightRef = ref(this.database, 'lightPercent');
      onValue(lightRef, snapshot => {
        const data = snapshot.val();
        this.light.set(data);
        this.dataReceived();
      });
    }
  }

  toggleLED() {
    if(!this.database) return;
    const newValue=!this.isLEDon();
    this.isLEDon.set(newValue);

    const ledRef=ref(this.database, 'isLEDon');
    set(ledRef, newValue).then(()=>console.log('LED state updated successfully to ', newValue))
      .catch((error:any) => {console.log('Error updating LED state: ',error)});
  }

  protected readonly Math = Math;
}
