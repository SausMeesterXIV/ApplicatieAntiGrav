import { supabase } from './supabase';
import { formatTimeAgo } from './utils';
import { User, Drink, Streak, StockItem, Order, QuoteItem, Notification, Event, BierpongGame, CountdownItem, BillingPeriod, BillingCorrection, DbDrankRow, DbProfileRow, DbEventRow, DbQuoteRow, DbBierpongGameRow, DbShopProductRow, DbShopVariantRow } from '../types';

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

export async function updateProfile(userId: string, updates: Partial<DbProfileRow>): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId);
  if (error) throw error;
}

function mapProfileToUser(p: DbProfileRow): User {
  return {
    ...p,
    name: p.naam,
    avatar: p.avatar_url || `https://i.pravatar.cc/150?u=${p.id}`,
    roles: p.roles || [],
    quickDrinkId: p.quick_drink_id || undefined,
    fcm_token: p.fcm_token || null,
    balance: 0,
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
  return (data || []).map(mapDrank);
}

function mapDrank(d: DbDrankRow): Drink {
  return {
    ...d,
    name: d.naam,
    price: Number(d.prijs),
    isTemporary: d.is_temporary,
    validUntil: d.valid_until || undefined,
    categorie: d.categorie,
  };
}

export async function addDrank(naam: string, prijs: number, isTemporary = false, validUntil?: string): Promise<Drink> {
  const { data, error } = await supabase
    .from('dranken')
    .insert([{ naam, prijs, is_temporary: isTemporary, valid_until: validUntil || null }])
    .select()
    .single();
  if (error) throw error;
  return mapDrank(data);
}

export async function updateDrank(id: string | number, naam: string, prijs: number): Promise<void> {
  const { error } = await supabase
    .from('dranken')
    .update({ naam, prijs })
    .eq('id', String(id));
  if (error) throw error;
}

export async function deleteDrank(id: string | number): Promise<void> {
  const { error } = await supabase
    .from('dranken')
    .delete()
    .eq('id', String(id));
  if (error) throw error;
}

// ==================== CONSUMPTIES (Streaks) ====================

export async function fetchConsumpties(userId?: string): Promise<Streak[]> {
  let query = supabase
    .from('consumpties')
    .select('*, dranken(naam, prijs), profiles(naam)')
    .order('datum', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(c => ({
    id: c.id,
    userId: c.user_id,
    userName: (c as any).profiles?.naam || c.user_naam || 'Onbekend',
    drinkId: c.drank_id,
    drinkName: (c as any).dranken?.naam || 'Onbekend',
    price: Number((c as any).dranken?.prijs || 0) * c.aantal,
    amount: c.aantal,
    timestamp: new Date(c.datum),
    period_id: c.period_id || undefined,
  }));
}

export async function addConsumptie(
  userId: string, 
  drankId: string, 
  aantal: number = 1, 
  periodId?: string,
  userNaam?: string
): Promise<string> {
  const { data, error } = await (supabase as any).rpc('streep_drank', {
    p_user_id: userId,
    p_drank_id: drankId,
    p_aantal: aantal,
    p_period_id: periodId || null
  });

  if (error) throw error;
  return data as string;
}

export async function deleteConsumptie(id: string): Promise<void> {
  const { error } = await supabase
    .from('consumpties')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

export async function fetchBalanceForUser(userId: string): Promise<number> {
  const [consumptiesResult, frituurResult, correctionsResult] = await Promise.all([
    supabase.from('consumpties').select('aantal, dranken(prijs)').eq('user_id', userId).is('factuur_id', null),
    supabase.from('frituur_bestellingen').select('totaal_prijs').eq('user_id', userId).is('period_id', null),
    supabase.from('billing_corrections').select('correctie_bedrag').eq('user_id', userId)
  ]);

  if (consumptiesResult.error) throw consumptiesResult.error;
  if (frituurResult.error) throw frituurResult.error;
  if (correctionsResult.error) throw correctionsResult.error;

  const consumptiesTotal = (consumptiesResult.data || []).reduce(
    (sum, c) => sum + (c.aantal * Number((c as any).dranken?.prijs || 0)), 0
  );

  const frituurTotal = (frituurResult.data || []).reduce(
    (sum, f) => sum + Number(f.totaal_prijs || 0), 0
  );

  const correctionsTotal = (correctionsResult.data || []).reduce(
    (sum, corr) => sum + Number(corr.correctie_bedrag || 0), 0
  );

  return consumptiesTotal + frituurTotal + correctionsTotal;
}

export async function fetchAllBalances(): Promise<Record<string, number>> {
  const [consumptiesResult, frituurResult, correctionsResult] = await Promise.all([
    supabase
      .from('consumpties')
      .select('user_id, aantal, dranken(prijs)')
      .is('factuur_id', null),
    supabase
      .from('frituur_bestellingen')
      .select('user_id, totaal_prijs')
      .is('period_id', null),
    supabase
      .from('billing_corrections')
      .select('user_id, correctie_bedrag')
  ]);

  if (consumptiesResult.error) throw consumptiesResult.error;
  if (frituurResult.error) throw frituurResult.error;
  if (correctionsResult.error) throw correctionsResult.error;

  const balances: Record<string, number> = {};

  (consumptiesResult.data || []).forEach(c => {
    const amount = c.aantal * Number((c as any).dranken?.prijs || 0);
    balances[c.user_id] = (balances[c.user_id] || 0) + amount;
  });

  (frituurResult.data || []).forEach(f => {
    const amount = Number(f.totaal_prijs || 0);
    balances[f.user_id] = (balances[f.user_id] || 0) + amount;
  });

  (correctionsResult.data || []).forEach(corr => {
    const amount = Number(corr.correctie_bedrag || 0);
    balances[corr.user_id] = (balances[corr.user_id] || 0) + amount;
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
  return (data || []).map(mapEvent);
}

export async function saveEvent(event: Event): Promise<Event> {
  const payload = {
    titel: event.title,
    datum: event.date instanceof Date ? `${event.date.getFullYear()}-${String(event.date.getMonth() + 1).padStart(2, '0')}-${String(event.date.getDate()).padStart(2, '0')}` : String(event.date),
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

function mapEvent(e: DbEventRow): Event {
  return {
    ...e,
    title: e.titel,
    location: e.locatie,
    description: e.beschrijving,
    startTime: e.start_time || e.tijd || '20:00',
    endTime: e.end_time || null,
    date: new Date(e.datum),
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
    return mapQuote(q, votes);
  });
}

function mapQuote(q: DbQuoteRow, votes: any[] = []): QuoteItem {
  return {
    ...q,
    text: q.tekst,
    authorName: q.auteur,
    authorId: q.toegevoegd_door || '', 
    date: new Date(q.datum),
    likes: votes.filter(v => v.vote_type === 'like').map(v => v.user_id),
    dislikes: votes.filter(v => v.vote_type === 'dislike').map(v => v.user_id),
  };
}

export async function addQuote(tekst: string, auteur: string, context: string, toegevoegdDoor: string): Promise<QuoteItem> {
  const { data, error } = await supabase
    .from('quotes')
    .insert([{ tekst, auteur, context, toegevoegd_door: toegevoegdDoor, datum: new Date().toISOString() }])
    .select()
    .single();
  if (error) throw error;
  return mapQuote(data);
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
    .select('*, profiles!notificaties_zender_id_fkey(naam, rol)')
    .or(`ontvanger_id.eq.all,ontvanger_id.eq.${userId}`)
    .order('datum', { ascending: false });

  if (error) throw error;
  
  return (data || []).map((n) => {
    // Haal de rol op uit de gekoppelde profiel-data
    const zenderRol = (n as any).profiles?.rol;
    const type = (n as any).type || 'official';
    
    return {
      ...n,
      id: n.id,
      type: type as any,
      sender: (n as any).profiles?.naam || n.zender_naam || 'Systeem',
      role: zenderRol === 'hoofdleiding' ? 'Hoofdleiding' : '',
      title: n.titel,
      content: n.bericht || '',
      time: formatTimeAgo(new Date(n.datum)),
      isRead: n.gelezen,
      action: n.action,
      icon: type === 'nudge' ? 'touch_app' : 'notifications',
      color: type === 'nudge' 
        ? 'bg-orange-100 text-orange-600' 
        : 'bg-blue-100 text-blue-600',
    };
  }) as Notification[];
}

export async function addNotificatie(
  zenderId: string,
  ontvangerId: string,
  titel: string,
  bericht: string,
  zenderNaam?: string,
  action?: string,
  type: string = 'official'
): Promise<void> {
  const { error } = await supabase
    .from('notificaties')
    .insert([{ 
      zender_id: zenderId, 
      ontvanger_id: ontvangerId, 
      titel, 
      bericht, 
      zender_naam: zenderNaam || null, 
      action: action || null,
      type: type
    }]);
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

export async function updateFrituurSessie(sessieId: string, updates: any): Promise<void> {
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
    items: (b.items as any) || [],
    totalPrice: Number(b.totaal_prijs || 0),
    date: new Date(b.created_at),
    status: b.status as 'open' | 'besteld' | 'geleverd', // Directe cast naar DB type
    periodId: b.period_id || undefined,
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
    ...i,
    category: i.category as any,
    description: i.description ?? null
  })) as import('../types').FryItem[];
}

export async function addFryItem(item: Omit<import('../types').FryItem, 'id'>): Promise<string> {
  const { data, error } = await supabase
    .from('frituur_items')
    .insert([item as any])
    .select('id')
    .single();
  
  if (error) throw error;
  return data.id;
}

export async function updateFryItem(id: string, updates: Partial<import('../types').FryItem>): Promise<void> {
  const { error } = await supabase
    .from('frituur_items')
    .update(updates as any)
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
      items: items as any,
      totaal_prijs: totaalPrijs,
      status: 'open',
      period_id: periodId || null,
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

export async function finalizeFrituurSessie(sessieId: string, actualAmount: number): Promise<{ expected_amount: number; actual_amount: number }> {
  const { data, error } = await supabase.rpc('finalize_frituur_sessie', {
    p_sessie_id: sessieId,
    p_actual_amount: actualAmount
  });

  if (error) throw error;
  return data as unknown as { expected_amount: number; actual_amount: number };
}

// ==================== BIERPONG ====================

export async function updateUserFcmToken(userId: string, token: string | null) {
  const { error } = await supabase
    .from('profiles')
    .update({ fcm_token: token } as any)
    .eq('id', userId);
  
  if (error) throw error;
}

export async function fetchBierpongGames(): Promise<BierpongGame[]> {
  const { data, error } = await supabase
    .from('bierpong_games')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(g => ({
    ...g,
    playerIds: g.player_ids || [],
    winnerIds: g.winner_ids || (g.winner_id ? [g.winner_id] : []), // Fallback just in case
    timestamp: new Date(g.created_at),
  }));
}

export async function addBierpongGame(playerIds: string[], winnerIds: string[]): Promise<BierpongGame> {
  const { data, error } = await supabase
    .from('bierpong_games')
    .insert([{ player_ids: playerIds, winner_ids: winnerIds, winner_id: winnerIds[0] }])
    .select()
    .single();
  if (error) throw error;
  return {
    ...data,
    playerIds: data.player_ids,
    winnerIds: data.winner_ids || [data.winner_id],
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
    ...s,
    id: s.id, // Using UUID as id to match StockItem.id (string)
    label: s.label || '',
    category: s.category || 'Standaard',
    unit: s.unit || 'stuks',
    exp: s.expiry_date || null,
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
      name: item.name || '',
      label: item.label || null,
      category: item.category || null,
      count: item.count || 0,
      unit: item.unit || null,
      expiry_date: item.exp || null,
      urgent: item.urgent || false,
      icon: item.icon || null,
      color: item.color || null,
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

// ==================== COUNTDOWNS ====================

export async function fetchCountdowns(): Promise<CountdownItem[]> {
  const { data, error } = await supabase.from('countdowns').select('*');
  if (error) throw error;
  return (data || []).map((c) => ({
    ...c,
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

export async function updateBillingPeriod(id: string, updates: any): Promise<void> {
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
  return (data as any) || { closed_period_id: null, new_period_id: '' };
}

function mapBillingPeriod(p: any): BillingPeriod {
  return {
    ...p,
    naam: p.naam || p.name || '',
    start_datum: p.start_datum || p.start_date || '',
    eind_datum: p.eind_datum || p.end_date || null,
    is_closed: p.is_closed || false,
    geschatte_kost: Number(p.geschatte_kost || 0),
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
  return (data || []).map((c) => ({
    ...c,
    correctie_bedrag: Number(c.correctie_bedrag || 0),
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
    ...data,
    correctie_bedrag: Number(data.correctie_bedrag),
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
    return (data || []).map(p => ({
        ...p,
        variants: (p as any).variants || []
    }));
}

export async function saveShopProduct(product: Partial<import('../types').ShopProduct>): Promise<import('../types').ShopProduct> {
    const { data, error } = await supabase
        .from('shop_products')
        .upsert(product as any)
        .select('*, variants:shop_variants(*)')
        .single();
    if (error) throw error;
    return {
        ...data,
        variants: (data as any).variants || []
    };
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

// ==================== FRITUUR ADMIN DASHBOARD ====================

export async function fetchAllFrituurSessies(): Promise<any[]> {
  const { data, error } = await supabase
    .from('frituur_sessies')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAllFrituurBestellingen(): Promise<any[]> {
  const { data, error } = await supabase
    .from('frituur_bestellingen')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateFrituurBestelling(id: string, totaalPrijs: number, items: any[]): Promise<void> {
  const { error } = await supabase
    .from('frituur_bestellingen')
    .update({ totaal_prijs: totaalPrijs, items: items as any })
    .eq('id', id);

  if (error) throw error;
}

/** Trigger een backup van de huidige spreadsheet via de Edge Function */
export async function backupSpreadsheet(spreadsheetId: string, title?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('google-sheets-sync', {
    body: { command: 'backup_spreadsheet', payload: { spreadsheetId, title } }
  });
  if (error) throw error;
}

export async function savePushToken(userId: string, token: string, platform: string): Promise<void> {
  const { error } = await supabase
    .from('user_push_tokens')
    .upsert({ user_id: userId, token, device_type: platform }, { onConflict: 'token' });
  if (error) throw error;
}
