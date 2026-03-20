import type { Database } from './database.types';

// 1. Haal de pure 'Row' types uit de database generatie
export type DbProfileRow = Database['public']['Tables']['profiles']['Row'];
export type DbDrankRow = Database['public']['Tables']['dranken']['Row'];
export type DbBillingPeriodRow = Database['public']['Tables']['billing_periods']['Row'];
export type DbFriesOrderRow = Database['public']['Tables']['frituur_bestellingen']['Row'];
export type DbFriesItemRow = Database['public']['Tables']['frituur_items']['Row'];
export type DbInkoopFactuurRow = Database['public']['Tables']['inkoop_facturen']['Row'];
export type DbBillingCorrectionRow = Database['public']['Tables']['billing_corrections']['Row'];
export type DbConsumptieRow = Database['public']['Tables']['consumpties']['Row'];
export type DbEventRow = Database['public']['Tables']['events']['Row'];
export type DbQuoteRow = Database['public']['Tables']['quotes']['Row'];
export type DbCountdownRow = Database['public']['Tables']['countdowns']['Row'];
export type DbStockItemRow = Database['public']['Tables']['stock_items']['Row'];
export type DbShopProductRow = Database['public']['Tables']['shop_products']['Row'];
export type DbShopVariantRow = Database['public']['Tables']['shop_variants']['Row'];
export type DbBierpongGameRow = Database['public']['Tables']['bierpong_games']['Row'];
export type DbNotificationRow = Database['public']['Tables']['notificaties']['Row'];

// 2. Koppel ze aan je frontend interfaces
export interface User extends Omit<DbProfileRow, 'id' | 'rol'> {
    id: string;
    naam: string;
    name: string; 
    email: string;
    actief: boolean;
    rol: string;
    roles: string[];
    nickname: string | null;
    avatar_url: string | null;
    avatar?: string; // Optioneel gemaakt voor initials fallback
    status?: 'online' | 'offline';
    role?: string; // Legacy alias/display role
    quick_drink_id: string | null;
    fcm_token: string | null;
    quickDrinkId?: string; // Optioneel alias
    created_at: string;
    balance?: number;
}

export type BillingPeriod = DbBillingPeriodRow;
export type InkoopFactuur = DbInkoopFactuurRow;
export type BillingCorrection = DbBillingCorrectionRow;

export interface Drink extends DbDrankRow {
    name: string;
    price: number;
    isTemporary?: boolean;
    validUntil?: string | null;
}

export interface FryItem extends DbFriesItemRow {
    category: 'frieten' | 'snacks' | 'sauzen' | 'huisbereid' | 'burgers' | 'spaghetti' | 'dranken';
    description: string | null;
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
    // We gebruiken hier exact de database enums voor continuïteit
    status: 'open' | 'besteld' | 'geleverd'; 
    periodId?: string;
}

export interface Event extends DbEventRow {
    title: string;
    location: string; // Alias voor 'locatie'
    description?: string | null; // Alias voor 'beschrijving'
    startTime: string;
    endTime?: string | null;
    date: Date;
}

export interface Transaction {
    id: string;
    userId: string;
    userName: string;
    userAvatar?: string;
    amount: number;
    type: 'drink' | 'food';
    timestamp: string;
    details: string;
}

export interface Notification extends DbNotificationRow {
    id: string; // Match Database string ID
    type: 'official' | 'nudge' | 'agenda' | 'order';
    sender: string; // Alias for zender_naam
    role: string;
    title: string; // Alias for titel
    content: string; // Alias for bericht
    time: string; // Alias for created_at
    isRead: boolean; // Alias for is_read
    action: string | null;
    icon?: string | null;
    color?: string | null;
}

export interface QuoteItem extends DbQuoteRow {
    text: string;
    authorName: string;
    authorId: string; // Toegevoegd om TS2353 op te lossen
    date: Date;
    likes: string[];
    dislikes: string[];
    addedBy?: string | null;
}

export interface CountdownItem extends DbCountdownRow {
    title: string;
    targetDate: Date;
}

export interface StockItem extends DbStockItemRow {
    id: string; // Match Database string ID
    urgent: boolean; // Overriding to be strictly boolean (not null)
    exp?: string | null; // Alias for expiry_date
    icon: string | null;
    label: string | null;
    color: string | null;
}

export interface Todo {
    id: string;
    user_id: string;
    task: string;
    completed: boolean;
    created_at: string;
}

export interface Streak {
    id: string;
    userId: string;
    userName?: string;
    drinkId: string | number;
    drinkName: string;
    price: number;
    amount: number;
    timestamp: Date;
    period_id?: string;
}

export interface BierpongGame extends DbBierpongGameRow {
    playerIds: string[]; // Alias for player_ids
    winnerIds: string[]; // Alias for winner_ids
    timestamp: Date;
}

export interface RoleDefinition {
    id: string;
    label: string;
    icon: string;
    color: string;
}

export interface ShopProduct extends DbShopProductRow {
    variants?: ShopVariant[];
}

export interface ShopVariant extends DbShopVariantRow {}
