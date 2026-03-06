export interface User {
    id: string; // UUID from Supabase Auth
    naam: string;
    name: string; // Alias for naam, required for consistency
    email: string;
    rol: 'admin' | 'team_drank' | 'standaard' | 'sfeerbeheer' | 'godmode' | 'team drank';
    actief: boolean;
    nickname?: string; // New field for display name
    role?: string; // Display role e.g. "Hoofdleiding"
    avatar?: string;
    balance?: number;
    roles?: string[]; // Functional roles e.g. ["Drank", "Financiën"]
    status?: 'online' | 'offline';
    quickDrinkId?: string;
}

export interface BillingPeriod {
    id: string;
    naam: string;
    start_datum: string;
    eind_datum: string | null;
    is_closed: boolean;
    geschatte_kost: number;
    created_at: string;
}

export interface BillingCorrection {
    id: string;
    user_id: string;
    period_id: string;
    correctie_bedrag: number;
    notitie?: string;
    created_at: string;
}

// ==================== CANONICAL TYPES ====================
// These are the active types used throughout the app.
// Dead/unused interfaces (AgendaEvent, Consumptie, Drank, Factuur,
// FrituurBestelling, Quote, BierpongMatch, Notificatie) have been removed.

export interface Drink {
    id: string | number;
    name: string;
    price: number;
    icon?: string;
    isTemporary?: boolean;
    validUntil?: string;
}

export interface FryItem {
    id: string;
    name: string;
    price: number;
    category: 'frieten' | 'snacks' | 'sauzen' | 'huisbereid' | 'burgers' | 'spaghetti';
    description?: string;
}

export interface CartItem extends FryItem {
    quantity: number;
}

export interface Order {
    id: string;
    userId: string;
    userName: string;
    items: CartItem[];
    totalPrice: number;
    date: Date;
    status: 'pending' | 'completed';
}

export interface Event {
    id: string;
    title: string;
    date: Date;
    location: string;
    type: string;
    startTime: string;
    endTime?: string;
    responsible?: string;
    description?: string;
}

export interface Transaction {
    id: string;
    userId: string;
    userName: string;
    userAvatar: string;
    amount: number;
    type: 'drink' | 'food';
    timestamp: string;
    details: string;
}

export interface Notification {
    id: number;
    type: 'official' | 'nudge' | 'agenda' | 'order';
    sender: string;
    role: string;
    title: string;
    content: string;
    time: string;
    isRead: boolean;
    action: string;
    icon: string;
    color: string;
}

export interface QuoteItem { // Renamed from Quote to avoid conflict
    id: string;
    text: string;
    authorId: string;
    authorName: string;
    context?: string;
    date: Date;
    likes: string[];
    dislikes: string[];
    addedBy: string;
}

export interface CountdownItem {
    id: string;
    title: string;
    targetDate: Date;
}

export interface StockItem {
    id: number;
    name: string;
    label: string;
    category: string;
    count: number;
    unit: string;
    exp: string;
    urgent: boolean;
    icon: string;
    color: string;
}

export interface Streak {
    id: string;
    userId: string;
    drinkId: string | number;
    drinkName: string;
    price: number;
    amount: number;
    timestamp: Date;
    period_id?: string;
}

export interface BierpongGame {
    id: string;
    playerIds: string[];
    winnerIds: string[];
    timestamp: Date;
}
