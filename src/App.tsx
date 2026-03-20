import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { App as CapacitorApp } from '@capacitor/app';
import { usePushNotifications } from './hooks/usePushNotifications';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { User, Drink, Streak, StockItem, FryItem, Order, CountdownItem, BierpongGame, QuoteItem, Notification, Event, BillingPeriod } from './types';
import * as db from './lib/supabaseService';
import { showToast, ToastContainer } from './components/Toast';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useRealtimeSubscriptions } from './lib/useRealtime';

import { BottomNav } from './components/BottomNav';
import { ErrorBoundary } from './components/ErrorBoundary';
import { CredentialsScreen } from './screens/CredentialsScreen';
import { CreditsScreen } from './screens/CreditsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { NewMessageScreen } from './screens/NewMessageScreen';
import { NudgeSelectorScreen } from './screens/NudgeSelectorScreen';
import { AgendaScreen } from './screens/AgendaScreen';
import { AgendaManageScreen } from './screens/AgendaManageScreen';
import { FriesScreen } from './screens/FriesScreen';
import { FriesOverviewScreen } from './screens/FriesOverviewScreen';
import { FriesHistoryScreen } from './screens/FriesHistoryScreen';
import { FriesComparisonScreen } from './screens/FriesComparisonScreen';
import { StrepenScreen } from './screens/StrepenScreen';
import { TeamDrankDashboardScreen } from './screens/TeamDrankDashboardScreen';
import { TeamDrankStockScreen } from './screens/TeamDrankStockScreen';
import { TeamDrankStreaksScreen } from './screens/TeamDrankStreaksScreen';
import { TeamDrankBillingScreen } from './screens/TeamDrankBillingScreen';
import { TeamDrankInvoicesScreen } from './screens/TeamDrankInvoicesScreen';
import { TeamDrankArchiveScreen } from './screens/TeamDrankArchiveScreen';
import { TeamDrankExcelPreviewScreen } from './screens/TeamDrankExcelPreviewScreen';
import { TeamDrankBillingExcelPreviewScreen } from './screens/TeamDrankBillingExcelPreviewScreen';
import { TeamDrankExcelBeheerScreen } from './screens/TeamDrankExcelBeheerScreen';
import { ConsumptionOverviewScreen } from './screens/ConsumptionOverviewScreen';
import { StrepenHistoryScreen } from './screens/StrepenHistoryScreen';
import { MyInvoiceScreen } from './screens/MyInvoiceScreen';
import { BierpongScreen } from './screens/BierpongScreen';
import { BierpongManageScreen } from './screens/BierpongManageScreen';
import { QuotesScreen } from './screens/QuotesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { RolesManageScreen } from './screens/RolesManageScreen';
import { ResetPasswordScreen } from './screens/ResetPasswordScreen';
import { BillingPeriodsManageScreen } from './screens/BillingPeriodsManageScreen';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { DrinkProvider } from './contexts/DrinkContext';
import { AgendaProvider } from './contexts/AgendaContext';
import { FriesProvider } from './contexts/FriesContext';
import { ShopDashboardScreen } from './screens/ShopDashboardScreen';
import { ShopCategoryScreen } from './screens/ShopCategoryScreen';
import { ShopInventoryScreen } from './screens/ShopInventoryScreen';
import { FinanceDashboardScreen } from './screens/FinanceDashboardScreen';
import { TeamDrankFriesHistoryScreen } from './screens/TeamDrankFriesHistoryScreen';

