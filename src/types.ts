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
    id: string; // Ensure UUID is always string
    naam: string;
    name: string; // Alias for naam for consistency
    email: string;
    actief: boolean;
    rol: Database['public']['Enums']['user_role'] | 'winkeltje';
    roles: string[]; // Frontend expectation is string[] (not null)
    nickname: string | null;
    avatar_url: string | null;
    avatar?: string; // Legacy alias
    role?: string; // Legacy alias/display role
    status?: 'online' | 'offline';
    balance?: number;
    quick_drink_id: string | null;
    quickDrinkId?: string; // Legacy alias
    created_at: string;
}

export type BillingPeriod = DbBillingPeriodRow;
export type InkoopFactuur = DbInkoopFactuurRow;
export type BillingCorrection = DbBillingCorrectionRow;

export interface Drink extends DbDrankRow {
    name: string; // Alias for naam
    price: number; // Alias for prijs
    isTemporary?: boolean; // Alias for is_temporary
    validUntil?: string | null; // Alias for valid_until
    icon?: string | null;
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
    status: 'pending' | 'completed' | 'open' | 'closed'; // Fixed to include common statuses
    periodId?: string;
}

export interface Event extends Omit<DbEventRow, 'id' | 'type' | 'responsible'> {
    id: string; // Match Database string ID
    title: string; // Alias for titel
    date: Date;
    startTime: string; // Alias for start_time
    endTime?: string | null; // Alias for end_time
    location: string; // Alias for locatie
    description?: string | null; // Alias for beschrijving
    type: string | null;
    responsible: string | null;
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
    text: string; // Alias for tekst
    authorName: string; // Alias for auteur
    authorId?: string; // Alias for toegevoegd_door if needed
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
