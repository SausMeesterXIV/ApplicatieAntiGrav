import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { usePushNotifications } from './features/berichten/usePushNotifications';
import { ToastContainer } from './components/Toast';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { hasAccess } from './lib/roleUtils';

import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CredentialsScreen } from './features/auth/CredentialsScreen';
import { CreditsScreen } from './features/beheer/CreditsScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { NotificationsScreen } from './features/berichten/NotificationsScreen';
import { NewMessageScreen } from './features/berichten/NewMessageScreen';
import { NudgeSelectorScreen } from './features/berichten/NudgeSelectorScreen';
import { AgendaScreen } from './features/agenda/AgendaScreen';
import { AgendaManageScreen } from './features/agenda/AgendaManageScreen';
import { FriesScreen } from './features/friet/FriesScreen';
import { FriesOverviewScreen } from './features/friet/FriesOverviewScreen';
import { FriesHistoryScreen } from './features/friet/FriesHistoryScreen';
import { FriesComparisonScreen } from './features/friet/FriesComparisonScreen';
import { StrepenScreen } from './features/drank/StrepenScreen';
import { TeamDrankDashboardScreen } from './features/drank/TeamDrankDashboardScreen';
import { TeamDrankStockScreen } from './features/drank/TeamDrankStockScreen';
import { TeamDrankStreaksScreen } from './features/drank/TeamDrankStreaksScreen';
import { TeamDrankBillingScreen } from './features/drank/TeamDrankBillingScreen';
import { TeamDrankInvoicesScreen } from './features/drank/TeamDrankInvoicesScreen';
import { TeamDrankArchiveScreen } from './features/drank/TeamDrankArchiveScreen';
import { TeamDrankExcelPreviewScreen } from './features/drank/TeamDrankExcelPreviewScreen';
import { TeamDrankBillingExcelPreviewScreen } from './features/drank/TeamDrankBillingExcelPreviewScreen';
import { TeamDrankExcelBeheerScreen } from './features/drank/TeamDrankExcelBeheerScreen';
import { ConsumptionOverviewScreen } from './features/drank/ConsumptionOverviewScreen';
import { StrepenHistoryScreen } from './features/drank/StrepenHistoryScreen';
import { MyInvoiceScreen } from './features/drank/MyInvoiceScreen';
import { SettingsScreen } from './features/beheer/SettingsScreen';
import { RolesManageScreen } from './features/beheer/RolesManageScreen';
import { ResetPasswordScreen } from './features/auth/ResetPasswordScreen';
import { BillingPeriodsManageScreen } from './features/drank/BillingPeriodsManageScreen';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { DrinkProvider } from './features/drank/DrinkContext';
import { AgendaProvider, useAgenda } from './features/agenda/AgendaContext';
import { FriesProvider } from './features/friet/FriesContext';
import { ShopDashboardScreen } from './features/winkeltje/ShopDashboardScreen';
import { ShopCategoryScreen } from './features/winkeltje/ShopCategoryScreen';
import { ShopInventoryScreen } from './features/winkeltje/ShopInventoryScreen';
import { FinanceDashboardScreen } from './features/financien/FinanceDashboardScreen';
import { TeamDrankFriesHistoryScreen } from './features/friet/TeamDrankFriesHistoryScreen';

// Alle data zit in de providers (features/*/…Context); App regelt enkel routing en layout.

