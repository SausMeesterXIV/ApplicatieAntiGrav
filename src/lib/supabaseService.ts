import { supabase } from './supabase';
import { User, Drink, Streak, StockItem, Order, QuoteItem, Notification, Event, BierpongGame, CountdownItem, BillingPeriod, BillingCorrection } from '../types';

// ==================== PROFILES ====================

export async function fetchProfiles(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('actief', true)
    .order('naam');

  if (error) throw error;
  return (data || []).map(mapProfileToUser);
}

export async function fetchAllProfiles(): Promise<User[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('naam');

  if (error) throw error;
  return (data || []).map(mapProfileToUser);
}

export async function updateProfile(userId: string, updates: Partial<{
  naam: string;
  nickname: string;
  avatar_url: string;
  rol: string;
  actief: boolean;
  quick_drink_id: string | null;
  roles: string[];
}>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
}

function mapProfileToUser(p: any): User {
  return {
    id: p.id,
    naam: p.naam || p.name || '',
    name: p.naam || p.name || '',
    email: p.email,
    rol: p.rol,
    actief: p.actief,
    nickname: p.nickname || undefined,
    avatar: p.avatar_url || `https://i.pravatar.cc/150?u=${p.id}`,
    quickDrinkId: p.quick_drink_id || undefined,
    roles: p.roles || [],
    balance: 0, // Calculated separately
  };
}

// ==================== AVATAR UPLOAD ====================

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Upload file to avatars bucket
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data } = supabase.storage
    .from('avatars')
    .getPublicUrl(filePath);

  const publicUrl = data.publicUrl;

  // Update profile with new URL
  await updateProfile(userId, { avatar_url: publicUrl });

  return publicUrl;
}

// ==================== DRANKEN ====================

export async function fetchDranken(): Promise<Drink[]> {
  const { data, error } = await supabase
    .from('dranken')
    .select('*')
    .order('naam');
  if (error) throw error;
  return (data || []).map(d => ({
    id: d.id,
    name: d.naam,
    price: Number(d.prijs),
    icon: undefined,
    isTemporary: d.is_temporary || false,
    validUntil: d.valid_until || undefined,
  }));
}

export async function addDrank(naam: string, prijs: number, isTemporary = false, validUntil?: string): Promise<Drink> {
  const { data, error } = await supabase
    .from('dranken')
    .insert([{ naam, prijs, is_temporary: isTemporary, valid_until: validUntil || null }])
    .select()
    .single();
  if (error) throw error;
  return { id: data.id, name: data.naam, price: Number(data.prijs), isTemporary: data.is_temporary, validUntil: data.valid_until };
}

export async function updateDrank(id: string | number, naam: string, prijs: number): Promise<void> {
  const { error } = await supabase
    .from('dranken')
    .update({ naam, prijs })
    .eq('id', id);
  if (error) throw error;
}

