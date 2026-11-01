// Copyright (c) 2026 Nida Akın. All rights reserved.
// Developed by PaperAxis · paperaxis.com

import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter } from 'react-router';
import { PublicLayout } from '@/components/layout/PublicLayout';
import HomePage from '@/pages/HomePage';

// Herkese açık sayfalar (ana sayfa doğrudan, diğerleri ayrı parçalarda)
const AboutPage = lazy(() => import('@/pages/AboutPage'));
const ServicesPage = lazy(() => import('@/pages/ServicesPage'));
const ServiceDetailPage = lazy(() => import('@/pages/ServiceDetailPage'));
const BlogListPage = lazy(() => import('@/pages/BlogListPage'));
const BlogPostPage = lazy(() => import('@/pages/BlogPostPage'));
const ContactPage = lazy(() => import('@/pages/ContactPage'));
const AppointmentPage = lazy(() => import('@/pages/AppointmentPage'));
const LegalPage = lazy(() => import('@/pages/LegalPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'));

// Panel — tamamı ayrı parçalarda; herkese açık site paketine dahil edilmez
const PanelRoot = lazy(() => import('@/pages/panel/PanelRoot'));
const LoginPage = lazy(() => import('@/pages/panel/LoginPage'));
const ForgotPasswordPage = lazy(() => import('@/pages/panel/ForgotPasswordPage'));
const ResetPasswordPage = lazy(() => import('@/pages/panel/ResetPasswordPage'));
const PanelShell = lazy(() => import('@/pages/panel/PanelShell'));
const DashboardPage = lazy(() => import('@/pages/panel/DashboardPage'));
const AppointmentsPage = lazy(() => import('@/pages/panel/AppointmentsPage'));
const ClientsPage = lazy(() => import('@/pages/panel/ClientsPage'));
const ClientDetailPage = lazy(() => import('@/pages/panel/ClientDetailPage'));
const NotificationsPage = lazy(() => import('@/pages/panel/NotificationsPage'));
const ReportsPage = lazy(() => import('@/pages/panel/ReportsPage'));
const ServicesAdminPage = lazy(() => import('@/pages/panel/ServicesAdminPage'));
const ContentPage = lazy(() => import('@/pages/panel/ContentPage'));
const BlogEditorPage = lazy(() => import('@/pages/panel/BlogEditorPage'));
const SettingsPage = lazy(() => import('@/pages/panel/SettingsPage'));
const CalendarSettingsPage = lazy(() => import('@/pages/panel/CalendarSettingsPage'));
const AuditLogPage = lazy(() => import('@/pages/panel/AuditLogPage'));
const PlansPage = lazy(() => import('@/pages/panel/PlansPage'));
const PlanEditorPage = lazy(() => import('@/pages/panel/PlanEditorPage'));

function PublicFallback() {
  return <div className="min-h-dvh bg-espresso" aria-busy="true" />;
}
function PanelFallback() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center" aria-busy="true">
      <div className="h-7 w-7 animate-spin rounded-full border-2 border-cocoa/20 border-t-cocoa" />
    </div>
  );
}
const s = (el: ReactNode, panel = false) => <Suspense fallback={panel ? <PanelFallback /> : <PublicFallback />}>{el}</Suspense>;

export const router = createBrowserRouter([
  {
    element: <PublicLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'hakkimda', element: s(<AboutPage />) },
      { path: 'hizmetler', element: s(<ServicesPage />) },
      { path: 'hizmetler/:slug', element: s(<ServiceDetailPage />) },
      { path: 'beslenme-rehberi', element: s(<BlogListPage />) },
      { path: 'beslenme-rehberi/kategori/:category', element: s(<BlogListPage />) },
      { path: 'beslenme-rehberi/:slug', element: s(<BlogPostPage />) },
      { path: 'iletisim', element: s(<ContactPage />) },
      { path: 'randevu', element: s(<AppointmentPage />) },
      { path: 'kvkk-aydinlatma-metni', element: s(<LegalPage doc="kvkk" />) },
      { path: 'acik-riza-metni', element: s(<LegalPage doc="consent" />) },
      { path: 'gizlilik-politikasi', element: s(<LegalPage doc="privacy" />) },
      { path: 'cerez-politikasi', element: s(<LegalPage doc="cookies" />) },
      { path: '*', element: s(<NotFoundPage />) },
    ],
  },
  {
    path: 'panel',
    element: s(<PanelRoot />, true),
    children: [
      { path: 'giris', element: s(<LoginPage />, true) },
      { path: 'sifremi-unuttum', element: s(<ForgotPasswordPage />, true) },
      { path: 'sifre-sifirla', element: s(<ResetPasswordPage />, true) },
      {
        element: s(<PanelShell />, true),
        children: [
          { index: true, element: s(<DashboardPage />, true) },
          { path: 'randevular', element: s(<AppointmentsPage />, true) },
          { path: 'danisanlar', element: s(<ClientsPage />, true) },
          { path: 'danisanlar/:id', element: s(<ClientDetailPage />, true) },
          { path: 'planlar', element: s(<PlansPage />, true) },
          { path: 'planlar/:id', element: s(<PlanEditorPage />, true) },
          { path: 'bildirimler', element: s(<NotificationsPage />, true) },
          { path: 'raporlar', element: s(<ReportsPage />, true) },
          { path: 'hizmetler', element: s(<ServicesAdminPage />, true) },
          { path: 'icerikler', element: s(<ContentPage />, true) },
          { path: 'icerikler/blog/:id', element: s(<BlogEditorPage />, true) },
          { path: 'ayarlar', element: s(<SettingsPage />, true) },
          { path: 'ayarlar/takvim', element: s(<CalendarSettingsPage />, true) },
          { path: 'ayarlar/denetim-kayitlari', element: s(<AuditLogPage />, true) },
        ],
      },
    ],
  },
]);


