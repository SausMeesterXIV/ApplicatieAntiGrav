import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
  Plus, Minus, ShoppingCart, Clock, Check, ChevronRight, 
  Trash2, Search, Info, History, ArrowRight, X, User as UserIcon
} from 'lucide-react';
import { AppContextType } from '../App';
import { FryItem, User } from '../types';
import { showToast } from '../components/Toast';
import { BottomSheet } from '../components/Modal';
import { NavCard } from '../components/NavCard';
import { useFries } from '../contexts/FriesContext';
import { FriesItemCard } from '../components/Fries/FriesItemCard';
import * as db from '../lib/supabaseService';
import { hasRole } from '../lib/roleUtils';

export function FriesScreen() {
  const navigate = useNavigate();
  const { 
    currentUser, users, fryItems, friesOrders, friesSessionStatus, 
    friesPickupTime, handlePlaceFryOrder, 
    handleRemoveFryOrder, handleUpdateFryItem, handleDeleteFryItem, 
    frituurSessieId, setFriesSessionStatus, setFriesPickupTime
  } = useFries();

  // VEILIGHEID: Controleer of de huidige gebruiker Hoofdleiding (admin) is
  const isHoofdleiding = hasRole(currentUser, 'admin');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('frieten');
  const [cart, setCart] = useState<{item: FryItem, quantity: number}[]>([]);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  
  // Fries Management State
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState('');
  const [favoriteItems, setFavoriteItems] = useState<string[]>(() => {
    const saved = localStorage.getItem('ksa_favorite_fry_items');
    return saved ? JSON.parse(saved) : [];
  });

  // Admin feature: Order for someone else
  const [isOrderingForOther, setIsOrderingForOther] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  // VEILIGHEID: Editor Mode state
  const [isAdmin, setIsAdmin] = useState(false);
  const orderingFor = isOrderingForOther ? selectedUser : null;

  useEffect(() => {
    localStorage.setItem('ksa_favorite_fry_items', JSON.stringify(favoriteItems));
  }, [favoriteItems]);

  const getCategoryEmoji = (category: string) => {
    switch (category.toLowerCase()) {
      case 'frieten': return '🍟';
      case 'burgers': return '🍔';
      case 'snacks': return '🍢';
      case 'sauzen': return '🪣';
      case 'huisbereid': return '🧑‍🍳';
      case 'spaghetti': return '🍝';
      case 'dranken': return '🥤';
      default: return '';
    }
  };

  const categories = useMemo(() => {
    return ['favorieten', 'frieten', 'snacks', 'sauzen', 'huisbereid', 'burgers', 'spaghetti'];
  }, []);

  const filteredItems = useMemo(() => {
    if (searchQuery) {
      return fryItems.filter(item => 
        item.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).sort((a, b) => a.name.localeCompare(b.name));
    }
    
    const baseItems = selectedCategory === 'favorieten'
      ? fryItems.filter(i => favoriteItems.includes(i.id))
      : fryItems.filter(i => i.category === selectedCategory);

    return baseItems.sort((a, b) => {
      const aFav = favoriteItems.includes(a.id);
      const bFav = favoriteItems.includes(b.id);
      if (aFav && !bFav) return -1;
      if (!aFav && bFav) return 1;
      return (a.price - b.price) || a.name.localeCompare(b.name);
    });
  }, [fryItems, searchQuery, selectedCategory, favoriteItems]);

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return [];
    return users.filter((u: User) => 
      u.naam.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    ).slice(0, 5);
  }, [users, userSearchQuery]);

  const toggleFavoriteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteItems(prev => 
      prev.includes(id) ? prev.filter(fid => fid !== id) : [...prev, id]
    );
  };

  const startEditing = (item: FryItem) => {
    setEditingItemId(item.id);
    setEditPrice(item.price.toString());
  };

  const savePrice = async (id: string) => {
    const price = parseFloat(editPrice.replace(',', '.'));
    if (isNaN(price)) {
      showToast('Ongeldige prijs', 'error');
      return;
    }
    await handleUpdateFryItem(id, { price });
    setEditingItemId(null);
  };

  const cancelEdit = () => {
    setEditingItemId(null);
  };

  const updateQuantity = (item: FryItem, delta: number) => {
    setCart(prev => {
      const existing = prev.find(i => i.item.id === item.id);
      if (existing) {
        const newQuantity = existing.quantity + delta;
        if (newQuantity <= 0) {
          return prev.filter(i => i.item.id !== item.id);
        }
        return prev.map(i => i.item.id === item.id ? { ...i, quantity: newQuantity } : i);
      }
      if (delta > 0) {
        return [...prev, { item, quantity: 1 }];
      }
      return prev;
    });
  };

  const totalCost = cart.reduce((sum, entry) => sum + (entry.item.price * entry.quantity), 0);
  const cartItemCount = cart.reduce((sum, entry) => sum + entry.quantity, 0);

  const myOrder = useMemo(() => {
    return friesOrders.find(o => o.userId === currentUser.id && o.status === 'pending');
  }, [friesOrders, currentUser.id]);

  const handlePlaceOrder = () => {
    if (cart.length === 0) return;
    const targetUser = isOrderingForOther ? selectedUser : currentUser;
    if (!targetUser) return;

    handlePlaceFryOrder(
      cart.map(c => ({ id: c.item.id, name: c.item.name, quantity: c.quantity, price: c.item.price })),
      totalCost,
      targetUser as any
    );
    setCart([]);
    setOrderSummaryOpen(false);
    setIsOrderingForOther(false);
    setSelectedUser(null);
  };

  const isEditorMode = isAdmin;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 pt-12 pb-6 px-6 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Frituur 🍟</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Bestel je wekelijkse portie vet!</p>
          </div>
          <div className="flex items-center gap-2">
            {!orderingFor && isHoofdleiding && (
                <button 
                    onClick={() => setIsAdmin(!isAdmin)} 
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border font-bold text-xs transition-colors ${isAdmin ? 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50' : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700'}`}
                >
                    <span className="material-icons-round text-[16px]">{isAdmin ? 'close' : 'edit'}</span>
                    <span>{isAdmin ? 'Klaar' : 'Aanpassen'}</span>
                </button>
            )}
            
            <button onClick={() => navigate('/frituur/overzicht')} className="flex items-center gap-1.5 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 px-3 py-1.5 rounded-lg border border-gray-200 dark:border-gray-700 font-bold text-xs">
              <History size={16} />
              <span>Overzicht</span>
            </button>
          </div>
        </div>

        {/* DUIDELIJKE WAARSCHUWINGSBALK TIJDENS EDIT MODE */}
        {isAdmin && !orderingFor && (
            <div className="bg-red-500 text-white text-center text-xs font-bold py-1.5 flex items-center justify-center gap-2 shadow-inner">
                <span className="material-icons-round text-[14px]">warning</span>
                BEWERKMODUS ACTIEF: Je bewerkt nu het live menu!
            </div>
        )}

        {/* Status Banner */}
        {friesSessionStatus === 'closed' ? (
          <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 rounded-2xl mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600">
                <X size={20} />
              </div>
              <div className="flex-1">
                <p className="text-red-900 dark:text-red-400 font-semibold text-sm">Bestellingen gesloten</p>
                <p className="text-red-700/70 dark:text-red-400/60 text-xs">Er is momenteel geen actieve sessie.</p>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setFriesSessionStatus('open')}
                  className="px-4 py-2 bg-red-600 text-white text-xs font-bold rounded-xl shadow-lg active:scale-95 transition-transform"
                >
                  Openen
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-100 dark:border-green-900/30 rounded-2xl mb-4">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center text-green-600">
                <ShoppingCart size={20} />
              </div>
              <div className="flex-1">
                <p className="text-green-900 dark:text-green-400 font-semibold text-sm">Bestellingen zijn OPEN</p>
                <p className="text-green-700/70 dark:text-green-400/60 text-xs">
                  {friesPickupTime ? `Afhalen rond ${friesPickupTime}` : 'Wachten op afhaaltijd...'}
                </p>
              </div>
              <button 
                onClick={() => navigate('/frituur/overzicht')}
                className="flex items-center gap-1 text-green-600 font-bold text-xs"
              >
                Lijst <ArrowRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text"
            placeholder="Zoek een snack..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-100 dark:bg-slate-700 border-none rounded-2xl py-3 pl-12 pr-4 text-slate-900 dark:text-white placeholder:text-slate-400 focus:ring-2 focus:ring-blue-500 transition-all"
          />
        </div>
      </div>

      <div className="px-6 py-4">
        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar -mx-6 px-6">
          {categories.map(cat => {
            const isFavTab = cat === 'favorieten';
            const isActive = selectedCategory === cat;
            
            let tabClasses = 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700';
            if (isActive) {
                if (isFavTab) tabClasses = 'bg-red-50 text-red-600 border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800/50';
                else tabClasses = 'bg-blue-600 text-white shadow-md';
            }

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-all active:scale-95 flex items-center gap-2 border ${tabClasses}`}
              >
                {isFavTab ? (
                  <span className="material-icons-round text-[18px]">favorite</span>
                ) : (
                  <span>{getCategoryEmoji(cat)}</span>
                )}
                <span className="capitalize">{cat}</span>
              </button>
            );
          })}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 gap-4">
          {selectedCategory === 'favorieten' && filteredItems.length === 0 && !searchQuery && (
            <div className="text-center py-16 px-4 bg-white dark:bg-slate-800/50 rounded-3xl border border-dashed border-slate-200 dark:border-slate-700/50">
              <span className="material-icons-round text-5xl text-slate-200 dark:text-slate-700 mb-3">favorite_border</span>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">Nog geen favorieten</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 max-w-[250px] mx-auto">
                Tik op het hartje naast een item in het menu om deze hier te bewaren. 
              </p>
            </div>
          )}
          
          {filteredItems.map(item => {
            const inCart = cart.find(i => i.item.id === item.id);
            return (
              <FriesItemCard 
                key={item.id}
                item={item}
                qty={inCart ? inCart.quantity : 0}
                isEditing={editingItemId === item.id}
                editPrice={editPrice}
                setEditPrice={setEditPrice}
                savePrice={savePrice}
                cancelEdit={cancelEdit}
                isAdmin={isAdmin}
                orderingFor={isOrderingForOther ? selectedUser : null}
                isOrderingOpen={friesSessionStatus === 'open'}
                favoriteItems={favoriteItems}
                toggleFavoriteItem={toggleFavoriteItem}
                startEditing={startEditing}
                handleDeleteFryItem={handleDeleteFryItem}
                updateQuantity={updateQuantity}
              />
            );
          })}
        </div>

        {filteredItems.length === 0 && (
          <div className="text-center py-12">
            <div className="w-20 h-20 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <Search className="text-slate-400" size={32} />
            </div>
            <p className="text-slate-500 dark:text-slate-400">Niets gevonden voor "{searchQuery}"</p>
          </div>
        )}
      </div>

      {/* Cart Summary (Floating) */}
      {cart.length > 0 && (
        <div className="fixed bottom-24 left-6 right-6 z-20">
          <button 
            onClick={() => setOrderSummaryOpen(true)}
            className="w-full bg-blue-600 text-white p-4 rounded-3xl shadow-2xl flex items-center justify-between active:scale-[0.98] transition-all"
          >
            <div className="flex items-center gap-3">
              <div className="bg-white/20 w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm">
                {cartItemCount}
              </div>
              <span className="font-bold">Bekijk bestelling</span>
            </div>
            <span className="text-xl font-black">€{totalCost.toFixed(2)}</span>
          </button>
        </div>
      )}

      {/* Your current active order */}
      {myOrder && (
        <div className="fixed bottom-24 left-6 right-6 z-10">
          <div className="w-full bg-slate-900 text-white p-4 rounded-3xl shadow-xl border border-white/10 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500/20 rounded-2xl flex items-center justify-center text-xl">🍟</div>
              <div>
                <p className="font-bold text-sm">Jouw bestelling staat erin</p>
                <p className="text-xs text-slate-400">Totaal: €{myOrder?.totalPrice.toFixed(2)}</p>
              </div>
            </div>
            <button 
              onClick={() => handleRemoveFryOrder(myOrder!.id)}
              className="p-2 text-red-400 hover:bg-red-400/10 rounded-xl"
            >
              <Trash2 size={20} />
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Order Summary */}
      <BottomSheet 
        isOpen={orderSummaryOpen} 
        onClose={() => setOrderSummaryOpen(false)}
        title="Bestelling Bevestigen"
      >
        <div className="space-y-6">
          {/* Order Details */}
          <div className="bg-slate-50 dark:bg-slate-900/50 rounded-3xl p-6 border border-slate-100 dark:border-slate-800">
            <h4 className="font-bold text-sm text-slate-400 uppercase tracking-widest mb-4">Mijn Mandje</h4>
            <div className="space-y-4">
              {cart.map(entry => (
                <div key={entry.item.id} className="flex justify-between items-center text-slate-700 dark:text-slate-200">
                  <div className="flex items-center gap-3">
                    <span className="font-black text-blue-600">x{entry.quantity}</span>
                    <span className="font-bold">{entry.item.name}</span>
                  </div>
                  <span className="font-medium">€{(entry.item.price * entry.quantity).toFixed(2)}</span>
                </div>
              ))}
            </div>
            <div className="h-px bg-slate-200 dark:bg-slate-800 my-4" />
            <div className="flex justify-between items-center text-xl font-black text-slate-900 dark:text-white">
              <span>Totaal</span>
              <span>€{totalCost.toFixed(2)}</span>
            </div>
          </div>

          {/* Admin Toggle: Order for other */}
          {isAdmin && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-3xl p-5 border border-blue-100 dark:border-blue-900/30">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-blue-800 dark:text-blue-300 font-bold">
                  <UserIcon size={18} />
                  <span>Bestellen voor iemand anders?</span>
                </div>
                <button 
                  onClick={() => {
                    setIsOrderingForOther(!isOrderingForOther);
                    if (!isOrderingForOther) setSelectedUser(null);
                  }}
                  className={`w-12 h-6 rounded-full transition-colors relative ${isOrderingForOther ? 'bg-blue-600' : 'bg-slate-300 dark:bg-slate-700'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all ${isOrderingForOther ? 'left-7' : 'left-1'}`} />
                </button>
              </div>

              {isOrderingForOther && (
                <div className="mt-4 space-y-3">
                  <input 
                    type="text"
                    placeholder="Zoek een lid..."
                    value={userSearchQuery}
                    onChange={(e) => setUserSearchQuery(e.target.value)}
                    className="w-full bg-white dark:bg-slate-800 border-none rounded-2xl py-3 px-4 text-sm"
                  />
                  
                  {selectedUser ? (
                    <div className="flex items-center justify-between bg-white dark:bg-slate-800 p-3 rounded-2xl border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-3">
                        <img src={selectedUser.avatar_url || ''} className="w-8 h-8 rounded-full" alt="" />
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{selectedUser.naam}</span>
                      </div>
                      <button onClick={() => setSelectedUser(null)} className="text-slate-400"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map((u: User) => (
                        <button 
                          key={u.id}
                          onClick={() => {
                            setSelectedUser(u);
                            setUserSearchQuery('');
                          }}
                          className="w-full flex items-center gap-3 p-2 bg-white/50 dark:bg-slate-800/50 rounded-xl hover:bg-white dark:hover:bg-slate-800 transition-colors"
                        >
                          <img src={u.avatar} className="w-6 h-6 rounded-full border border-slate-200" alt="" />
                          <span className="text-sm font-medium dark:text-slate-300">{u.naam}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-4">
            <button 
              onClick={() => setOrderSummaryOpen(false)}
              className="flex-1 py-4 px-6 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-bold rounded-3xl"
            >
              Terug
            </button>
            <button 
              onClick={handlePlaceOrder}
              disabled={isOrderingForOther && !selectedUser}
              className={`flex-[2] py-4 px-6 bg-blue-600 text-white font-bold rounded-3xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all flex items-center justify-center gap-3 ${isOrderingForOther && !selectedUser ? 'opacity-50 grayscale cursor-not-allowed' : ''}`}
            >
              <Check size={20} />
              Bestelling Plaatsen
            </button>
          </div>
        </div>
      </BottomSheet>

      {/* MODAL: Pickup Time Picker */}
      <BottomSheet 
        isOpen={timePickerOpen} 
        onClose={() => setTimePickerOpen(false)}
        title="Afhaaltijd Instellen"
      >
        <div className="space-y-6">
          <p className="text-slate-500 dark:text-slate-400 text-sm">Wanneer gaan we de bestelling naar verwachting afhalen?</p>
          
          <div className="grid grid-cols-3 gap-3">
            {['19:00', '19:15', '19:30', '19:45', '20:00', '20:15', '20:30', '20:45', '21:00'].map(time => (
              <button
                key={time}
                onClick={() => {
                  setFriesPickupTime(time);
                  setTimePickerOpen(false);
                  db.updateFrituurSessie(frituurSessieId!, { pickup_time: time });
                  showToast(`Afhaaltijd gezet op ${time}`, 'success');
                }}
                className={`py-3 rounded-2xl font-bold transition-all ${
                  friesPickupTime === time 
                  ? 'bg-blue-600 text-white shadow-lg scale-105' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                }`}
              >
                {time}
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-4 flex items-center text-slate-400">
              <Clock size={18} />
            </div>
            <input 
              type="time" 
              className="w-full bg-slate-100 dark:bg-slate-800 border-none rounded-2xl py-4 pl-12 font-bold"
              onChange={(e) => {
                setFriesPickupTime(e.target.value);
                db.updateFrituurSessie(frituurSessieId!, { pickup_time: e.target.value });
                setTimePickerOpen(false);
              }}
            />
          </div>
        </div>
      </BottomSheet>
    </div>
  );
}