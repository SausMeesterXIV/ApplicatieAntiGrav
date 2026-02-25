import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import { supabase } from './lib/supabase';
import { User, Drink, Streak, StockItem, Order, CountdownItem, BierpongGame, QuoteItem, Notification, Event } from './types';
import { getCurrentUser, MOCK_USERS } from './lib/data';

import { BottomNav } from './components/BottomNav';
import { CredentialsScreen } from './screens/CredentialsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { NotificationsScreen } from './screens/NotificationsScreen';
import { NewMessageScreen } from './screens/NewMessageScreen';
import { NudgeSelectorScreen } from './screens/NudgeSelectorScreen';
import { AgendaScreen } from './screens/AgendaScreen';
import { AgendaManageScreen } from './screens/AgendaManageScreen';
import { FriesScreen } from './screens/FriesScreen';
import { FriesOverviewScreen } from './screens/FriesOverviewScreen';
import { StrepenScreen } from './screens/StrepenScreen';
import { TeamDrankDashboardScreen } from './screens/TeamDrankDashboardScreen';
import { TeamDrankStockScreen } from './screens/TeamDrankStockScreen';
import { TeamDrankStreaksScreen } from './screens/TeamDrankStreaksScreen';
import { TeamDrankBillingScreen } from './screens/TeamDrankBillingScreen';
import { TeamDrankInvoicesScreen } from './screens/TeamDrankInvoicesScreen';
import { TeamDrankArchiveScreen } from './screens/TeamDrankArchiveScreen';
import { TeamDrankExcelPreviewScreen } from './screens/TeamDrankExcelPreviewScreen';
import { TeamDrankBillingExcelPreviewScreen } from './screens/TeamDrankBillingExcelPreviewScreen';
import { ConsumptionOverviewScreen, ConsumptionOverviewScreenProps } from './screens/ConsumptionOverviewScreen';
import { MyInvoiceScreen, MyInvoiceScreenProps } from './screens/MyInvoiceScreen';
import { BierpongScreen } from './screens/BierpongScreen';
import { QuotesScreen } from './screens/QuotesScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { RolesManageScreen } from './screens/RolesManageScreen';

// Export the context type so screens can use it
export type AppContextType = {
    currentUser: User;
    setCurrentUser: React.Dispatch<React.SetStateAction<User>>;
    users: User[];
    setUsers: React.Dispatch<React.SetStateAction<User[]>>;
    drinks: Drink[];
    setDrinks: React.Dispatch<React.SetStateAction<Drink[]>>;
    streaks: Streak[];
    setStreaks: React.Dispatch<React.SetStateAction<Streak[]>>;
    stockItems: StockItem[];
    setStockItems: React.Dispatch<React.SetStateAction<StockItem[]>>;
    balance: number;
    setBalance: React.Dispatch<React.SetStateAction<number>>;
    friesOrders: Order[];
    setFriesOrders: React.Dispatch<React.SetStateAction<Order[]>>;
    friesSessionStatus: 'open' | 'closed' | 'completed' | 'ordering' | 'ordered';
    setFriesSessionStatus: React.Dispatch<React.SetStateAction<'open' | 'closed' | 'completed' | 'ordering' | 'ordered'>>;
    friesPickupTime: string | null;
    setFriesPickupTime: React.Dispatch<React.SetStateAction<string | null>>;
    countdowns: CountdownItem[];
    setCountdowns: React.Dispatch<React.SetStateAction<CountdownItem[]>>;
    bierpongGames: BierpongGame[];
    setBierpongGames: React.Dispatch<React.SetStateAction<BierpongGame[]>>;
    quotes: QuoteItem[];
    setQuotes: React.Dispatch<React.SetStateAction<QuoteItem[]>>;
    events: Event[];
    setEvents: React.Dispatch<React.SetStateAction<Event[]>>;
    notifications: Notification[];
    setNotifications: React.Dispatch<React.SetStateAction<Notification[]>>;
    handleAddCost: (amount: number, drink?: Drink) => void;
    handleDeleteStreak: (id: string) => void;
    handleQuickStreep: () => void;
    handlePlaceFryOrder: (items: any[], totalCost: number, targetUser?: User) => void;
    handleRemoveFryOrder: (orderId: string) => void;
    handleArchiveSession: () => void;
    handleVoteQuote: (id: string, type: 'like' | 'dislike') => void;
    handleAddQuote: (text: string, context: string, authorId: string) => void;
    handleDeleteQuote: (id: string) => void;
    handleSaveEvent: (event: Event) => void;
    handleDeleteEvent: (id: string) => void;
    handleAddNotification: (notification: Omit<Notification, 'id'>) => void;
    handleMarkNotificationAsRead: (id: number) => void;
};


