import { Component, inject, OnInit, computed } from '@angular/core';
import { DatePipe, NgClass } from '@angular/common';
import { RouterLink } from '@angular/router';
import { SensorService } from '../../services/sensor.service';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [NgClass, DatePipe, RouterLink],
  templateUrl: './dashboard.component.html'
})
export class DashboardComponent implements OnInit {
  protected readonly sensorService = inject(SensorService);
  protected readonly Math = Math;

  protected readonly temperature = this.sensorService.temperature;
  protected readonly soilMoisture = this.sensorService.soilMoisture;
  protected readonly co = this.sensorService.co;
  protected readonly nh3 = this.sensorService.nh3;
  protected readonly ch4 = this.sensorService.ch4;
  protected readonly light = this.sensorService.light;
  protected readonly pumpOn = this.sensorService.pumpOn;
  protected readonly isLEDon = this.sensorService.isLEDon;
  protected readonly sensorOnline = this.sensorService.sensorOnline;
  protected readonly lastDataTimestamp = this.sensorService.lastDataTimestamp;

  ngOnInit() {
    this.sensorService.initialize();
  }

  togglePump() {
    this.sensorService.togglePump();
  }

  toggleLED() {
    this.sensorService.toggleLED();
  }
}