const RoleRoute = ({ children, role }) => {
  const { currentUser } = useAuth();
  if (!hasAccess(currentUser, role)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
    const mainContainer = document.getElementById('main-scroll-container');
    if (mainContainer) mainContainer.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

const MainLayout = () => {
  const { notifications } = useAgenda();
  return (
    <div
      className="text-base w-full flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0f172a]"
      style={{ height: '100vh' }}
    >
      <div id="main-scroll-container" className="flex-1 w-full overflow-y-auto no-scrollbar">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </div>

      <div className="w-full z-50 shrink-0">
        <BottomNav notifications={notifications} />
      </div>
    </div>
  );
};

const AppRoutes = () => {
  const { session, currentUser, loading } = useAuth();
  usePushNotifications(currentUser);

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] items-center justify-center transition-colors">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={!session ? <CredentialsScreen /> : <Navigate to="/" />} />
      <Route path="/reset-password" element={<ResetPasswordScreen />} />
      <Route path="/credits" element={<CreditsScreen />} />

      {/* Protected Routes */}
      {session ? (
        <Route element={<MainLayout />}>
          <Route index element={<HomeScreen />} />

          <Route path="agenda" element={<AgendaScreen />} />
          <Route
            path="agenda/beheer"
            element={
              <RoleRoute role="hoofdleiding">
                <AgendaManageScreen />
              </RoleRoute>
            }
          />

          <Route path="notificaties" element={<NotificationsScreen />} />
          <Route path="notificaties/nieuw" element={<NewMessageScreen />} />
          <Route path="nudges" element={<NudgeSelectorScreen />} />

          <Route path="frituur" element={<FriesScreen />} />
          <Route path="frituur/overzicht" element={<FriesOverviewScreen />} />
          <Route path="fries-comparison" element={<FriesComparisonScreen />} />
          <Route path="frituur/geschiedenis" element={<FriesHistoryScreen />} />
          <Route
            path="team-drank/frieten"
            element={
              <RoleRoute role="drank">
                <TeamDrankFriesHistoryScreen />
              </RoleRoute>
            }
          />
          <Route
            path="financien"
            element={
              <RoleRoute role="financiën">
                <FinanceDashboardScreen />
              </RoleRoute>
            }
          />
          <Route
            path="billing-dashboard"
            element={
              <RoleRoute role="drank">
                <TeamDrankDashboardScreen />
              </RoleRoute>
            }
          />

          <Route path="strepen" element={<StrepenScreen />} />
          <Route path="strepen/geschiedenis" element={<StrepenHistoryScreen adminMode={false} />} />
          <Route
            path="strepen/geschiedenis-alle"
            element={
              <RoleRoute role="drank">
                <StrepenHistoryScreen adminMode={true} />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/dashboard"
            element={
              <RoleRoute role="drank">
                <TeamDrankDashboardScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/voorraad"
            element={
              <RoleRoute role="drank">
                <TeamDrankStockScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/streaks"
            element={
              <RoleRoute role="drank">
                <TeamDrankStreaksScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/facturatie"
            element={
              <RoleRoute role="drank">
                <TeamDrankInvoicesScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/facturatie/nieuw"
            element={
              <RoleRoute role="drank">
                <TeamDrankBillingScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/facturatie/archief"
            element={
              <RoleRoute role="drank">
                <TeamDrankArchiveScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/facturatie/archief/:periodId"
            element={
              <RoleRoute role="drank">
                <TeamDrankInvoicesScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/facturatie/periodes"
            element={
              <RoleRoute role="drank">
                <BillingPeriodsManageScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/facturatie/excel"
            element={
              <RoleRoute role="drank">
                <TeamDrankExcelPreviewScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/facturatie/billing-excel"
            element={
              <RoleRoute role="drank">
                <TeamDrankBillingExcelPreviewScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/facturatie/beheer"
            element={
              <RoleRoute role="drank">
                <TeamDrankExcelBeheerScreen />
              </RoleRoute>
            }
          />
          <Route
            path="strepen/overzicht"
            element={
              <RoleRoute role="drank">
                <ConsumptionOverviewScreen />
              </RoleRoute>
            }
          />

          <Route path="mijn-factuur" element={<MyInvoiceScreen />} />

          <Route
            path="winkeltje/dashboard"
            element={
              <RoleRoute role="winkeltje">
                <ShopDashboardScreen />
              </RoleRoute>
            }
          />
          <Route path="winkeltje/category/:categoryId" element={<ShopCategoryScreen />} />
          <Route
            path="winkeltje/voorraad/tellen"
            element={
              <RoleRoute role="winkeltje">
                <ShopInventoryScreen />
              </RoleRoute>
            }
          />

          <Route path="settings" element={<SettingsScreen />} />
          <Route
            path="admin/rollen"
            element={
              <RoleRoute role="hoofdleiding">
                <RolesManageScreen />
              </RoleRoute>
            }
          />
        </Route>
      ) : (
        <Route path="*" element={<Navigate to="/login" />} />
      )}
    </Routes>
  );
};

function App() {
  useEffect(() => {
    // Luister naar deep links (bijv. vanuit e-mail op smartphone)
    const setupDeepLinks = async () => {
      CapacitorApp.addListener('appUrlOpen', async data => {
        const url = new URL(data.url);

        // Als de URL '/reset-password' bevat of een recovery token
        if (url.pathname.includes('reset-password') || url.hash.includes('type=recovery')) {
          // Forceer navigatie naar de reset pagina
          window.location.href = data.url;
        }
      });
    };

    setupDeepLinks();
    return () => {
      CapacitorApp.removeAllListeners();
    };
  }, []);

  useEffect(() => {
    const setAppHeight = () => {
      // Forceer de exacte innerHeight als CSS variabele
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);

    // Initiële calls (meerdere keren om Capacitor WebView vertragingen op te vangen)
    setAppHeight();
    setTimeout(setAppHeight, 50);
    setTimeout(setAppHeight, 300);

    return () => {
      window.removeEventListener('resize', setAppHeight);
      window.removeEventListener('orientationchange', setAppHeight);
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem('dark_mode');
    const isDark = saved === 'true' || (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const metaThemeColor = document.getElementById('theme-color-meta');

    if (isDark) {
      document.documentElement.classList.add('dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#0f172a');
    } else {
      document.documentElement.classList.remove('dark');
      if (metaThemeColor) metaThemeColor.setAttribute('content', '#ffffff');
    }
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <DrinkProvider>
          <AgendaProvider>
            <FriesProvider>
              <Analytics />
              <SpeedInsights />
              <ToastContainer />
              <ScrollToTop />
              <AppRoutes />
            </FriesProvider>
          </AgendaProvider>
        </DrinkProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