function App() {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Provide the Supabase profile mapped to the prototype User structure
    const [currentUser, setCurrentUser] = useState<User>(() => getCurrentUser());
    const [users, setUsers] = useState<User[]>(MOCK_USERS);

    const [drinks, setDrinks] = useState<Drink[]>([]);

    // Default streaks from prototype
    const [streaks, setStreaks] = useState<Streak[]>([
        { id: 's1', userId: '1', drinkId: '2', drinkName: 'Bier', price: 1.20, timestamp: new Date(new Date().setDate(new Date().getDate() - 1)) },
        { id: 's2', userId: '2', drinkId: '1', drinkName: 'Cola', price: 1.00, timestamp: new Date(new Date().setDate(new Date().getDate() - 1)) },
    ]);

    const [stockItems, setStockItems] = useState<StockItem[]>([
        { id: 1, name: 'Stella Vaten (50L)', label: 'Kampvuuravond', category: 'Standaard', count: 3, unit: 'stuks', exp: '12/10/24', urgent: true, icon: 'sports_bar', color: 'bg-yellow-500' },
        { id: 2, name: 'Cola Kratten (24x25cl)', label: 'Startdag', category: 'Standaard', count: 8, unit: 'kratt.', exp: '01/05/25', urgent: false, icon: 'local_drink', color: 'bg-red-900' }
    ]);

    const [balance, setBalance] = useState(25.00);
    const [friesOrders, setFriesOrders] = useState<Order[]>([]);
    const [friesSessionStatus, setFriesSessionStatus] = useState<'open' | 'closed' | 'completed' | 'ordering' | 'ordered'>('closed');
    const [friesPickupTime, setFriesPickupTime] = useState<string | null>(null);

    const [countdowns, setCountdowns] = useState<CountdownItem[]>(() => {
        const nextYear = new Date().getFullYear() + 1;
        return [{ id: '1', title: 'Groot Kamp', targetDate: new Date(nextYear, 6, 21) }];
    });

    const [bierpongGames, setBierpongGames] = useState<BierpongGame[]>([
        { id: 'bp1', playerIds: ['1', '2'], winnerId: '1', timestamp: new Date() }
    ]);

    const [quotes, setQuotes] = useState<QuoteItem[]>([
        {
            id: '1', text: "Tibo is de opperkeizer 👑", authorId: '2', authorName: 'Luuk',
            context: 'Tijdens de algemene vergadering', date: new Date(),
            likes: ['3', '4'], dislikes: [], addedBy: '1'
        }
    ]);

    const [events, setEvents] = useState<Event[]>([
        { id: '1', title: 'Leidingskring', date: new Date(), location: 'Lokaal', type: 'vergadering', startTime: '20:00' }
    ]);

    const [notifications, setNotifications] = useState<Notification[]>([
        {
            id: 1, type: 'official', sender: 'Hoofdleiding', role: 'ADMIN', title: 'Openstaande Drankrekening',
            content: 'Betaal a.u.b. je drankrekening', time: '2u geleden', isRead: false,
            action: '', icon: 'security', color: 'bg-blue-100 text-blue-600'
        }
    ]);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else setLoading(false);
        });

        supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            if (session) fetchProfile(session.user.id);
            else {
                // Return to mock user if logged out during dev, or handle properly
                setLoading(false);
            }
        });

        // Fetch drinks
        const fetchDrinks = async () => {
            const { data } = await supabase.from('dranken').select('*').order('naam');
            if (data && data.length > 0) {
                setDrinks(data.map(d => ({ id: d.id, name: d.naam, price: d.prijs })));
            } else {
                setDrinks([
                    { id: '1', name: 'Cola', price: 1.00 },
                    { id: '2', name: 'Bier', price: 1.20 },
                ]);
            }
        };
        fetchDrinks();
    }, []);

    async function fetchProfile(userId: string) {
        const { data } = await supabase.from('profiles').select('*').eq('id', userId).single();
        if (data) {
            setCurrentUser({
                ...currentUser,
                id: data.id,
                naam: data.naam,
                name: data.naam,
                rol: data.rol,
            });
        }
        setLoading(false);
    }

    // --- Handlers ---
    const handleAddCost = (amount: number, drink?: Drink) => {
        setBalance(prev => prev + amount);
        if (drink) {
            const newStreak: Streak = {
                id: Date.now().toString(), userId: currentUser.id, drinkId: drink.id,
                drinkName: drink.name, price: drink.price, timestamp: new Date(),
            };
            setStreaks(prev => [newStreak, ...prev]);
        }
    };

    const handleDeleteStreak = (id: string) => setStreaks(prev => prev.filter(s => s.id !== id));

    const handleQuickStreep = () => {
        const drinkId = currentUser.quickDrinkId || '2';
        const drink = drinks.find(d => String(d.id) === String(drinkId));
        if (drink) {
            handleAddCost(drink.price, drink);
            handleAddNotification({
                type: 'official', sender: 'Systeem', role: '', title: 'Quick Streep',
                content: `Je hebt zojuist een ${drink.name} gestreept.`,
                time: 'Zonet', isRead: false, action: '', icon: 'local_bar',
                color: 'bg-blue-100 text-blue-600'
            });
        }
    };

    const handlePlaceFryOrder = (items: any[], totalCost: number, targetUser?: User) => {
        const orderForUser = targetUser || currentUser;
        if (!targetUser) handleAddCost(totalCost);
        const newOrder: Order = {
            id: Math.random().toString(36).substr(2, 9), userId: orderForUser.id,
            userName: orderForUser.naam || orderForUser.name || 'Onbekend', items, totalPrice: totalCost, date: new Date(), status: 'pending'
        };
        setFriesOrders(prev => [newOrder, ...prev]);
    };

    const handleRemoveFryOrder = (orderId: string) => {
        const orderToRemove = friesOrders.find(o => o.id === orderId);
        if (orderToRemove) {
            if (orderToRemove.userId === currentUser.id) handleAddCost(-orderToRemove.totalPrice);
            setFriesOrders(prev => prev.filter(o => o.id !== orderId));
        }
    };

    const handleArchiveSession = () => {
        setFriesOrders(prev => prev.map(o => ({ ...o, status: 'completed' })));
        setFriesSessionStatus('closed');
        setFriesPickupTime(null);
    };

    const handleVoteQuote = (id: string, type: 'like' | 'dislike') => {
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
    };

    const handleAddQuote = (text: string, context: string, authorId: string) => {
        const author = users.find(u => u.id === authorId);
        const newQuote: QuoteItem = {
            id: Date.now().toString(), text, authorId, authorName: author ? (author.naam || author.name || 'Unknown') : 'Unknown',
            context, date: new Date(), likes: [], dislikes: [], addedBy: currentUser.id
        };
        setQuotes([newQuote, ...quotes]);
    };

    const handleDeleteQuote = (id: string) => setQuotes(prev => prev.filter(q => q.id !== id));
    const handleSaveEvent = (event: Event) => setEvents(prev => prev.find(e => e.id === event.id) ? prev.map(e => e.id === event.id ? event : e) : [...prev, event]);
    const handleDeleteEvent = (id: string) => setEvents(prev => prev.filter(e => e.id !== id));
    const handleAddNotification = (n: Omit<Notification, 'id'>) => setNotifications(prev => [{ ...n, id: Date.now() }, ...prev]);
    const handleMarkNotificationAsRead = (id: number) => setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen bg-ksa-blue">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
            </div>
        );
    }

    const contextValue: AppContextType = {
        currentUser, setCurrentUser, users, setUsers, drinks, setDrinks,
        streaks, setStreaks, stockItems, setStockItems, balance, setBalance,
        friesOrders, setFriesOrders, friesSessionStatus, setFriesSessionStatus,
        friesPickupTime, setFriesPickupTime, countdowns, setCountdowns,
        bierpongGames, setBierpongGames, quotes, setQuotes, events, setEvents,
        notifications, setNotifications,
        handleAddCost, handleDeleteStreak, handleQuickStreep, handlePlaceFryOrder,
        handleRemoveFryOrder, handleArchiveSession, handleVoteQuote, handleAddQuote,
        handleDeleteQuote, handleSaveEvent, handleDeleteEvent, handleAddNotification,
        handleMarkNotificationAsRead
    };

    // Layout with BottomNav
    const MainLayout = () => {
        return (
            <div className="text-base min-h-screen pb-24">
                <Outlet context={contextValue} />
                <BottomNav />
            </div>
        );
    };

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={!session ? <CredentialsScreen /> : <Navigate to="/" />} />

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
                        <Route path="frituur/overzicht" element={<FriesOverviewScreen />} />

                        <Route path="strepen" element={<StrepenScreen />} />
                        <Route path="strepen/dashboard" element={<TeamDrankDashboardScreen />} />
                        <Route path="strepen/voorraad" element={<TeamDrankStockScreen />} />
                        <Route path="strepen/streaks" element={<TeamDrankStreaksScreen />} />
                        <Route path="strepen/facturatie" element={<TeamDrankInvoicesScreen />} />
                        <Route path="strepen/facturatie/nieuw" element={<TeamDrankBillingScreen />} />
                        <Route path="strepen/facturatie/archief" element={<TeamDrankArchiveScreen />} />
                        <Route path="strepen/facturatie/excel" element={<TeamDrankExcelPreviewScreen />} />
                        <Route path="strepen/facturatie/billing-excel" element={<TeamDrankBillingExcelPreviewScreen />} />
                        <Route path="strepen/overzicht" element={<ConsumptionOverviewScreen />} />

                        <Route path="mijn-factuur" element={<MyInvoiceScreen />} />
                        <Route path="bierpong" element={<BierpongScreen />} />
                        <Route path="quotes" element={<QuotesScreen />} />
                        <Route path="quotes/beheer" element={<QuotesScreen />} />

                        <Route path="settings" element={<SettingsScreen />} />
                        <Route path="admin/rollen" element={<RolesManageScreen />} />
                    </Route>
                ) : (
                    <Route path="*" element={<Navigate to="/login" />} />
                )}
            </Routes>
        </BrowserRouter>
    );
}

export default App;
