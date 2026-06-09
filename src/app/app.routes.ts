import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { guestGuard } from './core/guards/guest.guard';
import { LoginComponent } from './pages/login/login.component';
import { DashboardComponent } from './pages/dashboard/dashboard.component';
import { DashboardHome } from './pages/dashboard/dashboard-home/dashboard-home';
import { ProfilePage } from './pages/dashboard/profile-page/profile-page';
import { GenerateCvPage } from './pages/dashboard/generate-cv-page/generate-cv-page';
import { CvPreviewPage } from './pages/dashboard/cv-preview/cv-preview-page';

export const routes: Routes = [
  { path: 'login', component: LoginComponent, canActivate: [guestGuard] },
  {
    path: 'dashboard',
    component: DashboardComponent,
    canActivate: [authGuard],
    children: [
      { path: '', component: DashboardHome },
      { path: 'profile', component: ProfilePage },
      { path: 'generate-cv', component: GenerateCvPage },
      { path: 'generate-cv/preview', component: CvPreviewPage },
      { path: 'perfil', redirectTo: 'profile', pathMatch: 'full' },
      { path: 'generar-cv', redirectTo: 'generate-cv', pathMatch: 'full' },
      { path: 'generar-cv/vista-previa', redirectTo: 'generate-cv/preview', pathMatch: 'full' },
    ],
  },
  { path: 'e2e/cv-layout', component: CvPreviewPage },
  { path: '', redirectTo: '/login', pathMatch: 'full' },
  { path: '**', redirectTo: '/login' },
];
