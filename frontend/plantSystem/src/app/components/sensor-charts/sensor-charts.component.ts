import {
  Component,
  Input,
  OnChanges,
  SimpleChanges,
  ElementRef,
  ViewChild,
  AfterViewInit,
  PLATFORM_ID,
  inject,
  OnDestroy
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { Chart, registerables } from 'chart.js';

Chart.register(...registerables);

export interface SensorData {
  temperature: number;
  soilMoisture: number;
  co: number;
  nh3: number;
  ch4: number;
  light: number;
}

@Component({
  selector: 'app-sensor-charts',
  standalone: true,
  templateUrl: './sensor-charts.component.html'
})
export class SensorChartsComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() sensorData!: SensorData;

  @ViewChild('temperatureChart') temperatureCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('soilMoistureChart') soilMoistureCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('coChart') coCanvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('nh3Chart') nh3Canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('ch4Chart') ch4Canvas!: ElementRef<HTMLCanvasElement>;
  @ViewChild('lightChart') lightCanvas!: ElementRef<HTMLCanvasElement>;

  private platformId = inject(PLATFORM_ID);
  private charts: Map<string, Chart> = new Map();
  private maxDataPoints = 30;

  private historyData: Record<string, { labels: string[]; values: number[] }> = {
    temperature: { labels: [], values: [] },
    soilMoisture: { labels: [], values: [] },
    co: { labels: [], values: [] },
    nh3: { labels: [], values: [] },
    ch4: { labels: [], values: [] },
    light: { labels: [], values: [] }
  };

  ngAfterViewInit() {
    if (isPlatformBrowser(this.platformId)) {
      this.initCharts();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['sensorData'] && this.sensorData && isPlatformBrowser(this.platformId)) {
      this.updateAllCharts();
    }
  }

  ngOnDestroy() {
    this.charts.forEach(chart => chart.destroy());
  }

  private initCharts() {
    const chartConfigs: { key: string; canvas: ElementRef<HTMLCanvasElement>; label: string; color: string; unit: string }[] = [
      { key: 'temperature', canvas: this.temperatureCanvas, label: 'Temperatura', color: '#f87171', unit: '°C' },
      { key: 'soilMoisture', canvas: this.soilMoistureCanvas, label: 'Vlažnost tla', color: '#60a5fa', unit: '%' },
      { key: 'co', canvas: this.coCanvas, label: 'CO', color: '#facc15', unit: 'ppm' },
      { key: 'nh3', canvas: this.nh3Canvas, label: 'NH3', color: '#4ade80', unit: 'ppm' },
      { key: 'ch4', canvas: this.ch4Canvas, label: 'CH4', color: '#c084fc', unit: 'ppm' },
      { key: 'light', canvas: this.lightCanvas, label: 'Svjetlost', color: '#fde047', unit: '%' }
    ];

    chartConfigs.forEach(config => {
      if (config.canvas?.nativeElement) {
        const chart = this.createChart(config.canvas.nativeElement, config.label, config.color, config.unit);
        this.charts.set(config.key, chart);
      }
    });
  }

  private createChart(canvas: HTMLCanvasElement, label: string, color: string, unit: string): Chart {
    return new Chart(canvas, {
      type: 'line',
      data: {
        labels: [],
        datasets: [{
          label: `${label} (${unit})`,
          data: [],
          borderColor: color,
          backgroundColor: color + '33',
          borderWidth: 2,
          fill: true,
          tension: 0.4,
          pointRadius: 3,
          pointBackgroundColor: color
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            labels: { color: '#9ca3af' }
          }
        },
        scales: {
          x: {
            ticks: { color: '#6b7280', maxTicksLimit: 8 },
            grid: { color: '#374151' }
          },
          y: {
            ticks: { color: '#6b7280' },
            grid: { color: '#374151' }
          }
        }
      }
    });
  }

  private updateAllCharts() {
    const now = new Date().toLocaleTimeString('hr-HR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

    const updates: { key: string; value: number }[] = [
      { key: 'temperature', value: this.sensorData.temperature },
      { key: 'soilMoisture', value: this.sensorData.soilMoisture },
      { key: 'co', value: this.sensorData.co },
      { key: 'nh3', value: this.sensorData.nh3 },
      { key: 'ch4', value: this.sensorData.ch4 },
      { key: 'light', value: this.sensorData.light }
    ];

    updates.forEach(({ key, value }) => {
      const history = this.historyData[key];
      history.labels.push(now);
      history.values.push(value);

      if (history.labels.length > this.maxDataPoints) {
        history.labels.shift();
        history.values.shift();
      }

      const chart = this.charts.get(key);
      if (chart) {
        chart.data.labels = [...history.labels];
        chart.data.datasets[0].data = [...history.values];
        chart.update('none');
      }
    });
  }
}