export async function deleteDrank(id: string | number): Promise<void> {
  const { error } = await supabase
    .from('dranken')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// ==================== CONSUMPTIES (Streaks) ====================

export async function fetchConsumpties(userId?: string): Promise<Streak[]> {
  let query = supabase
    .from('consumpties')
    .select('*, dranken(naam, prijs)')
    .order('datum', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(c => ({
    id: c.id,
    userId: c.user_id,
    drinkId: c.drank_id,
    drinkName: (c as any).dranken?.naam || 'Onbekend',
    price: Number((c as any).dranken?.prijs || 0) * c.aantal,
    amount: c.aantal,
    timestamp: new Date(c.datum),
    period_id: c.period_id || undefined,
  }));
}

export async function addConsumptie(userId: string, drankId: string, aantal: number = 1, periodId?: string, userNaam?: string): Promise<string> {
  const { data, error } = await supabase
    .from('consumpties')
    .insert([{ user_id: userId, drank_id: drankId, aantal, period_id: periodId, user_naam: userNaam || null }])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteConsumptie(id: string): Promise<void> {
  const { error } = await supabase
    .from('consumpties')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function fetchBalanceForUser(userId: string): Promise<number> {
  // Fetch both consumpties and frituur_bestellingen in parallel
  const [consumptiesResult, frituurResult] = await Promise.all([
    supabase
      .from('consumpties')
      .select('aantal, dranken(prijs)')
      .eq('user_id', userId)
      .is('factuur_id', null),
    supabase
      .from('frituur_bestellingen')
      .select('totaal_prijs')
      .eq('user_id', userId)
  ]);

  if (consumptiesResult.error) throw consumptiesResult.error;
  if (frituurResult.error) throw frituurResult.error;

  const consumptiesTotal = (consumptiesResult.data || []).reduce(
    (sum, c) => sum + (c.aantal * Number((c as any).dranken?.prijs || 0)), 0
  );

  const frituurTotal = (frituurResult.data || []).reduce(
    (sum, f) => sum + Number(f.totaal_prijs || 0), 0
  );

  return consumptiesTotal + frituurTotal;
}

export async function fetchAllBalances(): Promise<Record<string, number>> {
  const [consumptiesResult, frituurResult] = await Promise.all([
    supabase
      .from('consumpties')
      .select('user_id, aantal, dranken(prijs)')
      .is('factuur_id', null),
    supabase
      .from('frituur_bestellingen')
      .select('user_id, totaal_prijs')
  ]);

  if (consumptiesResult.error) throw consumptiesResult.error;
  if (frituurResult.error) throw frituurResult.error;

  const balances: Record<string, number> = {};

  (consumptiesResult.data || []).forEach(c => {
    const amount = c.aantal * Number((c as any).dranken?.prijs || 0);
    balances[c.user_id] = (balances[c.user_id] || 0) + amount;
  });

  (frituurResult.data || []).forEach(f => {
    const amount = Number(f.totaal_prijs || 0);
    balances[f.user_id] = (balances[f.user_id] || 0) + amount;
  });

  return balances;
}

// ==================== EVENTS ====================

export async function fetchEvents(): Promise<Event[]> {
  const { data, error } = await supabase
    .from('events')
    .select('*')
    .order('datum', { ascending: true });

  if (error) throw error;
  return (data || []).map(e => ({
    id: e.id,
    title: e.titel,
    date: new Date(e.datum),
    location: e.locatie,
    type: e.type || 'vergadering',
    startTime: e.start_time || e.tijd || '20:00',
    endTime: e.end_time || undefined,
    responsible: e.responsible || undefined,
    description: e.beschrijving || undefined,
  }));
}

export async function saveEvent(event: Event): Promise<Event> {
  const payload = {
    titel: event.title,
    datum: event.date instanceof Date ? `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}-${String(event.date.getDate()).padStart(2, '0')}` : event.date,
    tijd: event.startTime || '20:00',
    locatie: event.location,
    type: event.type,
    start_time: event.startTime || null,
    end_time: event.endTime || null,
    responsible: event.responsible || null,
    beschrijving: event.description || null,
  };

  const isNew = !event.id || event.id.length < 10 || !event.id.includes('-');

  if (!isNew) {
    // Update existing
    const { data, error } = await supabase
      .from('events')
      .update(payload)
      .eq('id', event.id)
      .select()
      .single();
    if (error) throw error;
    return mapEvent(data);
  } else {
    // Insert new
    const { data, error } = await supabase
      .from('events')
      .insert([payload])
      .select()
      .single();
    if (error) throw error;
    return mapEvent(data);
  }
}

function mapEvent(e: any): Event {
  return {
    id: e.id,
    title: e.titel,
    date: new Date(e.datum),
    location: e.locatie,
    type: e.type || 'vergadering',
    startTime: e.start_time || e.tijd || '20:00',
    endTime: e.end_time || undefined,
    responsible: e.responsible || undefined,
    description: e.beschrijving || undefined,
  };
}

export async function deleteEvent(id: string): Promise<void> {
  const { error } = await supabase.from('events').delete().eq('id', id);
  if (error) throw error;
}

// ==================== QUOTES ====================

export async function fetchQuotes(): Promise<QuoteItem[]> {
  const { data: quotesData, error: quotesError } = await supabase
    .from('quotes')
    .select('*')
    .order('datum', { ascending: false });

  if (quotesError) throw quotesError;

  const { data: votesData, error: votesError } = await supabase
    .from('quote_votes')
    .select('*');

  if (votesError) throw votesError;

  return (quotesData || []).map(q => {
    const votes = (votesData || []).filter(v => v.quote_id === q.id);
    return {
      id: q.id,
      text: q.tekst,
      authorId: q.auteur, // This stores the author name or ID
      authorName: q.auteur,
      context: q.context || undefined,
      date: new Date(q.datum),
      likes: votes.filter(v => v.vote_type === 'like').map(v => v.user_id),
      dislikes: votes.filter(v => v.vote_type === 'dislike').map(v => v.user_id),
      addedBy: q.toegevoegd_door || q.auteur,
    };
  });
}

export async function addQuote(tekst: string, auteur: string, context: string, toegevoegdDoor: string): Promise<QuoteItem> {
  const { data, error } = await supabase
    .from('quotes')
    .insert([{ tekst, auteur, context, toegevoegd_door: toegevoegdDoor, datum: new Date().toISOString() }])
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    text: data.tekst,
    authorId: data.auteur,
    authorName: data.auteur,
    context: data.context,
    date: new Date(data.datum),
    likes: [],
    dislikes: [],
    addedBy: data.toegevoegd_door || data.auteur,
  };
}

export async function deleteQuote(id: string): Promise<void> {
  const { error } = await supabase.from('quotes').delete().eq('id', id);
  if (error) throw error;
}

export async function voteQuote(quoteId: string, userId: string, voteType: 'like' | 'dislike', userNaam?: string): Promise<void> {
  // Check existing vote
  const { data: existing } = await supabase
    .from('quote_votes')
    .select('*')
    .eq('quote_id', quoteId)
    .eq('user_id', userId)
    .single();

  if (existing) {
    if (existing.vote_type === voteType) {
      // Same vote = toggle off (delete)
      await supabase.from('quote_votes').delete().eq('id', existing.id);
    } else {
      // Different vote = update
      await supabase.from('quote_votes').update({ vote_type: voteType }).eq('id', existing.id);
    }
  } else {
    // New vote
    const { error } = await supabase
      .from('quote_votes')
      .insert([{ quote_id: quoteId, user_id: userId, vote_type: voteType, user_naam: userNaam || null }]);
    if (error) throw error;
  }
}

// ==================== NOTIFICATIES ====================

export async function fetchNotificaties(userId: string): Promise<Notification[]> {
  const { data, error } = await supabase
    .from('notificaties')
    .select('*, profiles!notificaties_zender_id_fkey(naam)')
    .or(`ontvanger_id.eq.all,ontvanger_id.eq.${userId}`)
    .order('datum', { ascending: false });

  if (error) throw error;
  return (data || []).map((n, index) => ({
    id: n.id ? stableNumericId(n.id) : index, // Stable numeric ID from UUID
    type: 'official' as const,
    sender: (n as any).profiles?.naam || 'Systeem',
    role: '',
    title: n.titel,
    content: n.bericht || '',
    time: formatTimeAgo(new Date(n.datum)),
    isRead: n.gelezen,
    action: n.action || '',
    icon: 'notifications',
    color: 'bg-blue-100 text-blue-600',
    _supabaseId: n.id, // Keep the UUID for updates
  }));
}

export async function addNotificatie(
  zenderId: string,
  ontvangerId: string,
  titel: string,
  bericht: string,
  zenderNaam?: string,
  action?: string
): Promise<void> {
  const { error } = await supabase
    .from('notificaties')
    .insert([{ zender_id: zenderId, ontvanger_id: ontvangerId, titel, bericht, zender_naam: zenderNaam || null, action: action || null }]);
  if (error) throw error;
}

export async function markNotificatieGelezen(id: string): Promise<void> {
  const { error } = await supabase
    .from('notificaties')
    .update({ gelezen: true })
    .eq('id', id);
  if (error) throw error;
}

// ==================== FRITUUR ====================

export async function fetchActiveFrituurSessie(): Promise<{ id: string; status: string; pickupTime: string | null } | null> {
  const { data, error } = await supabase
    .from('frituur_sessies')
    .select('*')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return { id: data[0].id, status: data[0].status, pickupTime: data[0].pickup_time };
}

export async function createFrituurSessie(createdBy: string): Promise<string> {
  const { data, error } = await supabase
    .from('frituur_sessies')
    .insert([{ status: 'open', created_by: createdBy }])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateFrituurSessie(sessieId: string, updates: { 
  status?: string; 
  pickup_time?: string | null;
  actual_amount?: number;
  receipt_url?: string;
}): Promise<void> {
  const { error } = await supabase
    .from('frituur_sessies')
    .update(updates)
    .eq('id', sessieId);
  if (error) throw error;
}

export async function uploadReceipt(sessieId: string, file: File): Promise<string> {
  const fileExt = file.name.split('.').pop();
  const fileName = `receipt-${sessieId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Upload file to receipts bucket
  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data } = supabase.storage
    .from('receipts')
    .getPublicUrl(filePath);

  return data.publicUrl;
}

export async function fetchFrituurBestellingen(sessieId?: string): Promise<Order[]> {
  let query = supabase
    .from('frituur_bestellingen')
    .select('*')
    .order('created_at', { ascending: false });

  if (sessieId) {
    query = query.eq('sessie_id', sessieId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(b => ({
    id: b.id,
    userId: b.user_id,
    userName: b.user_name || 'Onbekend',
    items: b.items || [],
    totalPrice: Number(b.totaal_prijs || 0),
    date: new Date(b.created_at),
    status: b.status === 'geleverd' ? 'completed' as const : 'pending' as const,
    periodId: b.period_id,
  }));
}

// ==================== FRITUUR MENU ITEMS ====================

export async function fetchFryItems(): Promise<import('../types').FryItem[]> {
  const { data, error } = await supabase
    .from('frituur_items')
    .select('*')
    .order('category')
    .order('name');
  
  if (error) throw error;
  return (data || []).map(i => ({
    id: i.id,
    name: i.name,
    price: Number(i.price),
    category: i.category as any,
    description: i.description || undefined
  }));
}

export async function addFryItem(item: Omit<import('../types').FryItem, 'id'>): Promise<string> {
  const { data, error } = await supabase
    .from('frituur_items')
    .insert([item])
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function updateFryItem(id: string, updates: Partial<import('../types').FryItem>): Promise<void> {
  const { error } = await supabase
    .from('frituur_items')
    .update(updates)
    .eq('id', id);
  
  if (error) throw error;
}

export async function deleteFryItem(id: string): Promise<void> {
  const { error } = await supabase
    .from('frituur_items')
    .delete()
    .eq('id', id);
  
  if (error) throw error;
}

export async function addFrituurBestelling(
  userId: string,
  userName: string,
  sessieId: string | null,
  items: any[],
  totaalPrijs: number,
  periodId?: string
): Promise<string> {
  const { data, error } = await supabase
    .from('frituur_bestellingen')
    .insert([{
      user_id: userId,
      user_name: userName,
      sessie_id: sessieId,
      snack_naam: items.map(i => i.name).join(', '),
      items: items,
      totaal_prijs: totaalPrijs,
      status: 'open',
      period_id: periodId,
    }])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function deleteFrituurBestelling(id: string): Promise<void> {
  const { error } = await supabase.from('frituur_bestellingen').delete().eq('id', id);
  if (error) throw error;
}

export async function archiveFrituurSessie(sessieId: string): Promise<void> {
  // Mark all orders as delivered
  await supabase
    .from('frituur_bestellingen')
    .update({ status: 'geleverd' })
    .eq('sessie_id', sessieId);

  // Close the session  
  await supabase
    .from('frituur_sessies')
    .update({ status: 'completed', closed_at: new Date().toISOString() })
    .eq('id', sessieId);
}

// ==================== BIERPONG ====================

export async function fetchBierpongGames(): Promise<BierpongGame[]> {
  const { data, error } = await supabase
    .from('bierpong_games')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(g => ({
    id: g.id,
    playerIds: g.player_ids || [],
    winnerIds: g.winner_ids || (g.winner_id ? [g.winner_id] : []), // Fallback just in case
    timestamp: new Date(g.created_at),
  }));
}

export async function addBierpongGame(playerIds: string[], winnerIds: string[]): Promise<BierpongGame> {
  const { data, error } = await supabase
    .from('bierpong_games')
    .insert([{ player_ids: playerIds, winner_ids: winnerIds }])
    .select()
    .single();
  if (error) throw error;
  return {
    id: data.id,
    playerIds: data.player_ids,
    winnerIds: data.winner_ids,
    timestamp: new Date(data.created_at),
  };
}

export async function fetchBierpongKampioenen(): Promise<string[]> {
  const { data, error } = await supabase
    .from('bierpong_kampioenen')
    .select('player_ids')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  return data && data.length > 0 ? data[0].player_ids : [];
}


export async function setBierpongKampioenen(playerIds: string[]): Promise<void> {
  const { error } = await supabase
    .from('bierpong_kampioenen')
    .insert([{ player_ids: playerIds }]);
  if (error) throw error;
}

// ==================== STOCK ITEMS ====================

export async function fetchStockItems(): Promise<StockItem[]> {
  const { data, error } = await supabase
    .from('stock_items')
    .select('*')
    .order('name');

  if (error) throw error;
  return (data || []).map((s, index) => ({
    id: index + 1,
    name: s.name,
    label: s.label || '',
    category: s.category || 'Standaard',
    count: s.count,
    unit: s.unit || 'stuks',
    exp: s.expiry_date || '',
    urgent: s.urgent || false,
    icon: s.icon || 'inventory_2',
    color: s.color || 'bg-gray-500',
    _supabaseId: s.id, // Keep UUID for updates
  }));
}

export async function addStockItem(item: Partial<StockItem>): Promise<void> {
  const { error } = await supabase
    .from('stock_items')
    .insert([{
      name: item.name,
      label: item.label,
      category: item.category,
      count: item.count,
      unit: item.unit,
      expiry_date: item.exp || null,
      urgent: item.urgent,
      icon: item.icon,
      color: item.color,
    }]);
  if (error) throw error;
}

export async function updateStockItem(supabaseId: string, updates: any): Promise<void> {
  const { error } = await supabase
    .from('stock_items')
    .update({
      name: updates.name,
      label: updates.label,
      category: updates.category,
      count: updates.count,
      unit: updates.unit,
      expiry_date: updates.exp || null,
      urgent: updates.urgent,
      icon: updates.icon,
      color: updates.color,
    })
    .eq('id', supabaseId);
  if (error) throw error;
}

export async function deleteStockItem(supabaseId: string): Promise<void> {
  const { error } = await supabase.from('stock_items').delete().eq('id', supabaseId);
  if (error) throw error;
}

// ==================== FACTUREN ====================

export async function fetchFacturen(userId?: string): Promise<any[]> {
  let query = supabase
    .from('facturen')
    .select('*, profiles(naam)')
    .order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createFactuur(userId: string, totaalBedrag: number, periode: string, userNaam?: string): Promise<string> {
  const { data, error } = await supabase
    .from('facturen')
    .insert([{ user_id: userId, totaal_bedrag: totaalBedrag, periode, user_naam: userNaam || null }])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateFactuurStatus(id: string, status: 'betaald' | 'onbetaald'): Promise<void> {
  const { error } = await supabase
    .from('facturen')
    .update({ status })
    .eq('id', id);
  if (error) throw error;
}

// ==================== HELPERS ====================

function formatTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Zonet';
  if (diffMins < 60) return `${diffMins}m geleden`;
  if (diffHours < 24) return `${diffHours}u geleden`;
  if (diffDays < 7) return `${diffDays}d geleden`;
  return date.toLocaleDateString('nl-BE');
}

/** Generate a stable numeric ID from a UUID string (for React keys) */
function stableNumericId(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    const char = uuid.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash);
}

// ==================== COUNTDOWNS ====================

export async function fetchCountdowns(): Promise<CountdownItem[]> {
  const { data, error } = await supabase.from('countdowns').select('*');
  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    title: c.title,
    targetDate: new Date(c.target_date)
  }));
}

export async function saveCountdowns(countdowns: CountdownItem[]): Promise<void> {
  const payload = countdowns.map(c => {
    const targetStr = c.targetDate instanceof Date ? `${c.targetDate.getFullYear()}-${String(c.targetDate.getMonth() + 1).padStart(2, '0')}-${String(c.targetDate.getDate()).padStart(2, '0')}` : String(c.targetDate);
    return {
      id: c.id,
      title: c.title,
      target_date: targetStr
    };
  });

  // Fetch existing IDs to determine which ones to remove
  const { data: existing } = await supabase.from('countdowns').select('id');
  const existingIds = (existing || []).map((r: any) => r.id);
  const newIds = countdowns.map(c => c.id);
  const toDelete = existingIds.filter((id: string) => !newIds.includes(id));

  // Delete removed countdowns
  if (toDelete.length > 0) {
    await supabase.from('countdowns').delete().in('id', toDelete);
  }

  // Upsert remaining (insert or update)
  if (payload.length > 0) {
    const { error } = await supabase.from('countdowns').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }
}

// ==================== APP SETTINGS ====================

export async function fetchAppSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single();

  if (error) {
    if (error.code === 'PGRST116') return null; // Not found
    throw error;
  }
  return data?.value || null;
}

export async function saveAppSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value }, { onConflict: 'key' });

  if (error) throw error;
}

// ==================== BILLING PERIODS ====================

export function calculateWerkjaar(date: Date = new Date()): string {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11, Aug is 7
  const day = date.getDate();

  if (month < 7 || (month === 7 && day < 15)) {
    return `${year - 1}-${year}`;
  } else {
    return `${year}-${year + 1}`;
  }
}

export async function fetchBillingPeriods(): Promise<BillingPeriod[]> {
  const { data, error } = await supabase
    .from('billing_periods')
    .select('*')
    .order('werkjaar', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapBillingPeriod);
}

export async function fetchOpenBillingPeriod(): Promise<BillingPeriod | null> {
  const { data, error } = await supabase
    .from('billing_periods')
    .select('*')
    .eq('is_closed', false)
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return mapBillingPeriod(data[0]);
}

export async function createBillingPeriod(payload: {
  naam: string;
  start_datum?: string;
  geschatte_kost?: number;
}): Promise<BillingPeriod> {
  const startDatum = payload.start_datum ? new Date(payload.start_datum) : new Date();
  const werkjaar = calculateWerkjaar(startDatum);

  const { data, error } = await supabase
    .from('billing_periods')
    .insert([{
      naam: payload.naam,
      start_datum: startDatum.toISOString(),
      is_closed: false,
      geschatte_kost: payload.geschatte_kost || 0,
      werkjaar: werkjaar
    }])
    .select()
    .single();

  if (error) throw error;
  return mapBillingPeriod(data);
}

export async function updateBillingPeriod(id: string, updates: Partial<{
  naam: string;
  start_datum: string;
  eind_datum: string | null;
  is_closed: boolean;
  geschatte_kost: number;
  werkjaar: string;
  gsheet_sheet_id: string;
}>): Promise<void> {
  const { error } = await supabase
    .from('billing_periods')
    .update(updates)
    .eq('id', id);

  if (error) throw error;
}

export async function updateGeschatteKost(periodId: string, bedrag: number): Promise<void> {
  const { error } = await supabase
    .from('billing_periods')
    .update({ geschatte_kost: bedrag })
    .eq('id', periodId);

  if (error) throw error;
}

export async function archiveConsumptiesPeriod(): Promise<{ closed_period_id: string | null; new_period_id: string }> {
  const { data, error } = await supabase.rpc('archive_consumpties_period');
  if (error) throw error;
  return data;
}

function mapBillingPeriod(p: any): BillingPeriod {
  return {
    id: p.id,
    naam: p.naam || p.name || '',
    start_datum: p.start_datum || p.start_date || '',
    eind_datum: p.eind_datum || p.end_date || null,
    is_closed: p.is_closed || false,
    geschatte_kost: Number(p.geschatte_kost || 0),
    werkjaar: p.werkjaar || undefined,
    gsheet_sheet_id: p.gsheet_sheet_id || undefined,
    created_at: p.created_at,
  };
}

// ==================== BILLING CORRECTIONS ====================

export async function fetchBillingCorrections(periodId: string): Promise<BillingCorrection[]> {
  const { data, error } = await supabase
    .from('billing_corrections')
    .select('*')
    .eq('period_id', periodId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map((c: any) => ({
    id: c.id,
    user_id: c.user_id,
    period_id: c.period_id,
    correctie_bedrag: Number(c.correctie_bedrag || 0),
    notitie: c.notitie || undefined,
    created_at: c.created_at,
  }));
}

export async function addBillingCorrection(
  userId: string,
  periodId: string,
  bedrag: number,
  notitie?: string,
  userNaam?: string
): Promise<BillingCorrection> {
  const { data, error } = await supabase
    .from('billing_corrections')
    .insert([{
      user_id: userId,
      period_id: periodId,
      correctie_bedrag: bedrag,
      notitie: notitie || null,
      user_naam: userNaam || null,
    }])
    .select()
    .single();

  if (error) throw error;
  return {
    id: data.id,
    user_id: data.user_id,
    period_id: data.period_id,
    correctie_bedrag: Number(data.correctie_bedrag),
    notitie: data.notitie || undefined,
    created_at: data.created_at,
  };
}

// ==================== APP SETTINGS ====================

export async function fetchSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('value')
    .eq('key', key)
    .single();
  
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data?.value || null;
}

export async function updateSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .upsert({ key, value, updated_at: new Date().toISOString() });
  
  if (error) throw error;
}

export async function fetchAvailableRoles(): Promise<import('../types').RoleDefinition[]> {
  const data = await fetchSetting('available_roles');
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error("Failed to parse available_roles", e);
    }
  }
  return [];
}

export async function saveAvailableRoles(roles: import('../types').RoleDefinition[]): Promise<void> {
  await updateSetting('available_roles', JSON.stringify(roles));
}

// Keep backward compat alias
export const fetchActiveBillingPeriod = fetchOpenBillingPeriod;

// ==================== SHOP ====================

export async function fetchShopProducts(category?: string): Promise<import('../types').ShopProduct[]> {
    let query = supabase.from('shop_products').select('*, variants:shop_variants(*)');
    if (category) query = query.eq('category', category);
    const { data, error } = await query.order('name');
    if (error) throw error;
    return data || [];
}

export async function saveShopProduct(product: Partial<import('../types').ShopProduct>): Promise<import('../types').ShopProduct> {
    const { data, error } = await supabase
        .from('shop_products')
        .upsert(product)
        .select('*, variants:shop_variants(*)')
        .single();
    if (error) throw error;
    return data;
}

export async function deleteShopProduct(id: string): Promise<void> {
    const { error } = await supabase.from('shop_products').delete().eq('id', id);
    if (error) throw error;
}

export async function updateShopVariantStock(variantId: string, newStock: number): Promise<void> {
    const { error } = await supabase.from('shop_variants').update({ stock: newStock }).eq('id', variantId);
    if (error) throw error;
}

export async function addShopVariant(productId: string, name: string, stock: number = 0): Promise<import('../types').ShopVariant> {
    const { data, error } = await supabase
        .from('shop_variants')
        .insert([{ product_id: productId, name, stock }])
        .select()
        .single();
    if (error) throw error;
    return data;
}

export async function deleteShopVariant(id: string): Promise<void> {
    const { error } = await supabase.from('shop_variants').delete().eq('id', id);
    if (error) throw error;
}

export async function uploadShopImage(productId: string, file: File): Promise<string> {
    const fileExt = file.name.split('.').pop();
    const fileName = `shop-${productId}-${Date.now()}.${fileExt}`;
    const filePath = `${fileName}`;

    const { error: uploadError } = await supabase.storage
        .from('shop-images')
        .upload(filePath, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from('shop-images').getPublicUrl(filePath);
    return data.publicUrl;
}