export type AppContextType = {
    currentUser: User;
    setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    activePeriod: BillingPeriod | null;
    setActivePeriod: React.Dispatch<React.SetStateAction<BillingPeriod | null>>;
    billingPeriods: BillingPeriod[];
    setBillingPeriods: React.Dispatch<React.SetStateAction<BillingPeriod[]>>;
    drinks: Drink[];
    setDrinks: React.Dispatch<React.SetStateAction<Drink[]>>;
    streaks: Streak[];
    setStreaks: React.Dispatch<React.SetStateAction<Streak[]>>;
    stockItems: StockItem[];
    setStockItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
    availableRoles: import('./types').RoleDefinition[];
    setAvailableRoles: React.Dispatch<React.SetStateAction<import('./types').RoleDefinition[]>>;
    handleSaveRoles: (roles: import('./types').RoleDefinition[]) => void;
    balance: number;
    setBalance: React.Dispatch<React.SetStateAction<number>>;
    fryItems: FryItem[];
    setFryItems: React.Dispatch<React.SetStateAction<FryItem[]>>;
    friesOrders: Order[];
    setFriesOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    friesSessionStatus: 'open' | 'closed' | 'completed' | 'ordering' | 'ordered';
    setFriesSessionStatus: React.Dispatch<React.SetStateAction<'open' | 'closed' | 'completed' | 'ordering' | 'ordered'>>;
    friesPickupTime: string | null;
    setFriesPickupTime: React.Dispatch<React.SetStateAction<string | null>>;
    countdowns: CountdownItem[];
    setCountdowns: React.Dispatch<React.SetStateAction<CountdownItem[]>>;
    handleSaveCountdowns: (countdowns: CountdownItem[]) => void;
    bierpongGames: BierpongGame[];
    setBierpongGames: React.Dispatch<React.SetStateAction<BierpongGame[]>>;
    handleAddBierpongGame: (playerIds: string[], winnerIds: string[]) => void;
    duoBierpongWinners: string[];
    setDuoBierpongWinners: React.Dispatch<React.SetStateAction<string[]>>;
    quotes: QuoteItem[];
    setQuotes: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
    events: Event[];
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    handleAddCost: (amount: number, drink?: Drink, quantity?: number) => void;
    handleDeleteStreak: (id: string) => void;
    handleQuickStreep: () => void;
    handlePlaceFryOrder: (items: any[], totalCost: number, targetUser?: User) => void;
    handleRemoveFryOrder: (orderId: string) => void;
    handleArchiveFriesSession: () => Promise<void>;
    handleCompleteFriesPayment: (actualAmount: number, receiptFile?: File) => Promise<void>;
    handleVoteQuote: (id: string, type: 'like' | 'dislike') => Promise<void>;
    handleAddQuote: (text: string, context: string, authorId: string) => void;
    handleDeleteQuote: (id: string) => void;
    handleSaveEvent: (event: Event) => void;
    handleDeleteEvent: (id: string) => void;
    handleAddNotification: (notification: Omit<Notification, 'id'>) => void;
    handleMarkNotificationAsRead: (id: string) => void;
    handleAddFryItem: (item: Omit<FryItem, 'id'>) => Promise<void>;
    handleUpdateFryItem: (id: string, updates: Partial<FryItem>) => Promise<void>;
    handleDeleteFryItem: (id: string) => Promise<void>;
    frituurSessieId: string | null;
    setFrituurSessieId: React.Dispatch<React.SetStateAction<string | null>>;
    gsheetId: string | null;
    setGsheetId: React.Dispatch<React.SetStateAction<string | null>>;
    gsheetSharingEmail: string | null;
    setGsheetSharingEmail: React.Dispatch<React.SetStateAction<string | null>>;
    syncToGoogleSheets: (command: string, payload: any) => Promise<any>;
    loading: boolean;
};

// Helper om te checken of een user rechten heeft (hoofdleiding en godmode hebben altijd true)
export const hasAccess = (user: User | null | undefined, requiredRole: string) => {
    if (!user) return false;
    const mainRol = String(user.rol || '').toLowerCase();
    if (mainRol === 'hoofdleiding' || mainRol === 'godmode' || mainRol === 'admin') return true;
    
    const req = requiredRole.toLowerCase();
    if (mainRol.includes(req)) return true;
    
    // Check ook in de array van extra rollen
    if (user.roles && user.roles.some(r => String(r).toLowerCase().includes(req))) return true;
    
    return false;
};

const DEFAULT_USER: User = {
    id: '',
    naam: 'Laden...',
    name: 'Laden...',
    email: '',
    rol: 'standaard',
    roles: [],
    actief: true,
    avatar_url: '',
    avatar: 'https://i.pravatar.cc/150?u=default',
    nickname: '',
    fcm_token: null,
    quick_drink_id: null,
    quickDrinkId: undefined,
    created_at: new Date().toISOString()
};

