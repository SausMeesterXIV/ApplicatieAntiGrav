import React, { Suspense, lazy, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { usePushNotifications } from './features/berichten/usePushNotifications';
import { ToastContainer } from './components/Toast';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { hasAccess } from './lib/roleUtils';
import { herlaadNaUpdate, vergeetHerladen } from './lib/herladen';

import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CredentialsScreen } from './features/auth/CredentialsScreen';
import { HomeScreen } from './features/home/HomeScreen';
import { AuthProvider, useAuth } from './features/auth/AuthContext';
import { DrinkProvider } from './features/drank/DrinkContext';
import { AgendaProvider, useAgenda } from './features/agenda/AgendaContext';
import { FriesProvider } from './features/friet/FriesContext';

// Schermen worden pas geladen wanneer je ze opent (kleinere eerste download op gsm).
// Lukt dat niet omdat er intussen een nieuwe versie online staat, dan herladen we de app één keer.
const scherm = (laad, naam) =>
  lazy(() =>
    laad().then(
      m => {
        vergeetHerladen();
        return { default: m[naam] };
      },
      fout => {
        if (herlaadNaUpdate()) return new Promise(() => {}); // pagina herlaadt, niets tonen
        throw fout;
      },
    ),
  );
const AgendaManageScreen = scherm(() => import('./features/agenda/AgendaManageScreen'), 'AgendaManageScreen');
const AgendaScreen = scherm(() => import('./features/agenda/AgendaScreen'), 'AgendaScreen');
const BillingPeriodsManageScreen = scherm(
  () => import('./features/drank/BillingPeriodsManageScreen'),
  'BillingPeriodsManageScreen',
);
const ConsumptionOverviewScreen = scherm(
  () => import('./features/drank/ConsumptionOverviewScreen'),
  'ConsumptionOverviewScreen',
);
const CreditsScreen = scherm(() => import('./features/beheer/CreditsScreen'), 'CreditsScreen');
const FinanceDashboardScreen = scherm(
  () => import('./features/financien/FinanceDashboardScreen'),
  'FinanceDashboardScreen',
);
const FriesComparisonScreen = scherm(() => import('./features/friet/FriesComparisonScreen'), 'FriesComparisonScreen');
const FriesHistoryScreen = scherm(() => import('./features/friet/FriesHistoryScreen'), 'FriesHistoryScreen');
const FriesOverviewScreen = scherm(() => import('./features/friet/FriesOverviewScreen'), 'FriesOverviewScreen');
const FriesScreen = scherm(() => import('./features/friet/FriesScreen'), 'FriesScreen');
const FriesSummaryScreen = scherm(() => import('./features/friet/FriesSummaryScreen'), 'FriesSummaryScreen');
const MyInvoiceScreen = scherm(() => import('./features/drank/MyInvoiceScreen'), 'MyInvoiceScreen');
const NewMessageScreen = scherm(() => import('./features/berichten/NewMessageScreen'), 'NewMessageScreen');
const NewPollScreen = scherm(() => import('./features/polls/NewPollScreen'), 'NewPollScreen');
const NotificationsScreen = scherm(() => import('./features/berichten/NotificationsScreen'), 'NotificationsScreen');
const NudgeSelectorScreen = scherm(() => import('./features/berichten/NudgeSelectorScreen'), 'NudgeSelectorScreen');
const PollsScreen = scherm(() => import('./features/polls/PollsScreen'), 'PollsScreen');
const RankingScreen = scherm(() => import('./features/drank/RankingScreen'), 'RankingScreen');
const ResetPasswordScreen = scherm(() => import('./features/auth/ResetPasswordScreen'), 'ResetPasswordScreen');
const RolesManageScreen = scherm(() => import('./features/beheer/RolesManageScreen'), 'RolesManageScreen');
const SettingsScreen = scherm(() => import('./features/beheer/SettingsScreen'), 'SettingsScreen');
const ShopCategoryScreen = scherm(() => import('./features/winkeltje/ShopCategoryScreen'), 'ShopCategoryScreen');
const ShopDashboardScreen = scherm(() => import('./features/winkeltje/ShopDashboardScreen'), 'ShopDashboardScreen');
const ShopInventoryScreen = scherm(() => import('./features/winkeltje/ShopInventoryScreen'), 'ShopInventoryScreen');
const StrepenHistoryScreen = scherm(() => import('./features/drank/StrepenHistoryScreen'), 'StrepenHistoryScreen');
const StrepenScreen = scherm(() => import('./features/drank/StrepenScreen'), 'StrepenScreen');
const TeamDrankArchiveScreen = scherm(
  () => import('./features/drank/TeamDrankArchiveScreen'),
  'TeamDrankArchiveScreen',
);
const TeamDrankBillingExcelPreviewScreen = scherm(
  () => import('./features/drank/TeamDrankBillingExcelPreviewScreen'),
  'TeamDrankBillingExcelPreviewScreen',
);
const TeamDrankBillingScreen = scherm(
  () => import('./features/drank/TeamDrankBillingScreen'),
  'TeamDrankBillingScreen',
);
const TeamDrankDashboardScreen = scherm(
  () => import('./features/drank/TeamDrankDashboardScreen'),
  'TeamDrankDashboardScreen',
);
const TeamDrankExcelBeheerScreen = scherm(
  () => import('./features/drank/TeamDrankExcelBeheerScreen'),
  'TeamDrankExcelBeheerScreen',
);
const TeamDrankExcelPreviewScreen = scherm(
  () => import('./features/drank/TeamDrankExcelPreviewScreen'),
  'TeamDrankExcelPreviewScreen',
);
const TeamDrankFriesHistoryScreen = scherm(
  () => import('./features/friet/TeamDrankFriesHistoryScreen'),
  'TeamDrankFriesHistoryScreen',
);
const TeamDrankInvoicesScreen = scherm(
  () => import('./features/drank/TeamDrankInvoicesScreen'),
  'TeamDrankInvoicesScreen',
);
const TeamDrankStockScreen = scherm(() => import('./features/drank/TeamDrankStockScreen'), 'TeamDrankStockScreen');
const TeamDrankStreaksScreen = scherm(
  () => import('./features/drank/TeamDrankStreaksScreen'),
  'TeamDrankStreaksScreen',
);
const VerslagenScreen = scherm(() => import('./features/verslagen/VerslagenScreen'), 'VerslagenScreen');

