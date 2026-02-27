import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { FryItem, CartItem, Order, User } from '../types';
import { ChevronBack } from '../components/ChevronBack';
// Users from context
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
    setFriesPickupTime: onSetPickupTime,
    handleAddNotification: onAddNotification,
    currentUser,
    users
  } = useOutletContext<AppContextType>();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [favoriteCart, setFavoriteCart] = useState<CartItem[]>(() => {
    try {
      const saved = localStorage.getItem('ksa_favorite_fry_order');
      if (saved) return JSON.parse(saved);
    } catch { }
    return [];
  });
  const [favoriteItems, setFavoriteItems] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('ksa_favorite_fry_items');
      if (saved) return JSON.parse(saved);
    } catch { }
    return [];
  });
  const [activeCategory, setActiveCategory] = useState<'favorieten' | 'frieten' | 'snacks' | 'sauzen' | 'huisbereid' | 'burgers' | 'spaghetti'>('frieten');
  const [searchQuery, setSearchQuery] = useState('');
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

  // Order management state
  const [showReopenConfirm, setShowReopenConfirm] = useState(false);
  const [showOrderSummary, setShowOrderSummary] = useState(false);
  const [showTimeInput, setShowTimeInput] = useState(false);
  const [tempPickupTime, setTempPickupTime] = useState(() => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 30);
    return now.toTimeString().slice(0, 5);
  });

  const isOrderingOpen = sessionStatus === 'open';

  // Aggregated order items for summary
  const allActiveOrders = myOrders.filter(o => o.status === 'pending');
  const orderSummaryItems = (() => {
    const map = new Map<string, { name: string; count: number; price: number; category: string }>();
    allActiveOrders.forEach(order => {
      order.items.forEach(item => {
        const existing = map.get(item.id);
        if (existing) {
          existing.count += item.quantity;
          existing.price += item.price * item.quantity;
        } else {
          map.set(item.id, { name: item.name, count: item.quantity, price: item.price * item.quantity, category: item.category });
        }
      });
    });
    return Array.from(map.values());
  })();

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

  // Menu items from the local frituur
  const [items, setItems] = useState<FryItem[]>([
    // === FRIETEN ===
    { id: 'f1', name: 'Kinder', price: 2.30, category: 'frieten' },
    { id: 'f2', name: 'Klein', price: 2.80, category: 'frieten' },
    { id: 'f3', name: 'Middel', price: 3.20, category: 'frieten' },
    { id: 'f4', name: 'Groot', price: 3.70, category: 'frieten' },
    { id: 'f5', name: 'Extra (2~3 pers.)', price: 5.00, category: 'frieten' },
    { id: 'f6', name: 'Supertje Klein', price: 6.50, category: 'frieten' },
    { id: 'f7', name: 'Supertje Groot', price: 7.50, category: 'frieten' },
    { id: 'f8', name: 'Julientje', price: 8.70, category: 'frieten' },
    { id: 'f9', name: 'Romboutje', price: 9.00, category: 'frieten' },
    { id: 'f10', name: 'Smullbox', price: 7.50, category: 'frieten' },
    { id: 'f11', name: 'Aardappelkroket (7st)', price: 2.80, category: 'frieten' },
    { id: 'f12', name: 'Groot Romboutje', price: 9.80, category: 'frieten' },
    { id: 'f13', name: 'Groot Julientje', price: 9.50, category: 'frieten' },

    // === SAUZEN ===
    { id: 's1', name: 'Mayonnaise', price: 1.00, category: 'sauzen' },
    { id: 's2', name: 'Ketchup tomaat', price: 1.00, category: 'sauzen' },
    { id: 's3', name: 'Ketchup curry', price: 1.00, category: 'sauzen' },
    { id: 's4', name: 'Tartaar', price: 1.10, category: 'sauzen' },
    { id: 's5', name: 'Pickles', price: 1.00, category: 'sauzen' },
    { id: 's6', name: 'Americain', price: 1.00, category: 'sauzen' },
    { id: 's7', name: 'Samurai', price: 1.00, category: 'sauzen' },
    { id: 's8', name: 'Cocktail', price: 1.00, category: 'sauzen' },
    { id: 's9', name: 'Andalouse', price: 1.00, category: 'sauzen' },
    { id: 's10', name: 'Loempiasaus', price: 1.00, category: 'sauzen' },
    { id: 's11', name: 'Mammoetsaus', price: 1.00, category: 'sauzen' },
    { id: 's12', name: 'Bicky Saus', price: 1.00, category: 'sauzen' },
    { id: 's13', name: 'Joppiesaus', price: 1.10, category: 'sauzen' },
    { id: 's14', name: 'Zigeunersaus', price: 1.00, category: 'sauzen' },
    { id: 's15', name: 'Barbecuesaus', price: 1.00, category: 'sauzen' },
    { id: 's16', name: 'Pepersaus', price: 1.00, category: 'sauzen' },
    { id: 's17', name: 'Toscaanse saus', price: 1.00, category: 'sauzen' },
    { id: 's18', name: 'Gele currysaus', price: 1.00, category: 'sauzen' },
    { id: 's19', name: 'Zoete Frietsaus', price: 1.00, category: 'sauzen' },
    { id: 's20', name: 'Special saus (tomaat)', price: 2.00, category: 'sauzen' },
    { id: 's21', name: 'Special saus (curry)', price: 2.00, category: 'sauzen' },
    { id: 's22', name: 'Potje satekruiden', price: 0.50, category: 'sauzen' },

    // === HUISBEREID ===
    { id: 'h1', name: 'Stoofvlees', price: 6.50, category: 'huisbereid' },
    { id: 'h2', name: 'Stoofvleessaus', price: 2.00, category: 'huisbereid' },
    { id: 'h3', name: 'Balletjes in tomatensaus', price: 6.30, category: 'huisbereid' },
    { id: 'h4', name: 'Vol-au-vent', price: 6.30, category: 'huisbereid' },

    // === SNACKS ===
    { id: 'sn1', name: 'Frikandel', price: 2.20, category: 'snacks' },
    { id: 'sn2', name: 'Frikandel special', price: 3.20, category: 'snacks' },
    { id: 'sn3', name: 'Viandel', price: 2.80, category: 'snacks' },
    { id: 'sn4', name: 'Viandel special', price: 3.80, category: 'snacks' },
    { id: 'sn5', name: 'Boulet', price: 2.80, category: 'snacks' },
    { id: 'sn6', name: 'Boulet special', price: 3.70, category: 'snacks' },
    { id: 'sn7', name: 'Ardeense saté', price: 4.50, category: 'snacks' },
    { id: 'sn8', name: 'Bamischijf', price: 3.10, category: 'snacks' },
    { id: 'sn9', name: 'Bitterballen', price: 2.70, category: 'snacks' },
    { id: 'sn10', name: 'Borrelmaatjes', price: 5.90, category: 'snacks' },
    { id: 'sn11', name: 'Crizly', price: 4.50, category: 'snacks' },
    { id: 'sn12', name: 'Kaasballetjes', price: 3.10, category: 'snacks' },
    { id: 'sn13', name: 'Kipcorn', price: 3.20, category: 'snacks' },
    { id: 'sn14', name: 'Inktvis ring', price: 4.00, category: 'snacks' },
    { id: 'sn15', name: 'Frankfurter', price: 2.10, category: 'snacks' },
    { id: 'sn16', name: 'Garnaalkroket', price: 3.10, category: 'snacks' },
    { id: 'sn17', name: 'Gebakken Garnalen', price: 6.00, category: 'snacks' },
    { id: 'sn18', name: 'Ribster', price: 3.30, category: 'snacks' },
    { id: 'sn19', name: 'Kaaskroket', price: 2.10, category: 'snacks' },
    { id: 'sn20', name: 'Kippenboutjes hofkip', price: 4.60, category: 'snacks' },
    { id: 'sn21', name: 'Kipfingers', price: 4.30, category: 'snacks' },
    { id: 'sn22', name: 'Kip kaas donut', price: 2.90, category: 'snacks' },
    { id: 'sn23', name: 'Kaaskipcorn', price: 3.30, category: 'snacks' },
    { id: 'sn24', name: 'Kip kaas punt', price: 3.30, category: 'snacks' },
    { id: 'sn25', name: 'Kippets (6st)', price: 4.30, category: 'snacks' },
    { id: 'sn26', name: 'Perlut', price: 4.50, category: 'snacks' },
    { id: 'sn27', name: 'Loempia + saus', price: 4.90, category: 'snacks' },
    { id: 'sn28', name: 'Lookworst rood', price: 3.20, category: 'snacks' },
    { id: 'sn29', name: 'Lookworst rood special', price: 4.20, category: 'snacks' },
    { id: 'sn30', name: 'Lookworst bruin', price: 4.00, category: 'snacks' },
    { id: 'sn31', name: 'Lookworst bruin special', price: 5.00, category: 'snacks' },
    { id: 'sn32', name: 'Lucifer', price: 3.50, category: 'snacks' },
    { id: 'sn33', name: 'Mammoet zonder saus', price: 2.80, category: 'snacks' },
    { id: 'sn34', name: 'Mammoet + saus', price: 3.50, category: 'snacks' },
    { id: 'sn35', name: 'Mexicano', price: 3.30, category: 'snacks' },
    { id: 'sn36', name: 'Mini Bamiballetjes', price: 2.60, category: 'snacks' },
    { id: 'sn37', name: 'Mini Kipsaté', price: 3.00, category: 'snacks' },
    { id: 'sn38', name: 'Mini Loempias (8st)', price: 4.30, category: 'snacks' },
    { id: 'sn39', name: 'Mini kaassouflesse', price: 4.00, category: 'snacks' },
    { id: 'sn40', name: "Chick 'n Chili", price: 3.30, category: 'snacks' },
    { id: 'sn41', name: 'Chicken tenders', price: 3.90, category: 'snacks' },
    { id: 'sn42', name: 'Mozzarella fingers (5st)', price: 3.80, category: 'snacks' },
    { id: 'sn43', name: 'Saté klein', price: 3.90, category: 'snacks' },
    { id: 'sn44', name: 'Saté groot', price: 5.00, category: 'snacks' },
    { id: 'sn45', name: 'Ragouzi', price: 3.30, category: 'snacks' },
    { id: 'sn46', name: 'Sito', price: 4.10, category: 'snacks' },
    { id: 'sn47', name: 'Taco', price: 4.20, category: 'snacks' },
    { id: 'sn48', name: 'Twijfelaar', price: 4.30, category: 'snacks' },
    { id: 'sn49', name: 'Visstick', price: 4.10, category: 'snacks' },
    { id: 'sn50', name: 'Vleeskroket', price: 2.80, category: 'snacks' },
    { id: 'sn51', name: 'Zigeunerstick', price: 3.40, category: 'snacks' },
    { id: 'sn52', name: 'Kipsaté', price: 4.20, category: 'snacks' },
    { id: 'sn53', name: 'Spicy viandel', price: 2.90, category: 'snacks' },
    { id: 'sn54', name: 'Kippenballetjes (6st)', price: 5.80, category: 'snacks' },
    { id: 'sn55', name: 'Belcrunch', price: 3.60, category: 'snacks' },
    { id: 'sn56', name: 'Vuurvreter', price: 3.30, category: 'snacks' },
    { id: 'sn57', name: 'Mini megamix', price: 5.00, category: 'snacks' },
    { id: 'sn58', name: 'Mini lucifer', price: 4.40, category: 'snacks' },
    { id: 'sn59', name: 'Kaassouflesse', price: 3.00, category: 'snacks' },
    { id: 'sn60', name: 'K3 kaashartjes (3st)', price: 4.50, category: 'snacks' },
    { id: 'sn61', name: 'Mammoet special', price: 3.80, category: 'snacks' },
    { id: 'sn62', name: 'Goulashkroket', price: 3.10, category: 'snacks' },
    { id: 'sn63', name: 'Boulet ajuin', price: 3.70, category: 'snacks' },
    { id: 'sn64', name: 'Loempidel', price: 3.50, category: 'snacks' },
    { id: 'sn65', name: 'Topmix', price: 6.80, category: 'snacks' },

    // === BURGERS ===
    { id: 'b1', name: 'Bicky burger', price: 3.90, category: 'burgers' },
    { id: 'b2', name: 'Bicky cheese', price: 4.30, category: 'burgers' },
    { id: 'b3', name: 'Bicky Fish', price: 4.70, category: 'burgers', description: 'Met tartaar saus en verse ajuin' },
    { id: 'b4', name: 'Bicky Crunchy Chicken', price: 4.30, category: 'burgers' },
    { id: 'b5', name: "Bicky v/h Huis", price: 4.50, category: 'burgers', description: 'Met toscaanse saus en verse ajuin' },
    { id: 'b6', name: 'Bicky Rib', price: 4.90, category: 'burgers', description: 'Met andalouse saus' },
    { id: 'b7', name: 'Bicky vegi', price: 4.30, category: 'burgers' },
    { id: 'b8', name: 'Bicky mexicano', price: 4.80, category: 'burgers' },
    { id: 'b9', name: 'Bicky Royale', price: 6.60, category: 'burgers' },
    { id: 'b10', name: 'Hamburger natuur', price: 3.50, category: 'burgers', description: 'Enkel vlees en broodje' },
    { id: 'b11', name: 'Hamburger tomatenketchup', price: 3.70, category: 'burgers' },
    { id: 'b12', name: 'Hamburger curry ketchup', price: 3.70, category: 'burgers' },

    // === SPAGHETTI ===
    { id: 'sp1', name: 'Spaghetti Kinder', price: 8.20, category: 'spaghetti' },
    { id: 'sp2', name: 'Spaghetti Klein', price: 9.20, category: 'spaghetti' },
    { id: 'sp3', name: 'Spaghetti Groot', price: 10.00, category: 'spaghetti' },
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

  const handleSaveFavorite = () => {
    if (cart.length > 0) {
      localStorage.setItem('ksa_favorite_fry_order', JSON.stringify(cart));
      setFavoriteCart(cart);
      alert('Huidige bestelling opgeslagen als favoriete maaltijd! ⭐️');
    }
  };

  const handleLoadFavorite = () => {
    if (favoriteCart.length > 0) {
      setCart(favoriteCart);
    }
  };

  const toggleFavoriteItem = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavoriteItems(prev => {
      const isFav = prev.includes(id);
      const newFavs = isFav ? prev.filter(i => i !== id) : [...prev, id];
      localStorage.setItem('ksa_favorite_fry_items', JSON.stringify(newFavs));
      return newFavs;
    });
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
        alert(`Bestelling geplaatst voor ${orderingFor.naam}`);
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

  // --- Admin Add New Item Logic ---
  const [showAddForm, setShowAddForm] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemPrice, setNewItemPrice] = useState('');
  const [newItemCategory, setNewItemCategory] = useState<FryItem['category']>('snacks');

  const handleAddItem = () => {
    const price = parseFloat(newItemPrice.replace(',', '.'));
    if (!newItemName.trim() || isNaN(price)) return;
    const newItem: FryItem = {
      id: `custom-${Date.now()}`,
      name: newItemName.trim(),
      price,
      category: newItemCategory,
    };
    setItems(prev => [...prev, newItem]);
    setNewItemName('');
    setNewItemPrice('');
    setNewItemCategory('snacks');
    setShowAddForm(false);
  };

  // --- User Search Logic ---
  const filteredUsers = users.filter(u =>
    (u.naam || '').toLowerCase().includes(userSearchQuery.toLowerCase()) &&
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
              <img src={user.avatar} alt={user.naam} className="w-10 h-10 rounded-full object-cover" />
              <div>
                <p className="font-bold text-gray-900 dark:text-white">{user.naam}</p>
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
                  <span className="text-xs font-bold uppercase">Voor: {orderingFor.naam}</span>
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
              Bestelling voor <span className="font-bold text-gray-900 dark:text-white">{currentUser.naam}</span>
            </div>
            {isAdmin && (
              <span className="text-[10px] font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded border border-blue-200 animate-pulse">
                BEWERK MODUS
              </span>
            )}
          </div>
        )}
      </header>

      {/* Admin Order Management Bar */}
      {!orderingFor && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-[#0f172a] border-b border-gray-100 dark:border-gray-800 transition-colors">
          {sessionStatus === 'closed' && (
            <button onClick={() => onSessionChange('open')} className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-500/20 transition-all">
              <span className="material-icons-round text-lg">play_arrow</span>
              Bestelling Openen
            </button>
          )}
          {sessionStatus === 'open' && (
            <button onClick={() => onSessionChange('completed')} className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-red-500/20 transition-all">
              <span className="material-icons-round text-lg">block</span>
              Opnemen Stoppen
            </button>
          )}
          {sessionStatus === 'completed' && (
            <div className="space-y-2">
              <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                <span className="material-icons-round">lock</span>
                <span className="text-sm font-bold">Bestelling gesloten — niemand kan nog bestellen</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    if (showReopenConfirm) { onSessionChange('open'); setShowReopenConfirm(false); }
                    else setShowReopenConfirm(true);
                  }}
                  className={`flex-1 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition-all ${showReopenConfirm ? 'bg-red-100 dark:bg-red-900/20 text-red-600 border border-red-300 dark:border-red-700' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'}`}
                >
                  <span className="material-icons-round text-base">{showReopenConfirm ? 'warning' : 'lock_open'}</span>
                  {showReopenConfirm ? 'Zeker heropenen?' : 'Heropenen'}
                </button>
                <button
                  onClick={() => { onSessionChange('ordering'); setShowOrderSummary(true); }}
                  className="flex-1 bg-orange-600 hover:bg-orange-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-orange-500/20 transition-all"
                >
                  <span>Bestellen 🔔</span>
                </button>
              </div>
            </div>
          )}
          {sessionStatus === 'ordering' && (
            <div className="space-y-2">
              <div className="bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-800 rounded-xl p-3 flex items-center gap-2 text-orange-700 dark:text-orange-400">
                <span className="material-icons-round animate-pulse">call</span>
                <span className="text-sm font-bold">Bestelling wordt doorgegeven...</span>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowOrderSummary(true)} className="flex-1 bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5">
                  <span className="material-icons-round text-base">receipt_long</span>
                  Overzicht
                </button>
                <button onClick={() => setShowTimeInput(true)} className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2.5 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 shadow-lg shadow-green-500/20 transition-all">
                  <span className="material-icons-round text-base">check_circle</span>
                  Besteld
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Order Summary Modal */}
      {showOrderSummary && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowOrderSummary(false)} />
          <div className="relative bg-white dark:bg-[#1e293b] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
            <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">📋 Bestelling Overzicht</h2>
                <p className="text-xs text-gray-400 mt-0.5">{allActiveOrders.length} bestellingen — {orderSummaryItems.reduce((a, i) => a + i.count, 0)} items</p>
              </div>
              <button onClick={() => setShowOrderSummary(false)} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                <span className="material-icons-round text-gray-500 text-xl">close</span>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-5 space-y-2">
              {orderSummaryItems.length === 0 ? (
                <p className="text-center text-gray-400 py-8">Geen bestellingen</p>
              ) : (
                orderSummaryItems.map(item => (
                  <div key={item.name} className="flex items-center justify-between bg-gray-50 dark:bg-gray-800 rounded-xl p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 flex items-center justify-center">
                        <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">{item.count}x</span>
                      </div>
                      <span className="font-bold text-gray-900 dark:text-white text-sm">{item.name}</span>
                    </div>
                    <span className="text-gray-500 text-sm font-medium">€ {item.price.toFixed(2).replace('.', ',')}</span>
                  </div>
                ))
              )}
            </div>
            <div className="p-5 border-t border-gray-100 dark:border-gray-700">
              <div className="flex justify-between items-center mb-3">
                <span className="font-bold text-gray-500 text-sm">Totaal</span>
                <span className="font-bold text-xl text-gray-900 dark:text-white">€ {orderSummaryItems.reduce((a, i) => a + i.price, 0).toFixed(2).replace('.', ',')}</span>
              </div>
              <button onClick={() => setShowOrderSummary(false)} className="w-full bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-bold py-3 rounded-xl text-sm">Sluiten</button>
            </div>
          </div>
        </div>
      )}

      {/* Time Input Modal */}
      {showTimeInput && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowTimeInput(false)} />
          <div className="relative bg-white dark:bg-[#1e293b] w-full max-w-xs rounded-2xl shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <span className="material-icons-round text-green-600 text-2xl">schedule</span>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Hoe laat afhalen?</h3>
            </div>
            <input
              type="time"
              value={tempPickupTime}
              onChange={e => setTempPickupTime(e.target.value)}
              className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-2xl font-bold rounded-xl p-4 text-center mb-4 focus:ring-2 focus:ring-green-500 outline-none"
            />
            <button
              onClick={() => {
                onSetPickupTime(tempPickupTime);
                onSessionChange('ordered');
                onAddNotification({
                  type: 'order',
                  sender: 'Friet Verantwoordelijke',
                  role: 'ADMIN',
                  title: 'Frieten Besteld! 🍟',
                  content: `De bestelling is doorgegeven. Jullie mogen de frieten gaan afhalen om ${tempPickupTime}.`,
                  time: 'Zonet',
                  isRead: false,
                  action: '',
                  icon: 'fastfood',
                  color: 'bg-yellow-100 dark:bg-yellow-600/20 text-yellow-600 dark:text-yellow-500'
                });
                setShowTimeInput(false);
                setShowOrderSummary(false);
              }}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-500/20 transition-all"
            >
              <span className="material-icons-round">check</span>
              Bevestigen & Iedereen Verwittigen
            </button>
            <button onClick={() => setShowTimeInput(false)} className="w-full mt-2 text-sm text-gray-400 hover:text-gray-600 py-2">Annuleren</button>
          </div>
        </div>
      )}

      {/* Search Bar */}
      <div className="px-4 pt-3 pb-1 bg-gray-50 dark:bg-[#0f172a] sticky top-[85px] z-40 transition-colors">
        <div className="relative">
          <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">search</span>
          <input
            type="text"
            placeholder="Zoek in heel het menu..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 rounded-xl bg-white dark:bg-[#1e2330] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-0.5 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              <span className="material-icons-round text-gray-400 text-lg">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs - hidden when searching */}
      {!searchQuery && (
        <div className="px-4 py-2 bg-gray-50 dark:bg-[#0f172a] sticky top-[140px] z-40 overflow-x-auto no-scrollbar transition-colors">
          <div className="flex gap-2">
            {['favorieten', 'frieten', 'snacks', 'sauzen', 'huisbereid', 'burgers', 'spaghetti'].map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat as any)}
                className={`px-4 py-1.5 rounded-full flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap border capitalize transition-all ${activeCategory === cat
                  ? 'bg-blue-600/10 text-blue-600 border-blue-600/20 dark:text-blue-400 dark:border-blue-400/30'
                  : 'bg-white dark:bg-[#1e2330] text-gray-600 dark:text-gray-400 border-gray-200 dark:border-gray-700'
                  }`}
              >
                {cat === 'favorieten' && <span className="material-icons-round text-[15px]">star</span>}
                {cat}
              </button>
            ))}
          </div>
        </div>
      )}

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

        {/* Favorite Order Quick Action */}
        {isOrderingOpen && favoriteCart.length > 0 && cart.length === 0 && (
          <button
            onClick={handleLoadFavorite}
            className="w-full mb-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl p-3 flex items-center justify-center gap-2 text-yellow-700 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors shadow-sm"
          >
            <span className="material-icons-round text-sm">star</span>
            <span className="text-sm font-bold">Favoriete bestelling inladen</span>
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
          {/* Search results info */}
          {searchQuery && (() => {
            const results = items.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
            return (
              <div className="flex items-center gap-2 mb-2">
                <span className="material-icons-round text-gray-400 text-sm">filter_list</span>
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {results.length} {results.length === 1 ? 'resultaat' : 'resultaten'} voor "{searchQuery}"
                </span>
              </div>
            );
          })()}

          {/* Favoriete Maaltijd Box */}
          {!searchQuery && activeCategory === 'favorieten' && favoriteCart.length > 0 && (
            <div className="bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800 rounded-xl p-4 shadow-sm mb-6 pb-5">
              <div className="flex items-center gap-3 mb-3">
                <span className="material-icons-round text-yellow-500">star</span>
                <h3 className="font-bold text-yellow-800 dark:text-yellow-400">Jouw Favoriete Maaltijd</h3>
              </div>
              <div className="space-y-2 mb-4">
                {favoriteCart.map(i => (
                  <div key={i.id} className="flex justify-between text-sm py-1 border-b border-yellow-200/50 dark:border-yellow-800/50 last:border-0">
                    <span className="text-gray-700 dark:text-gray-300"><span className="font-bold">{i.quantity}x</span> {i.name}</span>
                    <span className="text-gray-500">€ {(i.price * i.quantity).toFixed(2)}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={handleLoadFavorite}
                className="w-full bg-yellow-400 hover:bg-yellow-500 text-yellow-900 font-bold py-2.5 rounded-xl flex items-center justify-center gap-2 transition-colors shadow-sm"
              >
                <span className="material-icons-round text-sm">shopping_cart_checkout</span>
                Alles Toevoegen aan Bestelling
              </button>
            </div>
          )}

          {!searchQuery && activeCategory === 'favorieten' && items.filter(i => favoriteItems.includes(i.id)).length === 0 && favoriteCart.length === 0 && (
            <div className="text-center text-gray-400 dark:text-gray-500 py-12">
              <span className="material-icons-round text-4xl mb-3 opacity-50">star_border</span>
              <p className="font-bold text-gray-600 dark:text-gray-300">Je hebt nog geen favorieten.</p>
              <p className="text-xs pt-2">Klik op het sterretje naast een snack of <br />bewaar je hele winkelkar via de knop onderaan!</p>
            </div>
          )}

          {/* Category headers in search mode & item rendering */}
          {(searchQuery
            ? (['frieten', 'snacks', 'sauzen', 'huisbereid', 'burgers', 'spaghetti'] as const)
              .filter(cat => items.some(i => i.category === cat && i.name.toLowerCase().includes(searchQuery.toLowerCase())))
              .flatMap(cat => [
                { type: 'header' as const, category: cat, id: `header-${cat}` },
                ...items.filter(i => i.category === cat && i.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
                  .map(item => ({ type: 'item' as const, item, id: item.id }))
              ])
            : (activeCategory === 'favorieten'
              ? items.filter(i => favoriteItems.includes(i.id))
              : items.filter(i => i.category === activeCategory)
            )
              .sort((a, b) => a.price - b.price || a.name.localeCompare(b.name))
              .map(item => ({ type: 'item' as const, item, id: item.id }))
          ).map((entry) => {
            if (entry.type === 'header') {
              return (
                <div key={entry.id} className="pt-2 pb-1">
                  <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-1 rounded-full capitalize">
                    {entry.category}
                  </span>
                </div>
              );
            }
            const item = entry.item!;
            const qty = getItemQty(item.id);
            const isEditing = editingId === item.id;

            return (
              <div key={item.id} className={`bg-white dark:bg-[#1e2330] rounded-xl p-4 shadow-sm border transition-all ${qty > 0 ? 'border-blue-600 ring-1 ring-blue-600 dark:border-blue-500 dark:ring-blue-500' : 'border-gray-100 dark:border-gray-800'} ${!isOrderingOpen ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className={`font-semibold text-lg ${qty > 0 ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-white'}`}>{item.name}</h3>
                      <button
                        onClick={(e) => toggleFavoriteItem(item.id, e)}
                        className="p-1 -ml-1 flex items-center justify-center rounded-full hover:bg-yellow-50 dark:hover:bg-yellow-900/20 transition-colors"
                        title="Favoriet maken"
                      >
                        <span className={`material-icons-round text-base transition-colors ${favoriteItems.includes(item.id) ? 'text-yellow-400' : 'text-gray-300 dark:text-gray-600 hover:text-yellow-300'}`}>
                          {favoriteItems.includes(item.id) ? 'star' : 'star_border'}
                        </span>
                      </button>
                    </div>
                    {item.description && (
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 italic">{item.description}</p>
                    )}

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

        {/* ADD NEW ITEM - Admin Only */}
        {isAdmin && !searchQuery && (
          <div className="mt-2">
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="w-full py-3 rounded-xl border-2 border-dashed border-blue-300 dark:border-blue-700 text-blue-600 dark:text-blue-400 font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/10 transition-colors"
              >
                <span className="material-icons-round">add_circle_outline</span>
                Nieuw item toevoegen
              </button>
            ) : (
              <div className="bg-white dark:bg-[#1e2330] rounded-xl p-4 shadow-md border-2 border-blue-500 space-y-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="material-icons-round text-blue-600">add_circle</span>
                  <h3 className="font-bold text-gray-900 dark:text-white text-sm">Nieuw item toevoegen</h3>
                </div>

                <input
                  type="text"
                  placeholder="Naam (bv. Currywurst)"
                  value={newItemName}
                  onChange={(e) => setNewItemName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  autoFocus
                />

                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">€</span>
                    <input
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={newItemPrice}
                      onChange={(e) => setNewItemPrice(e.target.value)}
                      className="w-full pl-7 pr-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                    />
                  </div>
                  <select
                    value={newItemCategory}
                    onChange={(e) => setNewItemCategory(e.target.value as FryItem['category'])}
                    className="flex-1 px-3 py-2 rounded-lg bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 capitalize"
                  >
                    {['frieten', 'snacks', 'sauzen', 'huisbereid', 'burgers', 'spaghetti'].map(cat => (
                      <option key={cat} value={cat} className="capitalize">{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleAddItem}
                    disabled={!newItemName.trim() || !newItemPrice}
                    className="flex-1 py-2 rounded-lg bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-1 hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    <span className="material-icons-round text-sm">check</span>
                    Toevoegen
                  </button>
                  <button
                    onClick={() => { setShowAddForm(false); setNewItemName(''); setNewItemPrice(''); }}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 font-bold text-sm hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Annuleren
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

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
                  Totaal {orderingFor ? `voor ${orderingFor.naam}` : ''} ({cart.reduce((a, b) => a + b.quantity, 0)} items)
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
            <div className="flex justify-between items-center mt-3">
              <p className="text-[10px] text-gray-400 flex-1 pr-2">
                {orderingFor
                  ? 'Deze bestelling wordt gekoppeld aan het account van de gekozen persoon.'
                  : 'Wordt direct toegevoegd aan je voorlopige rekening.'}
              </p>
              {!orderingFor && (
                <button
                  onClick={handleSaveFavorite}
                  className="text-[10px] font-bold text-yellow-600 dark:text-yellow-400 flex items-center gap-1 bg-yellow-50 dark:bg-yellow-900/20 px-2.5 py-1.5 rounded-lg border border-yellow-200 dark:border-yellow-800 hover:bg-yellow-100 transition-colors shrink-0"
                >
                  <span className="material-icons-round text-xs">star</span>
                  Opslaan als favoriet
                </button>
              )}
            </div>
          </div>
        </footer>
      )}
    </div>
  );
};