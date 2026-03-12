import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { User, Drink, Streak, StockItem, FryItem, CartItem, Order, CountdownItem, BierpongGame, QuoteItem, Notification, Event, BillingPeriod } from './types';
import * as db from './lib/supabaseService';
import { showToast, ToastContainer } from './components/Toast';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';
import { useRealtimeSubscriptions } from './lib/useRealtime';

import { BottomNav } from './components/BottomNav';
import { SplashScreen } from './components/SplashScreen';
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
import { AuthProvider } from './contexts/AuthContext';
import { DrinkProvider } from './contexts/DrinkContext';
import { AgendaProvider } from './contexts/AgendaContext';
import { FriesProvider } from './contexts/FriesContext';
import { ShopDashboardScreen } from './screens/ShopDashboardScreen';
import { ShopCategoryScreen } from './screens/ShopCategoryScreen';
import { ShopInventoryScreen } from './screens/ShopInventoryScreen';


// Export the context type so screens can use it
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
    gsheetId: string | null;
    setGsheetId: React.Dispatch<React.SetStateAction<string | null>>;
    gsheetSharingEmail: string | null;
    setGsheetSharingEmail: React.Dispatch<React.SetStateAction<string | null>>;
    syncToGoogleSheets: (command: string, payload: any) => Promise<any>;
    loading: boolean;
};

const DEFAULT_USER: User = {
    id: '',
    naam: 'Laden...',
    nickname: null,
    avatar_url: null,
    name: 'Laden...',
    email: '',
    rol: 'standaard',
    roles: [],
    actief: true,
    avatar: 'https://i.pravatar.cc/150?u=default',
    created_at: new Date().toISOString(),
    quick_drink_id: null
};

