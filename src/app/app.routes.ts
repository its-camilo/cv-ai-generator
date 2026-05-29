import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DashboardHome } from './pages/dashboard/dashboard-home/dashboard-home';
import { ProfilePage } from './pages/dashboard/profile-page/profile-page';
import { GenerateCvPage } from './pages/dashboard/generate-cv-page/generate-cv-page';
import { CvPreviewPage } from './pages/dashboard/cv-preview/cv-preview-page';

export const routes: Routes = [
  { path: 'login', component: LoginComponent },
  {
    path: 'dashboard',
    component: DashboardComponent,
    children: [
      { path: '', component: DashboardHome },
      { path: 'perfil', component: ProfilePage },
      { path: 'generar-cv', component: GenerateCvPage },
      { path: 'generar-cv/vista-previa', component: CvPreviewPage },
    ],
  },
  { path: 'e2e/cv-layout', component: CvPreviewPage },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];
