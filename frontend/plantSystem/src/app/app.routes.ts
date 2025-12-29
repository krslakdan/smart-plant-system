import { Routes } from '@angular/router';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { ChartsComponent } from './pages/charts/charts.component';

export const routes: Routes = [
  { path: '', component: DashboardComponent },
  { path: 'charts', component: ChartsComponent },
  { path: '**', redirectTo: '' }
];