function App() {
    const [gsheetId, setGsheetId] = useState<string | null>(null);
    const [gsheetSharingEmail, setGsheetSharingEmail] = useState<string | null>(null);

    const [session, setSession] = useState<Session | null>(null);
    const [loading, setLoading] = useState(true);

    // State - all initialized empty, loaded from Supabase
    const [currentUser, setCurrentUser] = useState<User>(DEFAULT_USER);
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

    // ==================== REALTIME SUBSCRIPTIONS ====================

    useRealtimeSubscriptions({
        userId: session?.user?.id || null,
        setNotifications,
        setBierpongGames,
    });

    // ==================== AUTH & INITIAL DATA LOAD ====================

    useEffect(() => {
        // Apply dark mode globally on load
        const saved = localStorage.getItem('dark_mode');
        if (saved === 'true' || (saved === null && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
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

        // Offline Sync Logic
        const handleOnline = async () => {
            const pendingStr = localStorage.getItem('ksa_pending_streaks');
            if (!pendingStr) return;
            try {
                const pendingStreaks = JSON.parse(pendingStr) as any[];
                if (pendingStreaks.length > 0) {
                    showToast(`Netwerk hersteld. ${pendingStreaks.length} offline strepen synchroniseren...`, 'info');
                    for (const streak of pendingStreaks) {
                        try {
                            const realId = await db.addConsumptie(streak.userId, streak.drinkId, streak.quantity, undefined, streak.userName);
                            // Replace in UI state if still there (usually user refreshed though)
                            setStreaks(prev => prev.map(s => s.id === streak.tempId ? { ...s, id: realId } : s));
                        } catch (e) {
                            console.error('Failed to sync streak', streak, e);
                        }
                    }
                    localStorage.removeItem('ksa_pending_streaks');
                    showToast('Vastgelopen strepen succesvol gesynct!', 'success');
                }
            } catch (e) {
                console.error('Sync failed', e);
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
                profilesData,
                drinksData,
                consumptiesData,
                balanceData,
                eventsData,
                quotesData,
                notificatiesData,
                bierpongData,
                kampioenenData,
                stockData,
                frituurSessieData,
                countdownsData,
                activeBillingPeriod,
                allBillingPeriods,
                gsheetIdSetting,
                gsheetSharingEmailSetting,
                loadedRoles,
                fryItemsData,
                frituurOrdersData,
            ] = await Promise.all([
                db.fetchProfiles(),
                db.fetchDranken(),
                db.fetchConsumpties(),
                db.fetchBalanceForUser(userId),
                db.fetchEvents(),
                db.fetchQuotes(),
                db.fetchNotificaties(userId),
                db.fetchBierpongGames(),
                db.fetchBierpongKampioenen(),
                db.fetchStockItems(),
                db.fetchActiveFrituurSessie(),
                db.fetchCountdowns(),
                db.fetchActiveBillingPeriod(),
                db.fetchBillingPeriods(),
                db.fetchSetting('gsheet_id'),
                db.fetchSetting('gsheet_sharing_email'),
                db.fetchAvailableRoles(),
                db.fetchFryItems(),
                db.fetchFrituurBestellingen(),
            ]);

            const me = profilesData.find(p => p.id === userId);
            if (me) {
                setCurrentUser(me as User);
            } else {
                console.warn('Profiel niet gevonden of inactief. Uitloggen...');
                await supabase.auth.signOut();
                return;
            }

            setUsers(profilesData);
            setDrinks(drinksData);
            setStreaks(consumptiesData);
            setBalance(balanceData);
            setEvents(eventsData);
            setQuotes(quotesData);
            setNotifications(notificatiesData);
            setBierpongGames(bierpongData);
            setDuoBierpongWinners(kampioenenData);
            setStockItems(stockData);
            setCountdowns(countdownsData);
            setActivePeriod(activeBillingPeriod);
            setBillingPeriods(allBillingPeriods);

            if (frituurSessieData) {
                setFrituurSessieId(frituurSessieData.id);
                setFriesSessionStatus(frituurSessieData.status as any);
                setFriesPickupTime(frituurSessieData.pickupTime);
            }
            setFriesOrders(frituurOrdersData || []);
            setFryItems(fryItemsData || []);
            setGsheetId(gsheetIdSetting);
            setGsheetSharingEmail(gsheetSharingEmailSetting);

            // Default roles if none in db
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

    // ==================== HANDLERS (Supabase-backed) ====================

    const handleAddCost = async (amount: number, drink?: Drink, quantity: number = 1) => {
        if (!drink || !session?.user?.id) return;

        // Optimistic update
        const tempId = Date.now().toString();
        const newStreak: Streak = {
            id: tempId,
            userId: currentUser.id,
            drinkId: drink.id,
            drinkName: drink.name,
            price: drink.price * quantity,
            amount: quantity,
            timestamp: new Date(),
        };
        setStreaks(prev => [newStreak, ...prev]);
        setBalance(prev => prev + (amount * quantity));

        try {
            const realId = await db.addConsumptie(currentUser.id, String(drink.id), quantity, activePeriod?.id, currentUser.naam);
            // Replace temp ID with the real one
            setStreaks(prev => prev.map(s => s.id === tempId ? { ...s, id: realId } : s));
            showToast(`${quantity}x ${drink.name} gestreept! (+€${(amount * quantity).toFixed(2)})`, 'success');
        } catch (error) {
            // Offline Mode Logic (Save to localStorage)
            if (!navigator.onLine) {
                const pendingStreaks = JSON.parse(localStorage.getItem('ksa_pending_streaks') || '[]');
                pendingStreaks.push({
                    userId: currentUser.id,
                    drinkId: String(drink.id),
                    quantity,
                    tempId,
                    name: drink.name
                });
                localStorage.setItem('ksa_pending_streaks', JSON.stringify(pendingStreaks));

                showToast(`Offline opgeslagen: ${quantity}x ${drink.name}. Wordt gesynct bij verbinding.`, 'warning');
            } else {
                // Rollback if actual error
                setStreaks(prev => prev.filter(s => s.id !== tempId));
                setBalance(prev => prev - (amount * quantity));
                showToast('Fout bij het strepen. Probeer opnieuw.', 'error');
            }
        }
    };

    const handleDeleteStreak = async (id: string) => {
        const streak = streaks.find(s => s.id === id);
        if (!streak) return;

        // Optimistic update
        setStreaks(prev => prev.filter(s => s.id !== id));
        setBalance(prev => prev - streak.price);

        try {
            await db.deleteConsumptie(id);
            showToast('Streep verwijderd', 'info');
        } catch (error) {
            // Rollback
            setStreaks(prev => [streak, ...prev]);
            setBalance(prev => prev + streak.price);
            showToast('Fout bij het verwijderen', 'error');
        }
    };

    const handleQuickStreep = () => {
        const drinkId = currentUser.quickDrinkId || (drinks.length > 0 ? String(drinks[0].id) : null);
        if (!drinkId) return;
        const drink = drinks.find(d => String(d.id) === String(drinkId));
        if (drink) {
            handleAddCost(drink.price, drink);
        }
    };

    const handlePlaceFryOrder = async (items: any[], totalCost: number, targetUser?: User) => {
        const orderForUser = targetUser || currentUser;
        const isOwnOrder = orderForUser.id === currentUser.id;

        // Optimistic update
        const tempId = Math.random().toString(36).substr(2, 9);
        const newOrder: Order = {
            id: tempId,
            userId: orderForUser.id,
            userName: orderForUser.naam || orderForUser.name || 'Onbekend',
            items: items as CartItem[],
            totalPrice: totalCost,
            date: new Date(),
            status: 'pending'
        };
        setFriesOrders(prev => [newOrder, ...prev]);

        // Also update balance if it's the current user's order
        if (isOwnOrder) {
            setBalance(prev => prev + totalCost);
        }

        try {
            const realId = await db.addFrituurBestelling(
                orderForUser.id,
                orderForUser.naam || orderForUser.name || 'Onbekend',
                frituurSessieId,
                items,
                totalCost,
                activePeriod?.id
            );
            setFriesOrders(prev => prev.map(o => o.id === tempId ? { ...o, id: realId } : o));
            showToast('Bestelling geplaatst! 🍟', 'success');
        } catch (error) {
            setFriesOrders(prev => prev.filter(o => o.id !== tempId));
            // Rollback balance
            if (isOwnOrder) {
                setBalance(prev => prev - totalCost);
            }
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

        setFriesOrders(prev => prev.map(o => ({ ...o, status: 'completed' as const })));
        setFriesSessionStatus('closed');
        setFriesPickupTime(null);

        try {
            await db.archiveFrituurSessie(frituurSessieId);
            setFrituurSessieId(null);
            showToast('Frituursessie afgesloten!', 'success');
        } catch (error) {
            showToast('Fout bij het afsluiten van de sessie', 'error');
        }
    };

    const handleCompleteFriesPayment = async (actualAmount: number, receiptFile?: File) => {
        if (!frituurSessieId) return;

        try {
            let receiptUrl = '';
            if (receiptFile) {
                receiptUrl = await db.uploadReceipt(frituurSessieId, receiptFile);
            }

            await db.updateFrituurSessie(frituurSessieId, {
                actual_amount: actualAmount,
                receipt_url: receiptUrl,
                status: 'paid'
            });

            // Calculate expected amount from pending orders
            const expectedAmount = friesOrders.filter(o => o.status === 'pending').reduce((acc, o) => acc + o.totalPrice, 0);

            if (Math.abs(actualAmount - expectedAmount) > 0.01) {
                // Price mismatch detected — notify Hoofdleiding and Team Drank
                const targetUsers = users.filter(u => {
                    const roles = (u.roles || []).map(r => r.toLowerCase());
                    return roles.includes('hoofdleiding') ||
                           roles.includes('drank') ||
                           roles.includes('team drank') ||
                           u.rol === 'admin' ||
                           u.rol === 'team_drank';
                });

                const formattedActual = `€${actualAmount.toFixed(2).replace('.', ',')}`;
                const formattedExpected = `€${expectedAmount.toFixed(2).replace('.', ',')}`;
                const diff = actualAmount - expectedAmount;
                const formattedDiff = `${diff > 0 ? '+' : ''}€${diff.toFixed(2).replace('.', ',')}`;

                const notifTitle = '🍟 Prijswijziging Frituur?';
                const notifContent = `Het betaalde bedrag (${formattedActual}) wijkt af van het verwachte bedrag in de app (${formattedExpected}). Verschil: ${formattedDiff}. Dit kan wijzen op een prijswijziging bij de frituur.`;
                // Action format: "LABEL|URL" — parsed by NotificationCard
                const notifAction = `Ga naar rekening & bestelling|/fries-comparison?sessionId=${frituurSessieId}`;

                targetUsers.forEach(user => {
                    db.addNotificatie(
                        currentUser.id,
                        user.id,
                        notifTitle,
                        notifContent,
                        currentUser.naam,
                        notifAction
                    );
                });

                // Also add a local notification so the current user gets immediate feedback
                handleAddNotification({
                    type: 'order',
                    sender: 'Systeem',
                    role: '',
                    title: notifTitle,
                    content: notifContent,
                    time: 'Zonet',
                    isRead: false,
                    action: notifAction,
                    icon: 'price_change',
                    color: 'bg-orange-100 dark:bg-orange-600/20 text-orange-600 dark:text-orange-500'
                } as any);

                handleArchiveFriesSession();
                showToast('Betaling afgerond — prijsverschil gemeld aan leiding', 'warning');
            } else {
                handleArchiveFriesSession();
                showToast('Betaling succesvol afgerond!', 'success');
            }
        } catch (error) {
            console.error(error);
            showToast('Fout bij afronden betaling', 'error');
        }
    };

    const handleVoteQuote = async (id: string, type: 'like' | 'dislike') => {
        // Optimistic update
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
            // Reload quotes to get correct state
            const freshQuotes = await db.fetchQuotes();
            setQuotes(freshQuotes);
        }
    };

    const handleAddQuote = async (text: string, context: string, authorId: string) => {
        const author = users.find(u => u.id === authorId);
        const authorName = author ? (author.naam || author.name || 'Onbekend') : authorId;

        // Optimistic
        const tempId = Date.now().toString();
        const newQuote: QuoteItem = {
            id: tempId, 
            text, 
            authorId, 
            authorName,
            context: context || null, 
            date: new Date(), 
            likes: [], 
            dislikes: [], 
            addedBy: currentUser.id,
            tekst: text,
            auteur: authorName,
            datum: new Date().toISOString(),
            upvotes: 0,
            toegevoegd_door: currentUser.id,
            created_at: new Date().toISOString()
        };
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
        // Optimistic update
        setEvents(prev => {
            const exists = prev.find(e => e.id === event.id);
            return exists ? prev.map(e => e.id === event.id ? event : e) : [...prev, event];
        });

        try {
            const savedEvent = await db.saveEvent(event);
            setEvents(prev => prev.map(e => (e.id === event.id || e.id === savedEvent.id) ? savedEvent : e));
            showToast('Evenement opgeslagen!', 'success');
        } catch (error) {
            showToast('Fout bij het opslaan van het evenement', 'error');
            // Reload to get correct state
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
        // Optimistic
        const tempNotif = { ...n, id: Date.now().toString() } as any;
        setNotifications(prev => [tempNotif, ...prev]);

        try {
            await db.addNotificatie(currentUser.id, 'all', n.title, n.content, currentUser.naam);
        } catch (error) {
            console.error('Notification send error:', error);
            // Keep the notification in UI anyway (it's not critical)
        }
    };

    const handleMarkNotificationAsRead = async (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));

        try {
            await db.markNotificatieGelezen(id);
        } catch (error) {
            console.error('Mark read error:', error);
        }
    };

    const handleSaveCountdowns = async (newCountdowns: CountdownItem[]) => {
        setCountdowns(newCountdowns);
        try {
            await db.saveCountdowns(newCountdowns);
        } catch (error) {
            showToast('Fout bij opslaan klokken', 'error');
            const fresh = await db.fetchCountdowns();
            setCountdowns(fresh);
        }
    };

    const handleAddBierpongGame = async (playerIds: string[], winnerIds: string[]) => {
        try {
            const newGame = await db.addBierpongGame(playerIds, winnerIds);
            setBierpongGames(prev => [...prev, newGame]);
        } catch (error) {
            console.error('Failed to add bierpong game:', error);
            showToast('Fout bij opslaan bierpong match', 'error');
            // Refresh to ensure sync
            const fresh = await db.fetchBierpongGames();
            setBierpongGames(fresh);
        }
    };

    if (loading) {
        return <SplashScreen />;
    }

    const contextValue: AppContextType = {
        currentUser, setCurrentUser, users, setUsers, drinks, setDrinks,
        streaks, setStreaks, stockItems, setStockItems, balance, setBalance,
        availableRoles, setAvailableRoles,
        handleSaveRoles: async (roles) => {
            try {
                setAvailableRoles(roles);
                await db.saveAvailableRoles(roles);
                showToast('Rollen succesvol opgeslagen', 'success');
            } catch (error) {
                console.error('Failed to save roles:', error);
                showToast('Fout bij opslaan rollen', 'error');
            }
        },
        friesOrders, setFriesOrders, friesSessionStatus, setFriesSessionStatus,
        friesPickupTime, setFriesPickupTime, countdowns, setCountdowns,
        bierpongGames, setBierpongGames, duoBierpongWinners, setDuoBierpongWinners,
        quotes, setQuotes, events, setEvents,
        fryItems, setFryItems,
        notifications, setNotifications,
        handleAddCost, handleDeleteStreak, handleQuickStreep, handlePlaceFryOrder,
        handleRemoveFryOrder,
        handleArchiveFriesSession,
        handleCompleteFriesPayment,
        handleVoteQuote, handleAddQuote,
        handleDeleteQuote, handleSaveEvent, handleDeleteEvent, handleAddNotification,
        handleMarkNotificationAsRead, handleSaveCountdowns, handleAddBierpongGame,
        frituurSessieId,
        activePeriod, setActivePeriod,
        billingPeriods, setBillingPeriods,
        gsheetId, setGsheetId,
        gsheetSharingEmail, setGsheetSharingEmail,
        loading, // Added loading to context
        handleAddFryItem: async (item) => {
            try {
                const id = await db.addFryItem(item);
                setFryItems(prev => [...prev, { ...item, id }]);
                showToast('Item toegevoegd', 'success');
            } catch (error) {
                console.error('Failed to add fry item:', error);
                showToast('Fout bij toevoegen item', 'error');
            }
        },
        handleUpdateFryItem: async (id, updates) => {
            try {
                await db.updateFryItem(id, updates);
                setFryItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } : i));
                showToast('Item bijgewerkt', 'success');
            } catch (error) {
                console.error('Failed to update fry item:', error);
                showToast('Fout bij bijwerken item', 'error');
            }
        },
        handleDeleteFryItem: async (id) => {
            try {
                await db.deleteFryItem(id);
                setFryItems(prev => prev.filter(i => i.id !== id));
                showToast('Item verwijderd', 'success');
            } catch (error) {
                console.error('Failed to delete fry item:', error);
                showToast('Fout bij verwijderen item', 'error');
            }
        },
        syncToGoogleSheets: async (command: string, payload: any) => {
            const { data, error } = await supabase.functions.invoke('google-sheets-sync', {
                body: { command, payload }
            });
            if (error) throw error;
            return data;
        }
    };

    // Scroll to top on route change
    const ScrollToTop = () => {
        const { pathname } = useLocation();
        useEffect(() => {
            window.scrollTo(0, 0);
            const root = document.getElementById('root');
            if (root) root.scrollTo(0, 0);
        }, [pathname]);
        return null;
    };

    // Layout with BottomNav
    const MainLayout = () => {
        return (
            <div className="text-base min-h-screen pb-nav-safe">
                <Outlet context={contextValue} />
                <BottomNav notifications={notifications} />
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
                                <Route path="/reset-password" element={!session ? <ResetPasswordScreen /> : <Navigate to="/" />} />
                                <Route path="/credits" element={<CreditsScreen />} />

                                {/* Protected Routes */}
                                {session ? (
                                    <Route element={<MainLayout />}>
                                        <Route index element={<HomeScreen />} />

                                        <Route path="agenda" element={<AgendaScreen />} />
                                        <Route path="agenda/beheer" element={<AgendaManageScreen />} />

                                        <Route path="notificaties" element={<NotificationsScreen />} />
                                        <Route path="notificaties/nieuw" element={<NewMessageScreen />} />
                                        <Route path="nudges" element={<NudgeSelectorScreen />} />

                                        <Route path="frituur" element={<FriesScreen />} />
                                        <Route path="/fries-overview" element={<FriesOverviewScreen />} />
                                        <Route path="/fries-comparison" element={<FriesComparisonScreen />} />
                                        <Route path="frituur/geschiedenis" element={<FriesHistoryScreen />} />
                                        <Route path="/billing-dashboard" element={<TeamDrankDashboardScreen />} />

                                        <Route path="strepen" element={<StrepenScreen />} />
                                        <Route path="strepen/geschiedenis" element={<StrepenHistoryScreen adminMode={false} />} />
                                        <Route path="strepen/geschiedenis-alle" element={<StrepenHistoryScreen adminMode={true} />} />
                                        <Route path="strepen/dashboard" element={<TeamDrankDashboardScreen />} />
                                        <Route path="strepen/voorraad" element={<TeamDrankStockScreen />} />
                                        <Route path="strepen/streaks" element={<TeamDrankStreaksScreen />} />
                                        <Route path="strepen/facturatie" element={<TeamDrankInvoicesScreen />} />
                                        <Route path="strepen/facturatie/nieuw" element={<TeamDrankBillingScreen />} />
                                        <Route path="strepen/facturatie/archief" element={<TeamDrankArchiveScreen />} />
                                        <Route path="strepen/facturatie/archief/:periodId" element={<TeamDrankInvoicesScreen />} />
                                        <Route path="strepen/facturatie/periodes" element={<BillingPeriodsManageScreen />} />
                                        <Route path="strepen/facturatie/excel" element={<TeamDrankExcelPreviewScreen />} />
                                        <Route path="strepen/facturatie/billing-excel" element={<TeamDrankBillingExcelPreviewScreen />} />
                                        <Route path="strepen/facturatie/beheer" element={<TeamDrankExcelBeheerScreen />} />
                                        <Route path="strepen/overzicht" element={<ConsumptionOverviewScreen users={users} drinks={drinks} streaks={streaks} />} />

                                        <Route path="mijn-factuur" element={<MyInvoiceScreen balance={balance} currentUser={currentUser} streaks={streaks} friesOrders={friesOrders} />} />
                                        <Route path="bierpong" element={<BierpongScreen />} />
                                        <Route path="bierpong/beheer" element={<BierpongManageScreen />} />
                                        <Route path="quotes" element={<QuotesScreen />} />
                                        <Route path="quotes/beheer" element={<QuotesScreen enableManagement={true} />} />

                                        <Route path="/winkeltje/dashboard" element={<ShopDashboardScreen />} />
                                        <Route path="/winkeltje/category/:categoryId" element={<ShopCategoryScreen />} />
                                        <Route path="/winkeltje/voorraad/tellen" element={<ShopInventoryScreen />} />

                                        <Route path="settings" element={<SettingsScreen />} />
                                        <Route path="admin/rollen" element={<RolesManageScreen />} />

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