// Alle data zit in de providers (features/*/…Context); App regelt enkel routing en layout.

// role: één rol/recht of een lijst (één ervan volstaat)
const RoleRoute = ({ children, role }) => {
  const { currentUser } = useAuth();
  const rollen = Array.isArray(role) ? role : [role];
  if (!rollen.some(r => hasAccess(currentUser, r))) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
};

const Laden = () => (
  <div className="flex items-center justify-center py-20">
    <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
  </div>
);

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
          <Suspense fallback={<Laden />}>
            <Outlet />
          </Suspense>
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
    <Suspense fallback={<Laden />}>
      <Routes>
        <Route path="/login" element={!session ? <CredentialsScreen /> : <Navigate to="/" />} />
        <Route path="/reset-password" element={<ResetPasswordScreen />} />
        <Route path="/credits" element={<CreditsScreen />} />

        {/* Protected Routes */}
        {session ? (
          <Route element={<MainLayout />}>
            <Route index element={<HomeScreen />} />

            <Route path="agenda" element={<AgendaScreen />} />
            {/* Iedereen voegt agenda-items toe; wat je mag aanpassen/verwijderen regelt het scherm + RLS */}
            <Route path="agenda/beheer" element={<AgendaManageScreen />} />

            <Route path="notificaties" element={<NotificationsScreen />} />
            <Route
              path="notificaties/nieuw"
              element={
                <RoleRoute role={['berichten_sturen', 'drank_beheren']}>
                  <NewMessageScreen />
                </RoleRoute>
              }
            />
            <Route path="nudges" element={<NudgeSelectorScreen />} />

            <Route path="polls" element={<PollsScreen />} />
            <Route
              path="polls/nieuw"
              element={
                <RoleRoute role="polls_maken">
                  <NewPollScreen />
                </RoleRoute>
              }
            />

            <Route path="verslagen" element={<VerslagenScreen />} />

            <Route path="frituur" element={<FriesScreen />} />
            <Route path="frituur/overzicht" element={<FriesOverviewScreen />} />
            <Route path="frituur/samenvatting" element={<FriesSummaryScreen />} />
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
            {/* Oud adres van het Drankteam-dashboard (bladwijzers) */}
            <Route path="billing-dashboard" element={<Navigate to="/strepen/dashboard" replace />} />

            <Route path="strepen" element={<StrepenScreen />} />
            <Route path="strepen/ranking" element={<RankingScreen />} />
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
    </Suspense>
  );
};

function App() {
  useEffect(() => {
    const setAppHeight = () => {
      // Forceer de exacte innerHeight als CSS variabele
      document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
    };

    window.addEventListener('resize', setAppHeight);
    window.addEventListener('orientationchange', setAppHeight);

    // Initiële calls (meerdere keren om trage mobiele browsers op te vangen)
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
