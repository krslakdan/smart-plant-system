import { Component, inject, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NgClass } from '@angular/common';
import { SensorService } from '../../services/sensor.service';
import { SensorChartsComponent, SensorData } from '../../components/sensor-charts/sensor-charts.component';

@Component({
  selector: 'app-charts',
  standalone: true,
  imports: [RouterLink, NgClass, SensorChartsComponent],
  templateUrl: './charts.component.html'
})
export class ChartsComponent implements OnInit {
  protected readonly sensorService = inject(SensorService);
  protected readonly sensorOnline = this.sensorService.sensorOnline;

  protected readonly sensorData = computed<SensorData>(() => ({
    temperature: this.sensorService.temperature(),
    soilMoisture: this.sensorService.soilMoisture(),
    co: this.sensorService.co(),
    nh3: this.sensorService.nh3(),
    ch4: this.sensorService.ch4(),
    light: this.sensorService.light()
  }));

  ngOnInit() {
    this.sensorService.initialize();
  }
}
