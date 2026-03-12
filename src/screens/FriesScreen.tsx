import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { useFries } from '../contexts/FriesContext';
import { useAgenda } from '../contexts/AgendaContext';
import { FryItem, CartItem, User } from '../types';
import { ChevronBack } from '../components/ChevronBack';
import { BottomSheet } from '../components/Modal';
import { hapticSuccess } from '../lib/haptics';
import { SkeletonCard } from '../components/Skeleton';
import { showToast } from '../components/Toast';
import { FriesItemCard } from '../components/Fries/FriesItemCard';
import { FRITUUR_STATUS, FRITUUR_UI_CATEGORIES, FRITUUR_DB_CATEGORIES } from '../lib/constants';

export const FriesScreen: React.FC = () => {
  const navigate = useNavigate();
  const { currentUser, users, loading: authLoading } = useAuth();
  const { handleAddNotification: onAddNotification } = useAgenda();
  const { handlePlaceFryOrder: onPlaceOrder, handleRemoveFryOrder: onRemoveOrder, friesOrders: myOrders, activeFrituurSession, setFriesSessionStatus: onSessionChange, setFriesPickupTime: onSetPickupTime, fryItems: items, handleAddFryItem, handleUpdateFryItem, handleDeleteFryItem, loading: friesLoading } = useFries();
  
  const loading = authLoading || friesLoading;
  
  const sessionStatus = activeFrituurSession?.status || FRITUUR_STATUS.CLOSED;
  const pickupTime = activeFrituurSession?.pickupTime;
  
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favoriteCart, setFavoriteCart] = useState<CartItem[]>(() => { try { const saved = localStorage.getItem('ksa_favorite_fry_order'); if (saved) return JSON.parse(saved); } catch { } return []; });
  const [favoriteItems, setFavoriteItems] = useState<string[]>(() => { try { const saved = localStorage.getItem('ksa_favorite_fry_items'); if (saved) return JSON.parse(saved); } catch { } return []; });
  
  const [activeCategory, setActiveCategory] = useState<typeof FRITUUR_UI_CATEGORIES[number]>('frieten');
  const [searchQuery, setSearchQuery] = useState('');
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const [isSearchingUser, setIsSearchingUser] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [orderingFor, setOrderingFor] = useState<User | null>(null);

  const [isAdmin, setIsAdmin] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<string>('');

  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [tempPickupTime, setTempPickupTime] = useState(() => { const now = new Date(); now.setMinutes(now.getMinutes() + 30); return now.toTimeString().slice(0, 5); });

  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<FryItem['category']>('snacks');

  const isOrderingOpen = sessionStatus === FRITUUR_STATUS.OPEN;

  const allActiveOrders = myOrders.filter(o => o.status === 'pending');
  const orderSummaryItems = (() => {
    const map = new Map<string, { name: string; count: number; price: number; category: string }>();
    allActiveOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = map.get(item.id);
        if (existing) { existing.count += item.quantity; existing.price += item.price * item.quantity; }
        else { map.set(item.id, { name: item.name, count: item.quantity, price: item.price * item.quantity, category: item.category }); }
      });
    });
    return Array.from(map.values());
  })();

  const isToday = (date: Date) => { const today = new Date(); return date.getDate() === today.getDate() && date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear(); };
  
  const showTodayAsHistory = sessionStatus === FRITUUR_STATUS.ORDERED;
  const myOwnOrders = myOrders.filter(o => o.userId === currentUser?.id);
  const todayOrders = myOwnOrders.filter(o => isToday(o.date) && o.status === 'pending' && !showTodayAsHistory);
  const historyOrders = myOwnOrders.filter(o => o.status === 'completed' || (isToday(o.date) && o.status === 'pending' && showTodayAsHistory) || (!isToday(o.date) && o.status === 'pending') );

  const updateQuantity = (item: FryItem, delta: number) => {
    if (isAdmin || !isOrderingOpen) return;
    setCart(prev => {
      const existing = prev.find(i => i.id === item.id);
      if (existing) {
        const newQty = existing.quantity + delta;
        if (newQty <= 0) return prev.filter(i => i.id !== item.id);
        return prev.map(i => i.id === item.id ? { ...i, quantity: newQty } : i);
      } else if (delta > 0) return [...prev, { ...item, quantity: 1 }];
      return prev;
    });
  };

  const handleStartSession = () => { if (sessionStatus === FRITUUR_STATUS.CLOSED) onSessionChange(FRITUUR_STATUS.OPEN); };
  const handleSaveFavorite = () => { if (cart.length > 0) { localStorage.setItem('ksa_favorite_fry_order', JSON.stringify(cart)); setFavoriteCart(cart); showToast('Maaltijd opgeslagen! ⭐️', 'success'); } };
  const handleLoadFavorite = () => { if (favoriteCart.length > 0) setCart(favoriteCart); };
  const toggleFavoriteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteItems(prev => { const isFav = prev.includes(id); const newFavs = isFav ? prev.filter(i => i !== id) : [...prev, id]; localStorage.setItem('ksa_favorite_fry_items', JSON.stringify(newFavs)); return newFavs; });
  };
  const getItemQty = (id: string) => cart.find(i => i.id === id)?.quantity || 0;
  const total = cart.reduce((acc, item) => acc + (item.price * item.quantity), 0);

  const handlePlaceOrder = () => {
    if (!isOrderingOpen) return;
    setOrderPlaced(true);
    hapticSuccess();
    setTimeout(() => {
      onPlaceOrder(cart, total, orderingFor || undefined);
      setCart([]);
      setOrderPlaced(false);
      if (orderingFor) { showToast(`Bestelling voor ${orderingFor.naam}`, 'success'); setOrderingFor(null); }
    }, 500);
  };

  const handleDeleteClick = (orderId: string) => { if (deleteConfirmId === orderId) { onRemoveOrder(orderId); setDeleteConfirmId(null); } else { setDeleteConfirmId(orderId); } };
  const startEditing = (item: FryItem) => { setEditingId(item.id); setEditPrice(item.price.toFixed(2)); };
  const savePrice = async (id: string) => { const newPrice = parseFloat(editPrice.replace(',', '.')); if (!isNaN(newPrice)) { await handleUpdateFryItem(id, { price: newPrice }); } setEditingId(null); };
  const cancelEdit = () => { setEditingId(null); setEditPrice(''); };

  const handleAddItem = async () => {
    const price = parseFloat(newItemPrice.replace(',', '.'));
    if (!newItemName.trim() || isNaN(price)) return;
    hapticSuccess();
    await handleAddFryItem({ name: newItemName.trim(), price, category: newItemCategory, description: null, created_at: new Date().toISOString() } as any);
    setNewItemName(''); setNewItemPrice(''); setNewItemCategory('snacks'); setShowAddForm(false);
  };

  const filteredUsers = users.filter(u => (u.naam || '').toLowerCase().includes(userSearchQuery.toLowerCase()) && u.id !== currentUser?.id);
  const selectUserForOrder = (user: User) => { setOrderingFor(user); setIsSearchingUser(false); setUserSearchQuery(''); };

  if (isSearchingUser) {
    return (
      <div className="flex flex-col min-h-screen bg-white dark:bg-[#0f172a] transition-colors z-50">
        <header className="px-4 py-4 flex items-center gap-4 border-b border-gray-200 dark:border-gray-800">
          <button onClick={() => setIsSearchingUser(false)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:hover:bg-gray-800"><span className="material-icons-round text-2xl text-gray-900 dark:text-white">close</span></button>
          <input autoFocus type="text" placeholder="Zoek op echte naam..." value={userSearchQuery} onChange={(e) => setUserSearchQuery(e.target.value)} className="flex-1 bg-transparent text-lg text-gray-900 dark:text-white focus:outline-none" />
        </header>
        <main className="flex-1 overflow-y-auto p-4 space-y-2">
          {filteredUsers.map(user => (
            <div key={user.id} onClick={() => selectUserForOrder(user)} className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-[#1e2330] cursor-pointer">
              <img src={user.avatar} alt={user.naam} className="w-10 h-10 rounded-full object-cover" />
              <div><p className="font-bold text-gray-900 dark:text-white">{user.naam}</p><p className="text-xs text-gray-500">{user.role}</p></div>
            </div>
          ))}
        </main>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
      <header className={`sticky top-0 z-50 backdrop-blur-md border-b pt-4 pb-3 px-4 transition-colors ${orderingFor ? 'bg-orange-50/95 dark:bg-orange-900/95 border-orange-200 dark:border-orange-800' : 'bg-white/95 dark:bg-[#0f172a]/95 border-gray-200 dark:border-gray-800'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {orderingFor ? <button onClick={() => setOrderingFor(null)} className="p-2 -ml-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10"><span className="material-icons-round text-gray-900 dark:text-white">close</span></button> : <ChevronBack onClick={() => navigate(-1)} />}
            <div>
              <h1 className="text-xl font-bold leading-tight text-gray-900 dark:text-white">Frituur Selectie</h1>
              {orderingFor && <div className="flex items-center gap-1 text-orange-600 dark:text-orange-300"><span className="material-icons-round text-xs">person</span><span className="text-xs font-bold uppercase">Voor: {orderingFor.naam}</span></div>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!orderingFor && <div onClick={() => setIsAdmin(!isAdmin)} className={`p-2 rounded-full cursor-pointer transition-colors ${isAdmin ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'}`}><span className="material-icons-round text-sm">{isAdmin ? 'admin_panel_settings' : 'settings'}</span></div>}
            <button onClick={() => navigate('/frituur/overzicht')} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 font-bold text-xs">Overzicht</button>
          </div>
        </div>
      </header>

      {!orderingFor && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-[#0f172a] border-b border-gray-100 dark:border-gray-800 transition-colors">
          {sessionStatus === FRITUUR_STATUS.CLOSED && (
            <button onClick={() => onSessionChange(FRITUUR_STATUS.OPEN)} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-500/20 transition-all"><span className="material-icons-round text-lg">play_arrow</span>Bestelling Openen</button>
          )}
          {sessionStatus === FRITUUR_STATUS.OPEN && (
            <button onClick={() => onSessionChange(FRITUUR_STATUS.COMPLETED)} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-red-500/20 transition-all"><span className="material-icons-round text-lg">block</span>Opnemen Stoppen</button>
          )}
          {sessionStatus === FRITUUR_STATUS.COMPLETED && (
            <div className="space-y-2">
              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center gap-2 text-yellow-700"><span className="material-icons-round">lock</span><span className="text-sm font-bold">Gesloten</span></div>
              <div className="flex gap-2">
                <button onClick={() => { if (showReopenConfirm) { onSessionChange(FRITUUR_STATUS.OPEN); setShowReopenConfirm(false); } else setShowReopenConfirm(true); }} className={`flex-1 py-2.5 rounded-xl font-bold text-sm ${showReopenConfirm ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-600'}`}>{showReopenConfirm ? 'Zeker?' : 'Heropenen'}</button>
                <button onClick={() => onSessionChange(FRITUUR_STATUS.ORDERING)} className="flex-1 bg-orange-600 text-white py-2.5 rounded-xl font-bold text-sm shadow-lg shadow-orange-500/20">Bestellen</button>
              </div>
            </div>
          )}
          {sessionStatus === FRITUUR_STATUS.ORDERING && (
            <div className="space-y-2">
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex items-center gap-2 text-orange-700"><span className="material-icons-round animate-pulse">call</span><span className="text-sm font-bold">Wordt doorgegeven...</span></div>
              <div className="flex gap-2">
                <button onClick={() => setShowOrderSummary(true)} className="flex-1 bg-gray-100 text-gray-600 py-2.5 rounded-xl font-bold text-sm">Overzicht</button>
                <button onClick={() => setShowTimeInput(true)} className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-bold text-sm">Besteld</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="px-4 pt-3 pb-1 bg-gray-50 dark:bg-[#0f172a] sticky top-[72px] z-40 transition-colors">
        <div className="relative">
          <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
          <input type="text" placeholder="Zoek in menu..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white dark:bg-[#1e2330] border border-gray-200 dark:border-gray-700 text-sm focus:ring-2 focus:ring-blue-500/30 dark:text-white" />
        </div>
      </div>

      {!searchQuery && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-[#0f172a] sticky top-[125px] z-40 overflow-x-auto scrollbar-hide transition-colors">
          <div className="flex gap-2">
            {FRITUUR_UI_CATEGORIES.map((cat) => (
              <button key={cat} onClick={() => setActiveCategory(cat as any)} className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap border capitalize ${activeCategory === cat ? 'bg-blue-600/10 text-blue-600 border-blue-600/20' : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'}`}>
                {cat === 'favorieten' && <span className="material-icons-round text-xs">star</span>} {cat}
              </button>
            ))}
          </div>
        </div>
      )}

      <main className="flex-1 overflow-y-auto px-4 pb-36 pt-2">
        {sessionStatus === FRITUUR_STATUS.ORDERED && pickupTime && (
          <div className="mb-6 rounded-xl p-5 bg-gradient-to-r from-green-600 to-green-500 text-white animate-in slide-in-from-top-4">
            <h3 className="font-bold text-xl mb-1">🍟 Besteld!</h3>
            <p className="text-green-50 text-sm mb-3">Ophalen om: <span className="font-black text-white">{pickupTime}</span></p>
          </div>
        )}

        {isOrderingOpen && !orderingFor && (
          <button onClick={() => setIsSearchingUser(true)} className="w-full mb-6 bg-white dark:bg-[#1e2330] border border-dashed border-gray-300 dark:border-gray-700 rounded-xl p-3 flex items-center justify-center gap-2 text-gray-500 transition-colors">
            <span className="material-icons-round text-sm">person_add</span><span className="text-sm font-medium">Bestel voor vriend(in)</span>
          </button>
        )}

        {isAdmin && !orderingFor && (
            <button 
                onClick={() => setShowAddForm(!showAddForm)}
                className="w-full mb-6 bg-white dark:bg-[#1e2330] border border-dashed border-blue-300 dark:border-blue-900 rounded-xl p-3 flex items-center justify-center gap-2 text-blue-500 transition-colors"
            >
                <span className="material-icons-round text-sm">{showAddForm ? 'close' : 'add'}</span>
                <span className="text-sm font-medium">{showAddForm ? 'Sluiten' : 'Nieuw Item Toevoegen'}</span>
            </button>
        )}

        {showAddForm && isAdmin && (
            <div className="bg-white dark:bg-gray-800 p-4 rounded-xl border border-blue-100 dark:border-blue-900 mb-6 space-y-3 animate-in fade-in transition-colors">
                <input type="text" placeholder="Naam" value={newItemName} onChange={e => setNewItemName(e.target.value)} className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded dark:text-white" />
                <input type="number" step="0.01" placeholder="Prijs" value={newItemPrice} onChange={e => setNewItemPrice(e.target.value)} className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded dark:text-white" />
                <select value={newItemCategory} onChange={e => setNewItemCategory(e.target.value as any)} className="w-full p-2 text-sm bg-gray-50 dark:bg-gray-900 border dark:border-gray-700 rounded dark:text-white">
                    <option value="frieten">Frieten</option>
                    <option value="snacks">Snacks</option>
                    <option value="sauzen">Sauzen</option>
                    <option value="huisbereid">Huisbereid</option>
                    <option value="burgers">Burgers</option>
                    <option value="spaghetti">Spaghetti</option>
                </select>
                <button onClick={handleAddItem} className="w-full bg-blue-600 text-white font-bold py-2 rounded">Toevoegen</button>
            </div>
        )}

        <div className="space-y-4 mb-8">
          {loading ? (
            <div className="grid grid-cols-1 gap-4">{Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)}</div>
          ) : (
            <>
              {(searchQuery
                ? FRITUUR_DB_CATEGORIES
                  .filter(cat => items.some(i => i.category === cat && i.name.toLowerCase().includes(searchQuery.toLowerCase())))
                  .flatMap(cat => [
                    ...items.filter(i => i.category === cat && i.name.toLowerCase().includes(searchQuery.toLowerCase()))
                      .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
                      .map(item => ({ item, id: item.id }))
                  ])
                : (activeCategory === 'favorieten'
                  ? items.filter(i => favoriteItems.includes(i.id))
                  : items.filter(i => i.category === activeCategory)
                )
                  .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
                  .map(item => ({ item, id: item.id }))
              ).map((entry) => (
                  <FriesItemCard 
                    key={entry.id} 
                    item={entry.item} 
                    qty={getItemQty(entry.id)} 
                    isEditing={editingId === entry.id} 
                    editPrice={editPrice} 
                    setEditPrice={setEditPrice} 
                    savePrice={savePrice} 
                    cancelEdit={cancelEdit} 
                    isAdmin={isAdmin} 
                    orderingFor={orderingFor} 
                    isOrderingOpen={isOrderingOpen} 
                    favoriteItems={favoriteItems} 
                    toggleFavoriteItem={toggleFavoriteItem} 
                    startEditing={startEditing} 
                    handleDeleteFryItem={handleDeleteFryItem} 
                    updateQuantity={updateQuantity} 
                  />
                ))}
            </>
          )}
        </div>

        {todayOrders.length > 0 && !orderingFor && (
          <section className="mb-8 animate-in slide-in-from-bottom-2 fade-in duration-300">
            <div className="flex items-center gap-2 mb-3">
              <span className="material-icons-round text-blue-600 dark:text-blue-500">shopping_bag</span>
              <h2 className="text-sm font-bold text-gray-900 dark:text-white uppercase tracking-wider">Huidige Bestelling</h2>
            </div>
            
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

                  {isOrderingOpen && (
                    <button
                      onClick={() => handleDeleteClick(order.id)}
                      className={`w-full py-3 rounded-lg font-bold text-sm transition-all flex items-center justify-center gap-2 ${deleteConfirmId === order.id
                        ? 'bg-red-600 text-white shadow-lg shadow-red-500/30 hover:bg-red-700'
                        : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 dark:hover:text-red-400'
                        }`}
                    >
                      {deleteConfirmId === order.id ? (
                        <><span className="material-icons-round">warning</span><span>Ben je zeker?</span></>
                      ) : (
                        <><span className="material-icons-round">delete_outline</span><span>Verwijderen</span></>
                      )}
                    </button>
                  )}
                </div>
              ))}
          </section>
        )}
      </main>

      {cart.length > 0 && !isAdmin && isOrderingOpen && (
        <footer className="fixed bottom-24 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 transition-all">
          <div className={`p-4 rounded-2xl shadow-2xl transition-colors border ${orderingFor ? 'bg-orange-50 dark:bg-orange-950 border-orange-200 dark:border-orange-800' : 'bg-white dark:bg-[#1e2330] border-gray-200 dark:border-gray-800'}`}>
            <div className="flex justify-between items-end mb-3">
              <div>
                <span className={`text-xs font-bold uppercase ${orderingFor ? 'text-orange-600' : 'text-gray-400'}`}>
                  Totaal {orderingFor ? `voor ${orderingFor.naam}` : ''}
                </span>
                <div className="text-2xl font-bold text-blue-600">€ {total.toFixed(2)}</div>
              </div>
            </div>
            <button onClick={handlePlaceOrder} disabled={orderPlaced} className={`w-full font-bold py-3.5 rounded-xl shadow-lg flex items-center justify-center gap-2 active:scale-95 transition-all ${orderingFor ? 'bg-orange-600 text-white' : 'bg-blue-600 text-white'}`}>
              {orderPlaced ? <span className="material-icons-round animate-spin">refresh</span> : <span>BESTELLING BEVESTIGEN</span>}
            </button>
          </div>
        </footer>
      )}
    </div>
  );
};