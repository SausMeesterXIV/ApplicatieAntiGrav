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

export interface AgendaEvent {
    id: string;
    titel: string;
    datum: string; // ISO date string
    tijd: string;
    beschrijving: string;
    locatie: string;
}

export interface Consumptie {
    id: string;
    user_id: string;
    drank_id: string;
    aantal: number;
    datum: string; // ISO date string
    period_id?: string;
}

export interface Drank {
    id: string;
    naam: string;
    prijs: number;
    huidige_voorraad: number;
    categorie: string;
}

export interface Factuur {
    id: string;
    user_id: string;
    totaal_bedrag: number;
    periode: string; // e.g., '2024-03'
    status: 'betaald' | 'onbetaald';
}

export interface FrituurBestelling {
    id: string;
    user_id: string;
    snack_naam: string;
    saus: string;
    opmerking?: string;
    status: 'open' | 'besteld' | 'geleverd';
    period_id?: string;
}

export interface Quote {
    id: string;
    tekst: string;
    auteur: string;
    datum: string;
    upvotes: number;
}

export interface BierpongMatch {
    id: string;
    team1_ids: string[]; // Array of User IDs
    team2_ids: string[]; // Array of User IDs
    score1: number;
    score2: number;
    datum: string;
}

export interface Notificatie {
    id: string;
    zender_id: string;
    ontvanger_id: string; // 'all' optionally for general
    titel: string;
    bericht: string;
    gelezen: boolean;
    datum: string;
}

// PROTOTYPE TYPES (Merged)

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
