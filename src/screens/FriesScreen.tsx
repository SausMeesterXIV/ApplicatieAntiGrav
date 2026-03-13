import React, { useState, useMemo, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { 
  Plus, Minus, ShoppingCart, Clock, Check, ChevronRight, 
  Trash2, Search, Info, History, ArrowRight, X, User as UserIcon
} from 'lucide-react';
import { AppContextType } from '../App';
import { FryItem, User } from '../types';
import { showToast } from '../components/Toast';
import { BottomSheet } from '../components/BottomSheet';
import { NavCard } from '../components/NavCard';
import { useFries } from '../contexts/FriesContext';
import * as db from '../lib/supabaseService';

export function FriesScreen() {
  const navigate = useNavigate();
  const { openSession } = useFries();
  const { 
    currentUser, users, fryItems, friesOrders, friesSessionStatus, 
    friesPickupTime, setFriesPickupTime, handlePlaceFryOrder, 
    handleRemoveFryOrder, frituurSessieId 
  } = useOutletContext<AppContextType>();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Alle');
  const [cart, setCart] = useState<{item: FryItem, quantity: number}[]>([]);
  const [orderSummaryOpen, setOrderSummaryOpen] = useState(false);
  const [timePickerOpen, setTimePickerOpen] = useState(false);
  
  // Admin feature: Order for someone else
  const [isOrderingForOther, setIsOrderingForOther] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [userSearchQuery, setUserSearchQuery] = useState('');

  const categories = useMemo(() => {
    const cats = ['Alle', ...Array.from(new Set(fryItems.map(i => i.category)))];
    return cats;
  }, [fryItems]);

  const filteredItems = useMemo(() => {
    return fryItems.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesCategory = selectedCategory === 'Alle' || item.category === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [fryItems, searchQuery, selectedCategory]);

  const filteredUsers = useMemo(() => {
    if (!userSearchQuery) return [];
    return users.filter(u => 
      u.naam.toLowerCase().includes(userSearchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userSearchQuery.toLowerCase())
    ).slice(0, 5);
  }, [users, userSearchQuery]);

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

  const isAdmin = currentUser.rol === 'admin' || (currentUser.roles || []).includes('Hoofdleiding');

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-24">
      {/* Header */}
      <div className="bg-white dark:bg-slate-800 pt-12 pb-6 px-6 shadow-sm sticky top-0 z-10">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Frituur 🍟</h1>
            <p className="text-slate-500 dark:text-slate-400 text-sm">Bestel je wekelijkse portie vet!</p>
          </div>
          <div className="flex gap-2">
            <button 
              onClick={() => navigate('/frituur/geschiedenis')}
              className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300"
            >
              <History size={20} />
            </button>
            {isAdmin && (
              <button 
                onClick={() => setTimePickerOpen(true)}
                className="p-2 bg-slate-100 dark:bg-slate-700 rounded-full text-slate-600 dark:text-slate-300"
              >
                <Clock size={20} />
              </button>
            )}
          </div>
        </div>

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
                  onClick={openSession}
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
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-full whitespace-nowrap text-sm font-medium transition-colors ${
                selectedCategory === cat 
                ? 'bg-blue-600 text-white' 
                : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-700'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Items Grid */}
        <div className="grid grid-cols-1 gap-4">
          {filteredItems.map(item => {
            const inCart = cart.find(i => i.item.id === item.id);
            return (
              <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm flex items-center gap-4">
                <div className="w-16 h-16 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center text-3xl">
                  {item.category === 'sauzen' ? '🥫' : 
                   item.category === 'dranken' ? '🥤' :
                   item.category === 'frieten' ? '🍟' : '🍖'}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-white leading-tight mb-1">{item.name}</h3>
                  <div className="flex items-center gap-2">
                    <span className="text-blue-600 dark:text-blue-400 font-bold">€{item.price.toFixed(2)}</span>
                    <span className="text-slate-400 text-xs px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700">{item.category}</span>
                  </div>
                </div>
                
                {friesSessionStatus === 'open' && (
                  <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-2xl p-1">
                    {inCart ? (
                      <>
                        <button 
                          onClick={() => updateQuantity(item, -1)}
                          className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-red-500"
                        >
                          <Minus size={18} />
                        </button>
                        <span className="w-8 text-center font-bold text-slate-900 dark:text-white">{inCart.quantity}</span>
                        <button 
                          onClick={() => updateQuantity(item, 1)}
                          className="w-10 h-10 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-blue-500"
                        >
                          <Plus size={18} />
                        </button>
                      </>
                    ) : (
                      <button 
                        onClick={() => updateQuantity(item, 1)}
                        className="w-10 h-10 bg-white dark:bg-slate-600 rounded-xl shadow-sm flex items-center justify-center text-blue-600 dark:text-blue-400 active:scale-95 transition-transform"
                      >
                        <Plus size={20} />
                      </button>
                    )}
                  </div>
                )}
              </div>
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
                <p className="text-xs text-slate-400">Totaal: €{myOrder.totalPrice.toFixed(2)}</p>
              </div>
            </div>
            <button 
              onClick={() => handleRemoveFryOrder(myOrder.id)}
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
        <div className="Space-y-6">
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
                        <img src={selectedUser.avatar} className="w-8 h-8 rounded-full" alt="" />
                        <span className="font-bold text-sm text-slate-900 dark:text-white">{selectedUser.naam}</span>
                      </div>
                      <button onClick={() => setSelectedUser(null)} className="text-slate-400"><X size={16} /></button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {filteredUsers.map(u => (
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