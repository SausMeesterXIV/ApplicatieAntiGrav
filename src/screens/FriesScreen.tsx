import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { FryItem, CartItem, Order, User } from '../types';
import { ChevronBack } from '../components/ChevronBack';
import { MOCK_USERS } from '../lib/data';
import { AppContextType } from '../App';

export const FriesScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    handlePlaceFryOrder: onPlaceOrder,
    handleRemoveFryOrder: onRemoveOrder,
    friesOrders: myOrders,
    friesSessionStatus: sessionStatus,
    setFriesSessionStatus: onSessionChange,
    friesPickupTime: pickupTime,
    currentUser
  } = useOutletContext<AppContextType>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<'frieten' | 'snacks' | 'sauzen'>('frieten');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  // Ordering for someone else state
  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [orderingFor, setOrderingFor] = useState<User | null>(null);

  // Admin / Price Editing State
  const [isAdmin, setIsAdmin] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');

  const isOrderingOpen = sessionStatus === 'open';

  // Helper to check if order is from today
  const isToday = (date: Date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear();
  };

  // Logic: 
  // 'active' orders are those in 'pending' status for today.
  // 'history' orders are 'completed' status OR active orders if the session is locked/ordered (visual only).
  const showTodayAsHistory = sessionStatus === 'ordered';

  const todayOrders = myOrders.filter(o => isToday(o.date) && o.status === 'pending' && !showTodayAsHistory);

  const historyOrders = myOrders.filter(o =>
    o.status === 'completed' ||
    (isToday(o.date) && o.status === 'pending' && showTodayAsHistory) ||
    (!isToday(o.date) && o.status === 'pending') // Catch-all for old pending
  );

  // Initial Data moved to state so it can be modified
  const [items, setItems] = useState<FryItem[]>([
    { id: '1', name: 'Klein Pak', price: 2.50, category: 'frieten' },
    { id: '2', name: 'Middel Pak', price: 3.00, category: 'frieten' },
    { id: '3', name: 'Groot Pak', price: 3.50, category: 'frieten' },
    { id: '4', name: 'Frikandel', price: 1.80, category: 'snacks' },
    { id: '5', name: 'Viandel', price: 2.00, category: 'snacks' },
    { id: '6', name: 'Kaaskroket', price: 2.20, category: 'snacks' },
    { id: '7', name: 'Mayonaise', price: 0.50, category: 'sauzen' },
    { id: '8', name: 'Ketchup', price: 0.50, category: 'sauzen' },
    { id: '9', name: 'Stoofvleessaus', price: 1.50, category: 'sauzen' },
    { id: '10', name: 'Bicky Burger', price: 4.00, category: 'snacks' },
  ]);

  const updateQuantity = (item: FryItem, delta: number) => {
    if (isAdmin) return; // Disable ordering while editing prices
    if (!isOrderingOpen) return; // Disable if session is closed

    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(i => i.id !== item.id);
        return prev.map(i => i.id === item.id ? { ...i, quantity: newQty } : i);
      } else if (delta > 0) {
        return [...prev, { ...item, quantity: 1 }];
      }
      return prev;
    });
  };

  const handleStartSession = () => {
    if (sessionStatus === 'closed') {
      onSessionChange('open');
    }
  };

  const getItemQty = (id: string) => cart.find(i => i.id === id)?.quantity || 0;
  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handlePlaceOrder = () => {
    if (!isOrderingOpen) return;
    setOrderPlaced(true);
    // Simulate processing
    setTimeout(() => {
      // Pass orderingFor if set, otherwise undefined (defaults to current user in App.tsx)
      onPlaceOrder(cart, total, orderingFor || undefined);
      setCart([]); // Clear local cart
      setOrderPlaced(false);
      // Reset ordering for state after order is placed to avoid mistakes
      if (orderingFor) {
        setOrderingFor(null);
        alert(`Bestelling geplaatst voor ${orderingFor.name}`);
      }
    }, 500);
  };

  const handleDeleteClick = (orderId: string) => {
    if (deleteConfirmId === orderId) {
      // Confirmed
      onRemoveOrder(orderId);
      setDeleteConfirmId(null);
    } else {
      // First click
      setDeleteConfirmId(orderId);
    }
  };

  // --- Admin Price Editing Logic ---
  const startEditing = (item: FryItem) => {
    setEditingId(item.id);
    setEditPrice(item.price.toFixed(2));
  };

  const savePrice = (id: string) => {
    const newPrice = parseFloat(editPrice.replace(',', '.'));
    if (!isNaN(newPrice)) {
      setItems(prev => prev.map(item => item.id === id ? { ...item, price: newPrice } : item));
    }
    setEditingId(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditPrice('');
  };

  // --- User Search Logic ---
  const filteredUsers = MOCK_USERS.filter(u =>
    (u.name || u.naam || '').toLowerCase().includes(userSearchQuery.toLowerCase()) &&
    u.id !== currentUser.id // Don't search for yourself
  );

  const selectUserForOrder = (user: User) => {
    setOrderingFor(user);
    setIsSearchingUser(false);
    setUserSearchQuery('');
  };

  // Render Search Overlay
  if (isSearchingUser) {
    return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-[#0f172a] transition-colors z-50">
        <header className="px-4 py-4 flex items-center gap-4 border-b border-gray-200 dark:border-gray-800">
          <button onClick={() => setIsSearchingUser(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
            <span className="material-icons-round text-2xl text-gray-900 dark:text-white">close</span>
          </button>
          <input
            autoFocus
            type="text"
            placeholder="Zoek op echte naam..."
            value={userSearchQuery}
            onChange={(e) => setUserSearchQuery(e.target.value)}
            className="flex-1 bg-transparent text-lg text-gray-900 dark:text-white focus:outline-none"
          />
        </header>
        <main className="flex-1 overflow-y-auto p-4 space-y-2">
          <p className="text-xs text-gray-500 uppercase font-bold tracking-wider mb-2">Resultaten</p>
          {filteredUsers.map(user => (
            <div
              key={user.id}
              onClick={() => selectUserForOrder(user)}
              className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-[#1e2330] cursor-pointer border border-transparent hover:border-gray-200 dark:hover:border-gray-700"
            >
              <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover" />
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{user.name}</p>
                <p className="text-xs text-gray-500">{user.role}</p>
              </div>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <p className="text-gray-400 text-center py-8">Geen gebruikers gevonden.</p>
          )}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
      {/* Header */}
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b pt-4 pb-3 px-4 transition-colors ${orderingFor ? 'bg-orange-50/95 dark:bg-orange-900/95 border-orange-200 dark:border-orange-800' : 'bg-white/95 dark:bg-[#0f172a]/95 border-gray-200 dark:border-gray-800'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {orderingFor ? (
              <button onClick={() => setOrderingFor(null)} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                <span className="material-icons-round text-gray-900 dark:text-white">close</span>
              </button>
            ) : (
              <ChevronBack onClick={() => navigate(-1)} />
            )}
            <div>
              <h1 className="text-xl font-bold leading-tight text-gray-900 dark:text-white">Frituur Selectie</h1>
              {orderingFor && (
                <div className="flex items-center gap-1 text-orange-600 dark:text-orange-300">
                  <span className="material-icons-round text-xs">person</span>
                  <span className="text-xs font-bold uppercase">Voor: {orderingFor.name}</span>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Admin Toggle Button */}
            {!orderingFor && (
              <div
                onClick={() => setIsAdmin(!isAdmin)}
                className={`p-2 rounded-full cursor-pointer transition-colors ${isAdmin ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}
              >
                <span className="material-icons-round text-sm">{isAdmin ? 'admin_panel_settings' : 'settings'}</span>
              </div>
            )}

            <button
              onClick={() => navigate('/frituur/overzicht')}
              className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg transition-colors border border-gray-200 dark:border-gray-700"
            >
              <span className="material-icons-round text-sm">list_alt</span>
              <span className="text-xs font-bold">Overzicht</span>
            </button>
          </div>
        </div>
        {!orderingFor && (
          <div className="mt-2 flex justify-between items-center">
            <div className="text-xs text-gray-500 dark:text-gray-400 pl-8">
              Bestelling voor <span className="font-bold text-gray-900 dark:text-white">{currentUser.name}</span>
            </div>
            {isAdmin && (
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
                BEWERK MODUS
              </span>
            )}
          </div>
        )}
      </header>

      {/* Tabs */}
      <div className="px-4 py-3 bg-gray-50 dark:bg-[#0f172a] sticky top-[85px] z-40 overflow-x-auto no-scrollbar transition-colors">
        <div className="flex gap-2">
          {['frieten', 'snacks', 'sauzen'].map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat as any)}
              className={`px-4 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap border capitalize transition-all ${activeCategory === cat
                ? 'bg-blue-600/10 text-blue-600 border-blue-600/20 dark:text-blue-400 dark:border-blue-400/30'
                : 'bg-white dark:bg-[#1e2330] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <main className="flex-1 overflow-y-auto px-4 pb-36 pt-2">

        {/* PICKUP TIME BANNER (Only when ordered) */}
        {sessionStatus === 'ordered' && pickupTime && (
          <div className="mb-6 rounded-xl p-5 bg-gradient-to-r from-green-600 to-green-500 shadow-lg shadow-green-500/20 text-white animate-in slide-in-from-top-4">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <span className="material-icons-round text-2xl">restaurant_menu</span>
              </div>
              <h3 className="font-bold text-xl">Besteld!</h3>
            </div>
            <p className="text-green-50 text-sm mb-3">De bestelling is doorgegeven aan de frituur.</p>
            <div className="bg-white/10 rounded-lg p-3 flex items-center gap-3 backdrop-blur-sm">
              <span className="material-icons-round text-green-100">schedule</span>
              <div>
                <span className="text-xs text-green-100 uppercase font-bold tracking-wide block">Afhalen om</span>
                <span className="text-2xl font-bold">{pickupTime}</span>
              </div>
            </div>
          </div>
        )}

        {/* ORDERING IN PROGRESS BANNER */}
        {sessionStatus === 'ordering' && (
          <div className="mb-6 rounded-xl p-4 flex items-center justify-between border shadow-sm bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 bg-orange-100 dark:bg-orange-800 text-orange-600 dark:text-orange-200">
                <span className="material-icons-round">call</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  Bestelling wordt doorgegeven
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Even geduld aub...
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Order for Someone Else Button */}
        {isOrderingOpen && !orderingFor && (
          <button
            onClick={() => setIsSearchingUser(true)}
            className="w-full mb-6 bg-white dark:bg-[#1e2330] border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-3 flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <span className="material-icons-round text-sm">person_add</span>
            <span className="text-sm font-medium">Bestel voor vriend(in)</span>
          </button>
        )}

        {/* Standard Session Status Banner (Open, Closed, Completed) */}
        {(sessionStatus === 'open' || sessionStatus === 'closed' || sessionStatus === 'completed') && !orderingFor && (
          <div className={`mb-6 rounded-xl p-4 flex items-center justify-between border shadow-sm ${sessionStatus === 'open'
            ? 'bg-green-50 dark:bg-green-900/10 border-green-200 dark:border-green-800'
            : 'bg-white dark:bg-[#1e2330] border-gray-200 dark:border-gray-800'
            }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${sessionStatus === 'open' ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-700 text-gray-500'
                }`}>
                <span className="material-icons-round">{sessionStatus === 'open' ? 'lock_open' : 'lock'}</span>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 dark:text-white text-sm">
                  {sessionStatus === 'open' ? 'Bestellingen Open' : (sessionStatus === 'completed' ? 'Bestellingen Afgerond' : 'Nog niet gestart')}
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {sessionStatus === 'open'
                    ? 'Iedereen kan nu bestellen.'
                    : (sessionStatus === 'closed' ? 'Je kan nog niet bestellen.' : 'Er kan niet meer besteld worden.')}
                </p>
              </div>
            </div>

            {sessionStatus === 'closed' && (
              <button
                onClick={handleStartSession}
                className="px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors bg-green-600 text-white border-green-600 hover:bg-green-700"
              >
                Starten
              </button>
            )}
            {sessionStatus !== 'closed' && (
              <button
                onClick={() => navigate('/frituur/overzicht')}
                className="text-xs text-blue-600 dark:text-blue-400 font-bold hover:underline"
              >
                Beheer
              </button>
            )}
          </div>
        )}

        {/* ITEMS GRID */}
        <div className="space-y-4 mb-8">
          {items.filter(i => i.category === activeCategory).map((item) => {
            const qty = getItemQty(item.id);
            const isEditing = editingId === item.id;

            return (
              <div key={item.id} className={`bg-white dark:bg-[#1e2330] rounded-xl p-4 shadow-sm border transition-all ${qty > 0 ? 'border-blue-600 ring-1 ring-blue-600 dark:border-blue-500 dark:ring-blue-500' : 'border-gray-100 dark:border-gray-800'} ${!isOrderingOpen ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <h3 className={`font-semibold text-lg ${qty > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{item.name}</h3>

                    {/* Price Display / Editing */}
                    <div className="flex items-center mt-0.5">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500 text-sm">€</span>
                          <input
                            type="number"
                            step="0.01"
                            value={editPrice}
                            onChange={(e) => setEditPrice(e.target.value)}
                            className="w-20 px-2 py-1 text-sm bg-gray-50 dark:bg-gray-700 border border-blue-500 rounded focus:outline-none"
                            autoFocus
                          />
                          <button onClick={() => savePrice(item.id)} className="p-1 bg-green-100 text-green-700 rounded hover:bg-green-200">
                            <span className="material-icons-round text-sm">check</span>
                          </button>
                          <button onClick={cancelEdit} className="p-1 bg-red-100 text-red-700 rounded hover:bg-red-200">
                            <span className="material-icons-round text-sm">close</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <p className="text-gray-500 dark:text-gray-400 text-sm">€ {item.price.toFixed(2)}</p>
                          {isAdmin && !orderingFor && (
                            <button
                              onClick={() => startEditing(item)}
                              className="text-gray-300 hover:text-blue-600 transition-colors"
                            >
                              <span className="material-icons-round text-xs">edit</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Quantity Controls - Disabled if closed or admin */}
                  <div className={`flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1 gap-3 transition-colors ${isAdmin || !isOrderingOpen ? 'opacity-50 pointer-events-none' : ''}`}>
                    <button
                      onClick={() => updateQuantity(item, -1)}
                      className={`w-8 h-8 flex items-center justify-center rounded-md shadow-sm active:scale-95 transition-all ${qty > 0 ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400' : 'bg-white dark:bg-gray-700 text-gray-400'}`}
                    >
                      <span className="material-icons-round text-sm">remove</span>
                    </button>
                    <span className={`font-bold w-4 text-center ${qty > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-400'}`}>{qty}</span>
                    <button
                      onClick={() => updateQuantity(item, 1)}
                      className="w-8 h-8 flex items-center justify-center rounded-md bg-blue-600 text-white shadow-md active:scale-95 transition-all hover:bg-blue-700"
                    >
                      <span className="material-icons-round text-sm">add</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* CURRENT ORDER SECTION */}
        {todayOrders.length > 0 && !orderingFor && (
          <section className="mb-8 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-icons-round text-blue-600 dark:text-blue-500">shopping_bag</span>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Huidige Bestelling</h2>
            </div>

            <div className="space-y-3">
              {todayOrders.map((order) => (
                <div key={order.id} className="bg-white dark:bg-[#1e2330] p-4 rounded-xl border-l-4 border-l-blue-600 border-y border-r border-gray-200 dark:border-gray-800 dark:border-l-blue-500 shadow-md">
                  <div className="flex justify-between items-start mb-3">
                    <div>
                      <span className="text-xs text-blue-600 dark:text-blue-400 font-bold uppercase tracking-wide">
                        Vandaag, {order.date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <div className="font-bold text-2xl text-gray-900 dark:text-white mt-1">
                        € {order.totalPrice.toFixed(2).replace('.', ',')}
                      </div>
                    </div>
                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400`}>
                      Actief
                    </span>
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1 mb-4">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between border-b border-dashed border-gray-100 dark:border-gray-800 pb-1 last:border-0">
                        <span>{item.quantity}x {item.name}</span>
                        <span className="text-gray-400">€ {(item.price * item.quantity).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Delete Button for Current Order */}
                  {sessionStatus === 'open' && (
                    <button
                      onClick={() => handleDeleteClick(order.id)}
                      className={`w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${deleteConfirmId === order.id
                        ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-700'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400'
                        }`}
                    >
                      {deleteConfirmId === order.id ? (
                        <>
                          <span className="material-icons-round">warning</span>
                          <span>Ben je zeker? Klik om te verwijderen</span>
                        </>
                      ) : (
                        <>
                          <span className="material-icons-round">delete_outline</span>
                          <span>Bestelling Verwijderen</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ORDER HISTORY SECTION */}
        <section className="mb-4 pt-4 border-t border-gray-200 dark:border-gray-800">
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4 flex items-center gap-2">
            <span className="material-icons-round text-lg">history</span>
            Bestelgeschiedenis
          </h2>

          {historyOrders.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 dark:bg-[#1e2330]/50 rounded-xl border border-dashed border-gray-200 dark:border-gray-800">
              <span className="material-icons-round text-gray-300 text-4xl mb-2">fastfood</span>
              <p className="text-gray-500 text-sm">Geen eerdere bestellingen.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyOrders.map((order) => {
                // Check if this specific order is from today AND we are in 'ordered' mode
                const isTodayOrderOrdered = isToday(order.date) && sessionStatus === 'ordered' && order.status === 'pending';

                return (
                  <div key={order.id} className={`bg-white dark:bg-[#1e2330] p-4 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm relative group transition-opacity ${!isTodayOrderOrdered ? 'opacity-75 hover:opacity-100' : ''}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wide">
                          {order.date.toLocaleDateString('nl-BE')} • {order.date.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="font-bold text-gray-900 dark:text-white mt-0.5">
                          € {order.totalPrice.toFixed(2).replace('.', ',')}
                        </div>
                      </div>

                      <span className={`text-[10px] px-2 py-1 rounded-md font-bold ${isTodayOrderOrdered ? 'bg-green-600 text-white' : 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'}`}>
                        {isTodayOrderOrdered ? 'Onderweg' : (order.status === 'completed' ? 'Gearchiveerd' : 'Geboekt')}
                      </span>
                    </div>

                    <div className="text-xs text-gray-600 dark:text-gray-300 space-y-1">
                      {order.items.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span>{item.quantity}x {item.name}</span>
                          <span className="text-gray-400">€ {(item.price * item.quantity).toFixed(2)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Helper text */}
        <p className="text-center text-xs text-gray-400 pb-4">
          Alle bestellingen worden automatisch samengevoegd in het overzicht.
        </p>
      </main>

      {/* Floating Bottom Bar - Only visible if items in cart AND not admin AND Open */}
      {cart.length > 0 && !isAdmin && isOrderingOpen && (
        <footer className={`fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300`}>
          <div className={`border rounded-2xl p-4 shadow-2xl transition-colors ${orderingFor ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800' : 'bg-white dark:bg-[#1e2330] border-gray-200 dark:border-gray-700'}`}>
            <div className="flex justify-between items-end mb-3">
              <div>
                <span className={`text-xs font-medium uppercase ${orderingFor ? 'text-orange-600 dark:text-orange-300' : 'text-gray-500 dark:text-gray-400'}`}>
                  Totaal {orderingFor ? `voor ${orderingFor.name}` : ''} ({cart.reduce((a, b) => a + b.quantity, 0)} items)
                </span>
                <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">€ {total.toFixed(2)}</div>
              </div>
            </div>
            <button
              onClick={handlePlaceOrder}
              disabled={orderPlaced}
              className={`w-full font-bold py-3 px-6 rounded-xl shadow-lg flex items-center justify-center gap-2 transition-all transform active:scale-[0.98] ${orderingFor
                ? 'bg-orange-600 hover:bg-orange-700 text-white shadow-orange-500/30'
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-500/30'
                }`}
            >
              {orderPlaced ? (
                <span className="material-icons-round animate-spin">refresh</span>
              ) : (
                <>
                  <span className="material-icons-round">check_circle</span>
                  <span>Bestelling Bevestigen</span>
                </>
              )}
            </button>
            <p className="text-[10px] text-center text-gray-400 mt-2">
              {orderingFor
                ? 'Deze bestelling wordt gekoppeld aan het account van de gekozen persoon.'
                : 'Wordt direct toegevoegd aan je voorlopige rekening.'}
            </p>
          </div>
        </footer>
      )}
    </div>
  );
};