function App() {
    const [gsheetId, setGsheetId] = useState<string | null>(null);
    const [gsheetSharingEmail, setGsheetSharingEmail] = useState<string | null>(null);

    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
    usePushNotifications(currentUser);
    const [users, setUsers] = useState<User[]>([]);
    const [drinks, setDrinks] = useState<Drink[]>([]);
    const [availableRoles, setAvailableRoles] = useState<import('./types').RoleDefinition[]>([]);
    const [streaks, setStreaks] = useState<Streak[]>([]);
    const [stockItems, setStockItems] = useState<StockItem[]>([]);
    const [balance, setBalance] = useState(0);
    const [fryItems, setFryItems] = useState<FryItem[]>([]);
    const [friesOrders, setFriesOrders] = useState<Order[]>([]);
    const [friesSessionStatus, setFriesSessionStatus] = useState<'open' | 'closed' | 'completed' | 'ordering' | 'ordered'>('closed');
    const [friesPickupTime, setFriesPickupTime] = useState<string | null>(null);
    const [frituurSessieId, setFrituurSessieId] = useState<string | null>(null);
    const [countdowns, setCountdowns] = useState<CountdownItem[]>([]);
    const [bierpongGames, setBierpongGames] = useState<BierpongGame[]>([]);
    const [duoBierpongWinners, setDuoBierpongWinners] = useState<string[]>([]);
    const [quotes, setQuotes] = useState<QuoteItem[]>([]);
    const [events, setEvents] = useState<Event[]>([]);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [activePeriod, setActivePeriod] = useState<BillingPeriod | null>(null);
    const [billingPeriods, setBillingPeriods] = useState<BillingPeriod[]>([]);

    useRealtimeSubscriptions({
        userId: session?.user?.id || null,
        setNotifications,
        setBierpongGames,
        setFriesOrders,
        frituurSessieId
    });

    useEffect(() => {
        // Luister naar deep links (bijv. vanuit e-mail op smartphone)
        const setupDeepLinks = async () => {
            CapacitorApp.addListener('appUrlOpen', async (data) => {
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
            if (metaThemeColor) metaThemeColor.setAttribute("content", "#0f172a");
        } else {
            document.documentElement.classList.remove('dark');
            if (metaThemeColor) metaThemeColor.setAttribute("content", "#ffffff");
        }
    }, []);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) {
                loadAllData(session.user.id);
            } else {
                setLoading(false);
            }
        });

        const handleOnline = async () => {
            const pendingStr = localStorage.getItem('ksa_pending_streaks');
            if (!pendingStr) return;

            try {
                let pendingStreaks = JSON.parse(pendingStr) as any[];
                if (pendingStreaks.length === 0) return;

                showToast(`Netwerk hersteld. ${pendingStreaks.length} offline strepen synchroniseren...`, 'info');
                
                let successCount = 0;
                let i = 0;

                while (i < pendingStreaks.length) {
                    const streak = pendingStreaks[i];
                    try {
                        await db.addConsumptie(
                            streak.userId, 
                            streak.drinkId, 
                            streak.quantity, 
                            undefined
                        );
                        
                        // Real ID is now managed exclusively by Supabase via RPC, keeping temp ID in UI untill refresh
                        pendingStreaks.splice(i, 1);
                        localStorage.setItem('ksa_pending_streaks', JSON.stringify(pendingStreaks));
                        
                        successCount++;
                    } catch (e) {
                        console.error('Failed to sync streak, keeping in queue', streak, e);
                        i++;
                    }
                }

                if (pendingStreaks.length === 0) {
                    localStorage.removeItem('ksa_pending_streaks');
                    if (successCount > 0) showToast('Alle vastgelopen strepen succesvol gesynct!', 'success');
                } else {
                    showToast(`Kon ${pendingStreaks.length} strepen niet bereiken. We proberen later opnieuw.`, 'warning');
                }

            } catch (e) {
                console.error('Sync queue failed completely', e);
            }
        };

        window.addEventListener('online', handleOnline);
        return () => window.removeEventListener('online', handleOnline);
    }, []);

    useEffect(() => {
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) {
                setLoading(true);
                loadAllData(session.user.id);
            } else {
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    async function loadAllData(userId: string) {
        try {
            const [
                profilesData, drinksData, consumptiesData, balanceData, eventsData, quotesData, notificatiesData,
                bierpongData, kampioenenData, stockData, frituurSessieData, countdownsData, activeBillingPeriod,
                allBillingPeriods, gsheetIdSetting, gsheetSharingEmailSetting, loadedRoles, fryItemsData, frituurOrdersData,
            ] = await Promise.all([
                db.fetchProfiles(), db.fetchDranken(), db.fetchConsumpties(), db.fetchBalanceForUser(userId),
                db.fetchEvents(), db.fetchQuotes(), db.fetchNotificaties(userId), db.fetchBierpongGames(),
                db.fetchBierpongKampioenen(), db.fetchStockItems(), db.fetchActiveFrituurSessie(), db.fetchCountdowns(),
                db.fetchActiveBillingPeriod(), db.fetchBillingPeriods(), db.fetchSetting('gsheet_id'),
                db.fetchSetting('gsheet_sharing_email'), db.fetchAvailableRoles(), db.fetchFryItems(), db.fetchFrituurBestellingen(),
            ]);

            const me = profilesData.find(p => p.id === userId);
            if (me) {
                setCurrentUser(me as User);
            } else {
                console.warn('Profiel niet gevonden of inactief. Uitloggen...');
                await supabase.auth.signOut();
                return;
            }

            setUsers(profilesData); setDrinks(drinksData); setStreaks(consumptiesData); setBalance(balanceData);
            setEvents(eventsData); setQuotes(quotesData); setNotifications(notificatiesData); setBierpongGames(bierpongData);
            setDuoBierpongWinners(kampioenenData); setStockItems(stockData); setCountdowns(countdownsData);
            setActivePeriod(activeBillingPeriod); setBillingPeriods(allBillingPeriods);

            if (frituurSessieData) {
                setFrituurSessieId(frituurSessieData.id);
                setFriesSessionStatus(frituurSessieData.status as any);
                setFriesPickupTime(frituurSessieData.pickupTime);
            }
            setFriesOrders(frituurOrdersData || []); setFryItems(fryItemsData || []);
            setGsheetId(gsheetIdSetting); setGsheetSharingEmail(gsheetSharingEmailSetting);

            if (!loadedRoles || loadedRoles.length === 0) {
                const defaultRoles = [
                    { id: '1', label: 'Hoofdleiding', icon: 'admin_panel_settings', color: 'bg-red-100 text-red-700 border-red-200' },
                    { id: '2', label: 'Financiën', icon: 'account_balance', color: 'bg-green-100 text-green-700 border-green-200' },
                    { id: '3', label: 'Sfeerbeheer', icon: 'celebration', color: 'bg-purple-100 text-purple-700 border-purple-200' },
                    { id: '4', label: 'Drank', icon: 'local_bar', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                    { id: '5', label: 'Materiaal', icon: 'build', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                    { id: '6', label: 'Kookploeg', icon: 'restaurant', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
                    { id: '7', label: 'Pagadders', icon: 'groups', color: 'bg-blue-50 text-blue-600 border-blue-100' },
                    { id: '8', label: 'Kabouters', icon: 'groups', color: 'bg-pink-50 text-pink-600 border-pink-100' },
                    { id: '9', label: 'Sloebers', icon: 'groups', color: 'bg-green-50 text-green-600 border-green-100' },
                    { id: '10', label: 'Tieners', icon: 'groups', color: 'bg-yellow-50 text-yellow-600 border-yellow-100' },
                    { id: '11', label: 'JIM', icon: 'groups', color: 'bg-orange-50 text-orange-600 border-orange-100' },
                    { id: '12', label: 'SIM', icon: 'groups', color: 'bg-purple-50 text-purple-600 border-purple-100' },
                    { id: '13', label: 'KIM', icon: 'groups', color: 'bg-red-50 text-red-600 border-red-100' },
                ];
                setAvailableRoles(defaultRoles);
                db.saveAvailableRoles(defaultRoles).catch(e => console.error("Failed to save default roles", e));
            } else {
                setAvailableRoles(loadedRoles);
            }
        } catch (error) {
            console.error('Error loading data:', error);
            showToast('Fout bij het laden van de gegevens', 'error');
        } finally {
            setLoading(false);
        }
    }

    const handleAddCost = async (amount: number, drink?: Drink, quantity: number = 1) => {
        if (!drink || !session?.user?.id) return;

        const tempId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : `temp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const newStreak: Streak = {
            id: tempId, userId: currentUser.id, drinkId: drink.id, drinkName: drink.name,
            price: drink.price * quantity, amount: quantity, timestamp: new Date(),
        };
        setStreaks(prev => [newStreak, ...prev]);
        setBalance(prev => prev + (amount * quantity));

        try {
            await db.addConsumptie(currentUser.id, String(drink.id), quantity, activePeriod?.id);
            // Real ID is now managed exclusively by Supabase via RPC, keeping temp ID in UI untill refresh
            showToast(`${quantity}x ${drink.name} gestreept! (+€${(amount * quantity).toFixed(2)})`, 'success');
        } catch (error) {
            if (!navigator.onLine) {
                const pendingStreaks = JSON.parse(localStorage.getItem('ksa_pending_streaks') || '[]');
                pendingStreaks.push({ userId: currentUser.id, drinkId: String(drink.id), quantity, tempId, name: drink.name, userName: currentUser.naam });
                localStorage.setItem('ksa_pending_streaks', JSON.stringify(pendingStreaks));
                showToast(`Offline opgeslagen: ${quantity}x ${drink.name}. Wordt gesynct bij verbinding.`, 'warning');
            } else {
                setStreaks(prev => prev.filter(s => s.id !== tempId));
                setBalance(prev => prev - (amount * quantity));
                showToast('Fout bij het strepen. Probeer opnieuw.', 'error');
            }
        }
    };

    const handleDeleteStreak = async (id: string) => {
        const streak = streaks.find(s => s.id === id);
        if (!streak) return;
        setStreaks(prev => prev.filter(s => s.id !== id));
        setBalance(prev => prev - streak.price);

        try {
            await db.deleteConsumptie(id);
            showToast('Streep verwijderd', 'info');
        } catch (error) {
            setStreaks(prev => [streak, ...prev]);
            setBalance(prev => prev + streak.price);
            showToast('Fout bij het verwijderen', 'error');
        }
    };

    const handleQuickStreep = () => {
        const drinkId = currentUser.quickDrinkId || (drinks.length > 0 ? String(drinks[0].id) : null);
        if (!drinkId) return;
        const drink = drinks.find(d => String(d.id) === String(drinkId));
        if (drink) handleAddCost(drink.price, drink);
    };

    const handlePlaceFryOrder = async (items: any[], totalCost: number, targetUser?: User) => {
        const orderForUser = targetUser || currentUser;
        const isOwnOrder = orderForUser.id === currentUser.id;

        const tempId = Math.random().toString(36).substr(2, 9);
        const newOrder: Order = {
            id: tempId, userId: orderForUser.id, userName: orderForUser.naam || orderForUser.name || 'Onbekend',
            items, totalPrice: totalCost, date: new Date(), status: 'open'
        };
        setFriesOrders(prev => [newOrder, ...prev]);

        if (isOwnOrder) setBalance(prev => prev + totalCost);

        try {
            const realId = await db.addFrituurBestelling(orderForUser.id, orderForUser.naam || orderForUser.name || 'Onbekend', frituurSessieId, items, totalCost, activePeriod?.id);
            setFriesOrders(prev => prev.map(o => o.id === tempId ? { ...o, id: realId } : o));
            
            if (isOwnOrder) {
                showToast('Bestelling geplaatst! 🍟', 'success');
            } else {
                showToast(`Bestelling voor ${orderForUser.naam} geplaatst! 🍟`, 'success');
                
                // NOTIFICATIE NAAR DE ANDERE PERSOON
                const notifTitle = '🍟 Frietjes voor jou!';
                const notifContent = `${currentUser.naam || 'Iemand'} heeft zojuist een bestelling voor je geplaatst (€${totalCost.toFixed(2).replace('.', ',')}).`;
                db.addNotificatie(currentUser.id, orderForUser.id, notifTitle, notifContent, currentUser.naam || 'Systeem', '').catch(console.error);
            }
        } catch (error) {
            setFriesOrders(prev => prev.filter(o => o.id !== tempId));
            if (isOwnOrder) setBalance(prev => prev - totalCost);
            showToast('Fout bij het plaatsen van de bestelling', 'error');
        }
    };

    const handleRemoveFryOrder = async (orderId: string) => {
        const orderToRemove = friesOrders.find(o => o.id === orderId);
        if (!orderToRemove) return;
        setFriesOrders(prev => prev.filter(o => o.id !== orderId));

        try {
            await db.deleteFrituurBestelling(orderId);
            showToast('Bestelling geannuleerd', 'info');
        } catch (error) {
            setFriesOrders(prev => [orderToRemove, ...prev]);
            showToast('Fout bij het annuleren', 'error');
        }
    };

    const handleArchiveFriesSession = async () => {
        if (!frituurSessieId) return;
        
        // Sla oude staat op voor eventuele rollback
        const prevOrders = [...friesOrders];
        const prevStatus = friesSessionStatus;
        const prevSessieId = frituurSessieId;

        // Optimistische UI updates (worden nu pas doorgevoerd ALS we zeker zijn of we RPC direct aanroepen)
        // In dit geval is handleArchiveFriesSession een 'silent' archiveer actie zonder bedrag.
        // We gebruiken 0 als bedrag of we laten het over aan de betalingsflow.
        
        try {
            setFriesOrders(prev => prev.map(o => ({ ...o, status: 'geleverd' as const })));
            setFriesSessionStatus('closed');
            setFriesPickupTime(null);
            
            await db.finalizeFrituurSessie(frituurSessieId, 0);
            setFrituurSessieId(null);
        } catch (error) {
            console.error('Archiveren mislukt', error);
            // Rollback
            setFriesOrders(prevOrders);
            setFriesSessionStatus(prevStatus);
            setFrituurSessieId(prevSessieId);
            showToast('Archiveren mislukt. Probeer het opnieuw.', 'error');
        }
    };

    const handleCompleteFriesPayment = async (actualAmount: number, receiptFile?: File) => {
        if (!frituurSessieId) {
            showToast('Geen actieve sessie gevonden om af te sluiten', 'error');
            return;
        }

        // Sla oude staat op voor rollback
        const prevOrders = [...friesOrders];
        const prevStatus = friesSessionStatus;
        const prevSessieId = frituurSessieId;
        
        try {
            let receiptUrl = '';
            
            // 1. Upload kasticket (optioneel, blokkeert de rest niet bij waarschuwing)
            if (receiptFile) {
                try {
                    receiptUrl = await db.uploadReceipt(frituurSessieId, receiptFile);
                } catch (e) {
                    console.warn("Kon kasticket niet uploaden", e);
                }
            }

            // 2. Update receipt_url (we doen dit apart omdat de RPC actual_amount al zet)
            if (receiptUrl) {
                try {
                    await db.updateFrituurSessie(frituurSessieId, { receipt_url: receiptUrl });
                } catch (updateErr) {
                    console.warn("Kon receipt_url niet updaten", updateErr);
                }
            }

            // 3. Atomische afronding via RPC
            const result = await db.finalizeFrituurSessie(frituurSessieId, actualAmount);
            
            // 4. Update UI na succes
            setFriesOrders(prev => prev.map(o => ({ ...o, status: 'geleverd' as const })));
            setFriesSessionStatus('closed');
            setFriesPickupTime(null);
            setFrituurSessieId(null);

            // 5. Check prijsverschil op basis van server-data
            const expectedAmount = Number(result.expected_amount);
            if (Math.abs(actualAmount - expectedAmount) > 0.01) {
                const targetUsers = users.filter(u => {
                    const roles = (u.roles || []).map(r => String(r).toLowerCase());
                    return roles.includes('hoofdleiding') || roles.includes('drank') || roles.includes('team drank') || u.rol === 'hoofdleiding' || u.rol === 'godmode' || u.rol === 'team_drank';
                });

                const formattedActual = `€${actualAmount.toFixed(2).replace('.', ',')}`;
                const formattedExpected = `€${expectedAmount.toFixed(2).replace('.', ',')}`;
                const diff = actualAmount - expectedAmount;
                const formattedDiff = `${diff > 0 ? '+' : ''}€${diff.toFixed(2).replace('.', ',')}`;

                const notifTitle = '🍟 Prijswijziging Frituur?';
                const notifContent = `Betaald: ${formattedActual} | Verwacht: ${formattedExpected}. Verschil: ${formattedDiff}.`;
                
                targetUsers.forEach(user => { 
                    db.addNotificatie(currentUser.id, user.id, notifTitle, notifContent, currentUser.naam || 'Systeem', '').catch(() => {}); 
                });

                handleAddNotification({ 
                    type: 'order', 
                    sender: 'Systeem', 
                    role: '', 
                    title: notifTitle, 
                    content: notifContent, 
                    time: 'Zonet', 
                    isRead: false, 
                    action: '', 
                    icon: 'price_change', 
                    color: 'bg-orange-100 dark:bg-orange-600/20 text-orange-600 dark:text-orange-500' 
                } as any);

                showToast('Betaling afgerond — prijsverschil gemeld', 'warning');
            } else {
                showToast('Betaling succesvol afgerond!', 'success');
            }
        } catch (error: any) {
            console.error('Grote fout bij afronden betaling:', error);
            // Rollback op error
            setFriesOrders(prevOrders);
            setFriesSessionStatus(prevStatus);
            setFrituurSessieId(prevSessieId);
            showToast('Fout bij het afronden. De sessie is niet gesloten.', 'error');
        }
    };

    const handleVoteQuote = async (id: string, type: 'like' | 'dislike') => {
        setQuotes(prev => prev.map(q => {
            if (q.id === id) {
                let newLikes = [...q.likes]; let newDislikes = [...q.dislikes];
                if (type === 'like') {
                    if (newLikes.includes(currentUser.id)) newLikes = newLikes.filter(u => u !== currentUser.id);
                    else { newLikes.push(currentUser.id); newDislikes = newDislikes.filter(u => u !== currentUser.id); }
                } else {
                    if (newDislikes.includes(currentUser.id)) newDislikes = newDislikes.filter(u => u !== currentUser.id);
                    else { newDislikes.push(currentUser.id); newLikes = newLikes.filter(u => u !== currentUser.id); }
                }
                return { ...q, likes: newLikes, dislikes: newDislikes };
            }
            return q;
        }));

        try {
            await db.voteQuote(id, currentUser.id, type, currentUser.naam);
        } catch (error) {
            showToast('Fout bij het stemmen', 'error');
            const freshQuotes = await db.fetchQuotes();
            setQuotes(freshQuotes);
        }
    };

    const handleAddQuote = async (text: string, context: string, authorId: string) => {
        const author = users.find(u => u.id === authorId);
        // Gebruik de nickname als die bestaat, anders de echte naam
        const authorName = author ? (author.nickname || author.naam || author.name || 'Onbekend') : authorId;
        const tempId = Date.now().toString();
        const newQuote: QuoteItem = { id: tempId, text, authorId, authorName, context, date: new Date(), likes: [], dislikes: [], addedBy: currentUser.id, tekst: text, auteur: authorName, datum: new Date().toISOString(), upvotes: 0, toegevoegd_door: currentUser.id, created_at: new Date().toISOString() };
        setQuotes(prev => [newQuote, ...prev]);

        try {
            const realQuote = await db.addQuote(text, authorName, context, currentUser.id);
            setQuotes(prev => prev.map(q => q.id === tempId ? realQuote : q));
            showToast('Quote toegevoegd! 💬', 'success');
        } catch (error) {
            setQuotes(prev => prev.filter(q => q.id !== tempId));
            showToast('Fout bij het toevoegen van de quote', 'error');
        }
    };

    const handleDeleteQuote = async (id: string) => {
        const quote = quotes.find(q => q.id === id);
        setQuotes(prev => prev.filter(q => q.id !== id));
        try {
            await db.deleteQuote(id);
            showToast('Quote verwijderd', 'info');
        } catch (error) {
            if (quote) setQuotes(prev => [...prev, quote]);
            showToast('Fout bij het verwijderen. Alleen admins kunnen quotes verwijderen.', 'error');
        }
    };

    const handleSaveEvent = async (event: Event) => {
        setEvents(prev => { const exists = prev.find(e => e.id === event.id); return exists ? prev.map(e => e.id === event.id ? event : e) : [...prev, event]; });
        try {
            const savedEvent = await db.saveEvent(event);
            setEvents(prev => prev.map(e => (e.id === event.id || e.id === savedEvent.id) ? savedEvent : e));
            showToast('Evenement opgeslagen!', 'success');
        } catch (error) {
            showToast('Fout bij het opslaan van het evenement', 'error');
            const freshEvents = await db.fetchEvents();
            setEvents(freshEvents);
        }
    };

    const handleDeleteEvent = async (id: string) => {
        const event = events.find(e => e.id === id);
        setEvents(prev => prev.filter(e => e.id !== id));
        try {
            await db.deleteEvent(id);
            showToast('Evenement verwijderd', 'info');
        } catch (error) {
            if (event) setEvents(prev => [...prev, event]);
            showToast('Fout bij het verwijderen', 'error');
        }
    };

    const handleAddNotification = async (n: Omit<Notification, 'id'>) => {
        const tempId = (typeof crypto !== 'undefined' && crypto.randomUUID) 
            ? crypto.randomUUID() 
            : `temp-n-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const tempNotif = { ...n, id: tempId } as any;
        setNotifications(prev => [tempNotif, ...prev]);
        try { await db.addNotificatie(currentUser.id, 'all', n.title, n.content, currentUser.naam); } catch (error) { console.error('Notification send error:', error); }
    };

    const handleMarkNotificationAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => String(n.id) === id ? { ...n, isRead: true } : n));
        try { await db.markNotificatieGelezen(id); } catch (error) { console.error('Mark read error:', error); }
    };

    const handleSaveCountdowns = async (newCountdowns: CountdownItem[]) => {
        setCountdowns(newCountdowns);
        try { await db.saveCountdowns(newCountdowns); } catch (error) { showToast('Fout bij opslaan klokken', 'error'); const fresh = await db.fetchCountdowns(); setCountdowns(fresh); }
    };

    const handleAddBierpongGame = async (playerIds: string[], winnerIds: string[]) => {
        try { const newGame = await db.addBierpongGame(playerIds, winnerIds); setBierpongGames(prev => [...prev, newGame]); } catch (error) { console.error('Failed to add bierpong game:', error); showToast('Fout bij opslaan bierpong match', 'error'); const fresh = await db.fetchBierpongGames(); setBierpongGames(fresh); }
    };

    if (loading) { 
        return (
            <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] items-center justify-center transition-colors">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        ); 
    }

    const contextValue: AppContextType = {
        currentUser, setCurrentUser, users, setUsers, drinks, setDrinks, streaks, setStreaks, stockItems, setStockItems, balance, setBalance, availableRoles, setAvailableRoles,
        handleSaveRoles: async (roles) => { try { setAvailableRoles(roles); await db.saveAvailableRoles(roles); showToast('Rollen succesvol opgeslagen', 'success'); } catch (error) { console.error('Failed to save roles:', error); showToast('Fout bij opslaan rollen', 'error'); } },
        friesOrders, setFriesOrders, friesSessionStatus, setFriesSessionStatus, friesPickupTime, setFriesPickupTime, countdowns, setCountdowns, bierpongGames, setBierpongGames, duoBierpongWinners, setDuoBierpongWinners, quotes, setQuotes, events, setEvents, fryItems, setFryItems, notifications, setNotifications,
        handleAddCost, handleDeleteStreak, handleQuickStreep, handlePlaceFryOrder, handleRemoveFryOrder, handleArchiveFriesSession, handleCompleteFriesPayment, handleVoteQuote, handleAddQuote, handleDeleteQuote, handleSaveEvent, handleDeleteEvent, handleAddNotification, handleMarkNotificationAsRead, handleSaveCountdowns, handleAddBierpongGame,
        frituurSessieId, setFrituurSessieId, activePeriod, setActivePeriod, billingPeriods, setBillingPeriods, gsheetId, setGsheetId, gsheetSharingEmail, setGsheetSharingEmail, loading,
        handleAddFryItem: async (item) => { try { const id = await db.addFryItem(item); setFryItems(prev => [...prev, { ...item, id }]); showToast('Item toegevoegd', 'success'); } catch (error) { console.error('Failed to add fry item:', error); showToast('Fout bij toevoegen item', 'error'); } },
        handleUpdateFryItem: async (id, updates) => { try { await db.updateFryItem(id, updates); setFryItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i)); showToast('Item bijgewerkt', 'success'); } catch (error) { console.error('Failed to update fry item:', error); showToast('Fout bij bijwerken item', 'error'); } },
        handleDeleteFryItem: async (id) => { try { await db.deleteFryItem(id); setFryItems(prev => prev.filter(i => i.id !== id)); showToast('Item verwijderd', 'success'); } catch (error) { console.error('Failed to delete fry item:', error); showToast('Fout bij verwijderen item', 'error'); } },
        syncToGoogleSheets: async (command: string, payload: any) => { const { data, error } = await supabase.functions.invoke('google-sheets-sync', { body: { command, payload } }); if (error) throw error; return data; }
    };

    const RoleRoute = ({ children, role }: { children: React.ReactNode, role: string }) => {
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
        return (
            <div 
                className="text-base w-full flex flex-col overflow-hidden bg-gray-50 dark:bg-[#0f172a]" 
                style={{ height: '100vh' }}
            >
                <div id="main-scroll-container" className="flex-1 w-full overflow-y-auto no-scrollbar">
                    <ErrorBoundary>
                        <Outlet context={contextValue} />
                    </ErrorBoundary>
                </div>

                <div className="w-full z-50 shrink-0">
                    <BottomNav notifications={notifications} />
                </div>
            </div>
        );
    };

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
                            <Routes>
                                <Route path="/login" element={!session ? <CredentialsScreen /> : <Navigate to="/" />} />
                                <Route path="/reset-password" element={<ResetPasswordScreen />} />
                                <Route path="/credits" element={<CreditsScreen />} />

                                {/* Protected Routes */}
                                {session ? (
                                    <Route element={<MainLayout />}>
                                        <Route index element={<HomeScreen />} />

                                        <Route path="agenda" element={<AgendaScreen />} />
                                        <Route path="agenda/beheer" element={<RoleRoute role="hoofdleiding"><AgendaManageScreen /></RoleRoute>} />

                                        <Route path="notificaties" element={<NotificationsScreen />} />
                                        <Route path="notificaties/nieuw" element={<NewMessageScreen />} />
                                        <Route path="nudges" element={<NudgeSelectorScreen />} />

                                        <Route path="frituur" element={<FriesScreen />} />
                                        <Route path="frituur/overzicht" element={<FriesOverviewScreen />} />
                                        <Route path="fries-comparison" element={<FriesComparisonScreen />} />
                                        <Route path="frituur/geschiedenis" element={<FriesHistoryScreen />} />
                                        <Route path="team-drank/frieten" element={<RoleRoute role="drank"><TeamDrankFriesHistoryScreen /></RoleRoute>} />
                                        <Route path="financien" element={<RoleRoute role="financiën"><FinanceDashboardScreen /></RoleRoute>} />
                                        <Route path="billing-dashboard" element={<RoleRoute role="drank"><TeamDrankDashboardScreen /></RoleRoute>} />

                                        <Route path="strepen" element={<StrepenScreen />} />
                                        <Route path="strepen/geschiedenis" element={<StrepenHistoryScreen adminMode={false} />} />
                                        <Route path="strepen/geschiedenis-alle" element={<RoleRoute role="drank"><StrepenHistoryScreen adminMode={true} /></RoleRoute>} />
                                        <Route path="strepen/dashboard" element={<RoleRoute role="drank"><TeamDrankDashboardScreen /></RoleRoute>} />
                                        <Route path="strepen/voorraad" element={<RoleRoute role="drank"><TeamDrankStockScreen /></RoleRoute>} />
                                        <Route path="strepen/streaks" element={<RoleRoute role="drank"><TeamDrankStreaksScreen /></RoleRoute>} />
                                        <Route path="strepen/facturatie" element={<RoleRoute role="drank"><TeamDrankInvoicesScreen /></RoleRoute>} />
                                        <Route path="strepen/facturatie/nieuw" element={<RoleRoute role="drank"><TeamDrankBillingScreen /></RoleRoute>} />
                                        <Route path="strepen/facturatie/archief" element={<RoleRoute role="drank"><TeamDrankArchiveScreen /></RoleRoute>} />
                                        <Route path="strepen/facturatie/archief/:periodId" element={<RoleRoute role="drank"><TeamDrankInvoicesScreen /></RoleRoute>} />
                                        <Route path="strepen/facturatie/periodes" element={<RoleRoute role="drank"><BillingPeriodsManageScreen /></RoleRoute>} />
                                        <Route path="strepen/facturatie/excel" element={<RoleRoute role="drank"><TeamDrankExcelPreviewScreen /></RoleRoute>} />
                                        <Route path="strepen/facturatie/billing-excel" element={<RoleRoute role="drank"><TeamDrankBillingExcelPreviewScreen /></RoleRoute>} />
                                        <Route path="strepen/facturatie/beheer" element={<RoleRoute role="drank"><TeamDrankExcelBeheerScreen /></RoleRoute>} />
                                        <Route path="strepen/overzicht" element={<RoleRoute role="drank"><ConsumptionOverviewScreen users={users} drinks={drinks} streaks={streaks} /></RoleRoute>} />

                                        <Route path="mijn-factuur" element={<MyInvoiceScreen balance={balance} currentUser={currentUser} streaks={streaks} friesOrders={friesOrders} />} />
                                        
                                        <Route path="bierpong" element={<BierpongScreen />} />
                                        <Route path="bierpong/beheer" element={<BierpongManageScreen />} />
                                        
                                        <Route path="quotes" element={<QuotesScreen />} />
                                        <Route path="quotes/beheer" element={<QuotesScreen enableManagement={true} />} />

                                        <Route path="winkeltje/dashboard" element={<RoleRoute role="winkeltje"><ShopDashboardScreen /></RoleRoute>} />
                                        <Route path="winkeltje/category/:categoryId" element={<ShopCategoryScreen />} />
                                        <Route path="winkeltje/voorraad/tellen" element={<RoleRoute role="winkeltje"><ShopInventoryScreen /></RoleRoute>} />

                                        <Route path="settings" element={<SettingsScreen />} />
                                        <Route path="admin/rollen" element={<RoleRoute role="hoofdleiding"><RolesManageScreen /></RoleRoute>} />
                                    </Route>
                                ) : (
                                    <Route path="*" element={<Navigate to="/login" />} />
                                )}
                            </Routes>
                        </FriesProvider>
                    </AgendaProvider>
                </DrinkProvider>
            </AuthProvider>
        </BrowserRouter>
    );
}

export default App;
