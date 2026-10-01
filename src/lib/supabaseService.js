import { supabase } from './supabase';
import { formatTimeAgo } from './utils';

// Eén rij verwijderen en nagaan dat het echt gebeurde: zonder recht verwijdert RLS stil niets (geen fout).
async function verwijderRij(tabel, id, geenRechtMelding) {
  const { data, error } = await supabase.from(tabel).delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw new Error(geenRechtMelding);
}

// ==================== PROFILES ====================

export async function fetchAllProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('naam');

  if (error) throw error;
  return (data || []).map(mapProfileToUser);
}

export async function updateProfile(userId, updates) {
  const { error } = await supabase.from('profiles').update(updates).eq('id', userId);
  if (error) throw error;
}

function mapProfileToUser(p) {
  return {
    ...p,
    name: p.naam,
    avatar: p.avatar_url || null, // Geen pravatar fallback meer
    avatar_url: p.avatar_url || null,
    roles: p.roles || [],
    quickDrinkId: p.quick_drink_id || undefined,
    balance: 0,
  };
}

// ==================== AVATAR UPLOAD ====================

export async function uploadAvatar(userId, file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `${userId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Upload file to avatars bucket
  const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  // Get public URL
  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);

  const publicUrl = data.publicUrl;

  // Update profile with new URL
  await updateProfile(userId, { avatar_url: publicUrl });

  return publicUrl;
}

// ==================== DRANKEN ====================

export async function fetchDranken() {
  const { data, error } = await supabase.from('dranken').select('*').order('naam');
  if (error) throw error;
  return (data || []).filter(isActiveDrank).map(mapDrank);
}

// Vaste dranken altijd; tijdelijke dranken enkel tot en met hun valid_until-datum
function isActiveDrank(d) {
  if (!d.is_temporary || !d.valid_until) return true;
  const today = new Date().toISOString().slice(0, 10);
  return d.valid_until.slice(0, 10) >= today;
}

function mapDrank(d) {
  return {
    ...d,
    name: d.naam,
    price: Number(d.prijs),
    isTemporary: d.is_temporary,
    validUntil: d.valid_until || undefined,
    categorie: d.categorie,
  };
}

export async function addDrank(naam, prijs, isTemporary = false, validUntil) {
  const { data, error } = await supabase
    .from('dranken')
    .insert([{ naam, prijs, is_temporary: isTemporary, valid_until: validUntil || null }])
    .select()
    .single();
  if (error) throw error;
  return mapDrank(data);
}

export async function updateDrank(id, naam, prijs) {
  const { error } = await supabase.from('dranken').update({ naam, prijs }).eq('id', String(id));
  if (error) throw error;
}

export async function deleteDrank(id) {
  const { error } = await supabase.from('dranken').delete().eq('id', String(id));
  if (error) throw error;
}

// ==================== CONSUMPTIES (Streaks) ====================

export async function fetchConsumpties(userId) {
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
    userName: c.profiles?.naam || c.user_naam || 'Onbekend',
    drinkId: c.drank_id,
    drinkName: c.dranken?.naam || 'Onbekend',
    price: Number(c.prijs ?? c.dranken?.prijs ?? 0), // prijs per stuk; totaal = price * amount
    amount: c.aantal,
    timestamp: new Date(c.datum),
    period_id: c.period_id || undefined,
    factuurId: c.factuur_id || null,
  }));
}

export async function addConsumptie(userId, drankId, aantal = 1, periodId, userNaam) {
  const { data, error } = await supabase.rpc('streep_drank', {
    p_user_id: userId,
    p_drank_id: drankId,
    p_aantal: aantal,
    p_period_id: periodId || null,
  });

  if (error) throw error;
  return data;
}

export async function deleteConsumptie(id) {
  // Eigen streep: enkel binnen 1 uur en niet gefactureerd; Drankteam: altijd
  await verwijderRij('consumpties', id, 'Deze streep kan je niet (meer) verwijderen');
}

async function fetchAllBalancesOud() {
  const [consumptiesResult, frituurResult, correctionsResult] = await Promise.all([
    supabase.from('consumpties').select('user_id, aantal, dranken(prijs)').is('factuur_id', null),
    supabase.from('frituur_bestellingen').select('user_id, totaal_prijs').is('period_id', null),
    supabase.from('billing_corrections').select('user_id, correctie_bedrag'),
  ]);

  if (consumptiesResult.error) throw consumptiesResult.error;
  if (frituurResult.error) throw frituurResult.error;
  if (correctionsResult.error) throw correctionsResult.error;

  const balances = {};

  (consumptiesResult.data || []).forEach(c => {
    const amount = c.aantal * Number(c.dranken?.prijs || 0);
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

// Saldo's volgens periode_overzicht() in de database: dezelfde berekening als de factuur.
// Gewone leiding krijgt enkel de eigen rij, Drankteam iedereen (afgedwongen in de functie).
// echteKost (optioneel, bij het afsluiten): wordt verdeeld over alle strepen; anders aantal x prijs (schatting)
export async function fetchPeriodeOverzicht(periodId = null, echteKost = null) {
  const { data, error } = await supabase.rpc('periode_overzicht', { p_period_id: periodId, p_echte_kost: echteKost });
  if (error) throw error;
  return (data || []).map(r => ({
    ...r,
    strepen: Number(r.strepen || 0),
    drank_bedrag: Number(r.drank_bedrag || 0),
    friet_bedrag: Number(r.friet_bedrag || 0),
    correctie_bedrag: Number(r.correctie_bedrag || 0),
    totaal: Number(r.totaal || 0),
  }));
}

const isFunctieOntbreekt = error =>
  error?.code === 'PGRST202' || /Could not find the function/i.test(error?.message || '');

export async function fetchAllBalances() {
  try {
    const rows = await fetchPeriodeOverzicht();
    return Object.fromEntries(rows.map(r => [r.user_id, r.totaal]));
  } catch (error) {
    if (!isFunctieOntbreekt(error)) throw error;
    console.warn('periode_overzicht ontbreekt (migratie nog niet uitgevoerd?), oude berekening gebruikt');
    return fetchAllBalancesOud();
  }
}

// ==================== FACTUREN & PERIODES (Drankteam) ====================

export async function sluitPeriodeAf(periodId = null, echteKost = null) {
  const { data, error } = await supabase.rpc('sluit_periode_af', { p_period_id: periodId, p_echte_kost: echteKost });
  if (error) throw error;
  return data;
}

export async function fetchRanking() {
  const { data, error } = await supabase.rpc('ranking_huidige_periode');
  if (error) throw error;
  return (data || []).map(r => ({ ...r, strepen: Number(r.strepen || 0) }));
}

export async function corrigeerVoorraad(drankId, nieuweVoorraad, notitie) {
  const { error } = await supabase.rpc('corrigeer_voorraad', {
    p_drank_id: drankId,
    p_nieuwe_voorraad: nieuweVoorraad,
    p_notitie: notitie || null,
  });
  if (error) throw error;
}

// ==================== EVENTS ====================

export async function fetchEvents() {
  const { data, error } = await supabase.from('events').select('*').order('datum', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapEvent);
}

// ==================== AANWEZIGHEID (agenda) ====================

/** Alle aanwezigheden; [] als de tabel nog niet gemigreerd is. */
export async function fetchAanwezigheden() {
  const { data, error } = await supabase.from('event_aanwezigheid').select('event_id, user_id, status');
  if (error) {
    console.warn('Aanwezigheid niet beschikbaar (migratie nog niet uitgevoerd?)', error.message);
    return [];
  }
  return data || [];
}

/** status: 'komt' | 'komt_niet' | 'misschien' | null (null = wissen) */
export async function setAanwezigheid(eventId, userId, status) {
  if (!status) {
    const { error } = await supabase.from('event_aanwezigheid').delete().eq('event_id', eventId).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase
    .from('event_aanwezigheid')
    .upsert({ event_id: eventId, user_id: userId, status, updated_at: new Date().toISOString() });
  if (error) throw error;
}

// Datum als YYYY-MM-DD in lokale tijd (toISOString rekent in UTC en schuift items vóór 2u naar de vorige dag)
const lokaleDatum = d =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export async function saveEvent(event) {
  const payload = {
    titel: event.title,
    datum: event.date instanceof Date ? lokaleDatum(event.date) : String(event.date),
    tijd: event.startTime || '20:00',
    locatie: event.location,
    type: event.type,
    start_time: event.startTime || null,
    end_time: event.endTime || null,
    responsible: event.responsible || null,
    beschrijving: event.description || null,
  };

  const isNew = !event.id || event.id.startsWith('temp-') || !event.id.includes('-');

  if (isNew) {
    const { data, error } = await supabase.from('events').insert([payload]).select().single();
    if (error) throw error;
    return mapEvent(data);
  } else {
    const { data, error } = await supabase.from('events').update(payload).eq('id', event.id).select().single();
    if (error) throw error;
    return mapEvent(data);
  }
}

function mapEvent(e) {
  return {
    ...e,
    title: e.titel,
    location: e.locatie,
    description: e.beschrijving,
    startTime: e.start_time || e.tijd || '20:00',
    endTime: e.end_time || null,
    date: new Date(e.datum),
    createdBy: e.created_by || null,
  };
}

export async function deleteEvent(id) {
  await verwijderMetBijlagen({ eventId: id }, () =>
    verwijderRij('events', id, 'Je kan enkel je eigen agenda-items verwijderen'),
  );
}

// ==================== BIJLAGEN (agenda en verslagen) ====================
// Privé-bucket 'bijlagen'; openen via een tijdelijke link. RLS bepaalt wie mag toevoegen/verwijderen.

export const MAX_BIJLAGE_MB = 10;

const bijlageFilter = ({ eventId, verslagId }) => (eventId ? ['event_id', eventId] : ['verslag_id', verslagId]);

export async function fetchBijlagen(item) {
  const [kolom, id] = bijlageFilter(item);
  const { data, error } = await supabase.from('bijlagen').select('*').eq(kolom, id).order('created_at');
  if (error) throw error;
  return data || [];
}

export async function uploadBijlage({ eventId, verslagId }, file) {
  if (file.size > MAX_BIJLAGE_MB * 1024 * 1024) {
    throw new Error(`${file.name} is groter dan ${MAX_BIJLAGE_MB} MB`);
  }
  const map = eventId ? `agenda/${eventId}` : `verslagen/${verslagId}`;
  const veiligeNaam = file.name.replace(/[^\w.-]+/g, '_');
  const pad = `${map}/${Date.now()}-${veiligeNaam}`;

  const { error: uploadError } = await supabase.storage.from('bijlagen').upload(pad, file);
  if (uploadError) throw uploadError;

  const { data, error } = await supabase
    .from('bijlagen')
    .insert({
      event_id: eventId || null,
      verslag_id: verslagId || null,
      pad,
      naam: file.name,
      grootte: file.size,
      mime: file.type || null,
    })
    .select()
    .single();
  if (error) {
    await supabase.storage.from('bijlagen').remove([pad]); // geen losse bestanden achterlaten
    throw error;
  }
  return data;
}

export async function verwijderBijlage(bijlage) {
  await verwijderRij('bijlagen', bijlage.id, 'Je kan deze bijlage niet verwijderen');
  await supabase.storage.from('bijlagen').remove([bijlage.pad]);
}

/** Tijdelijke link (1 uur) om een bijlage te openen of te downloaden. */
export async function bijlageLink(bijlage) {
  const { data, error } = await supabase.storage.from('bijlagen').createSignedUrl(bijlage.pad, 3600);
  if (error) throw error;
  return data.signedUrl;
}

// Een agenda-item of verslag verwijderen, samen met de bestanden van de bijlagen.
// Eerst het item (de bijlage-rijen gaan mee via cascade); pas als dat lukte, de bestanden.
async function verwijderMetBijlagen(item, verwijder) {
  let paden = [];
  try {
    paden = (await fetchBijlagen(item)).map(b => b.pad);
  } catch (e) {
    console.warn('Bijlagen ophalen mislukt (migratie nog niet uitgevoerd?)', e);
  }
  await verwijder();
  if (paden.length) {
    const { error } = await supabase.storage.from('bijlagen').remove(paden);
    if (error) console.warn('Bestanden van bijlagen opruimen mislukt', error);
  }
}

// ==================== VERSLAGEN (groepsraden) ====================

export async function fetchVerslagen() {
  const { data, error } = await supabase
    .from('verslagen')
    .select('*, auteur:profiles!verslagen_auteur_id_fkey(naam, nickname), event:events(titel, datum)')
    .order('datum', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveVerslag({ id, titel, datum, inhoud, eventId }) {
  const row = { titel, datum, inhoud: inhoud || null, event_id: eventId || null };
  const query = id ? supabase.from('verslagen').update(row).eq('id', id) : supabase.from('verslagen').insert(row);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

export async function deleteVerslag(id) {
  await verwijderMetBijlagen({ verslagId: id }, () =>
    verwijderRij('verslagen', id, 'Je kan enkel je eigen verslagen verwijderen'),
  );
}

// ==================== NOTIFICATIES ====================

export async function fetchNotificaties(userId) {
  const vraag = velden =>
    supabase
      .from('notificaties')
      .select(`*, profiles!notificaties_zender_id_fkey(${velden})`)
      .or(`ontvanger_id.eq.all,ontvanger_id.eq.${userId}`)
      .order('datum', { ascending: false });

  let { data, error } = await vraag('naam, is_hoofdleiding');
  // Vóór migratie 000100 bestaat is_hoofdleiding nog niet (fout 42703): zonder dat veld opnieuw
  if (error?.code === '42703') ({ data, error } = await vraag('naam'));
  if (error) throw error;

  const gelezen = await fetchGelezen(userId, data || []);
  return (data || []).map(n => mapNotificatie(n, n.profiles, gelezen));
}

// Lokaal onthouden gelezen meldingen (van vóór de tabel notificatie_gelezen, en als snelle buffer)
function lokaalGelezen() {
  try {
    return JSON.parse(localStorage.getItem('antigrav_seen_notifs') || '[]').map(String);
  } catch {
    return [];
  }
}

// Gelezen meldingen aan iedereen ('all') voor deze leider, uit de database: op elk toestel hetzelfde.
// Wat enkel op dit toestel als gelezen stond, wordt eenmalig mee naar de database gezet.
async function fetchGelezen(userId, meldingen) {
  const { data, error } = await supabase.from('notificatie_gelezen').select('notificatie_id').eq('user_id', userId);
  if (error) {
    console.warn('Gelezen-status niet beschikbaar (migratie 002200?)', error.message);
    return new Set();
  }
  const gelezen = new Set((data || []).map(r => String(r.notificatie_id)));
  const lokaal = new Set(lokaalGelezen());
  const nogTeBewaren = meldingen
    .filter(n => n.ontvanger_id === 'all' && lokaal.has(String(n.id)) && !gelezen.has(String(n.id)))
    .map(n => ({ notificatie_id: n.id, user_id: userId }));
  if (nogTeBewaren.length) {
    const { error: fout } = await supabase
      .from('notificatie_gelezen')
      .upsert(nogTeBewaren, { onConflict: 'notificatie_id,user_id', ignoreDuplicates: true });
    if (!fout) nogTeBewaren.forEach(r => gelezen.add(String(r.notificatie_id)));
  }
  return gelezen;
}

/** Melding als gelezen markeren: persoonlijke via de eigen vlag, meldingen aan iedereen per leider. */
export async function markeerGelezen(melding, userId) {
  if (melding.ontvanger_id === 'all') {
    const { error } = await supabase
      .from('notificatie_gelezen')
      .upsert(
        { notificatie_id: melding.id, user_id: userId },
        { onConflict: 'notificatie_id,user_id', ignoreDuplicates: true },
      );
    if (error) throw error;
  } else {
    await markNotificatieGelezen(melding.id);
  }
}

// Eén vertaling voor geladen én live (realtime) meldingen. zender = { naam, is_hoofdleiding } indien bekend.
// gelezen: Set met id's van meldingen aan iedereen die deze leider al las (uit de database).
export function mapNotificatie(n, zender, gelezen = new Set()) {
  const seenIds = lokaalGelezen();
  const type = n.type || 'official';

  return {
    ...n,
    senderId: n.zender_id,
    id: String(n.id),
    type,
    sender: zender?.naam || n.zender_naam || 'Systeem',
    role: zender?.is_hoofdleiding ? 'Hoofdleiding' : '',
    title: n.titel,
    content: n.bericht || '',
    time: formatTimeAgo(new Date(n.datum)),
    isRead: !!n.gelezen || gelezen.has(String(n.id)) || seenIds.includes(String(n.id)),
    action: n.action,
    icon: type === 'nudge' ? 'touch_app' : 'notifications',
    color: type === 'nudge' ? 'bg-orange-100 text-orange-600' : 'bg-blue-100 text-blue-600',
  };
}

export async function addNotificatie(zenderId, ontvangerId, titel, bericht, zenderNaam, action, type = 'official') {
  const { error } = await supabase.from('notificaties').insert([
    {
      zender_id: zenderId,
      ontvanger_id: ontvangerId,
      titel,
      bericht,
      zender_naam: zenderNaam || null,
      action: action || null,
      type: type,
    },
  ]);
  if (error) throw error;
}

export async function markNotificatieGelezen(id) {
  const { error } = await supabase.from('notificaties').update({ gelezen: true }).eq('id', id);
  if (error) throw error;
}

// ==================== FRITUUR ====================

export async function fetchActiveFrituurSessie() {
  const { data, error } = await supabase
    .from('frituur_sessies')
    .select('*')
    .neq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) throw error;
  if (!data || data.length === 0) return null;
  return {
    id: data[0].id,
    status: data[0].status,
    pickupTime: data[0].pickup_time,
    gestart: data[0].created_at ? new Date(data[0].created_at) : null,
  };
}

export async function createFrituurSessie(createdBy) {
  const { data, error } = await supabase
    .from('frituur_sessies')
    .insert([{ status: 'open', created_by: createdBy }])
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function updateFrituurSessie(sessieId, updates) {
  const { error } = await supabase.from('frituur_sessies').update(updates).eq('id', sessieId);
  if (error) throw error;
}

export async function uploadReceipt(sessieId, file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `receipt-${sessieId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  // Upload file to receipts bucket
  const { error: uploadError } = await supabase.storage.from('receipts').upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  // De bucket is privé: we bewaren het pad, de link wordt pas bij het bekijken gemaakt (kasticketLink)
  return filePath;
}

// receipt_url bevat het pad, of (oudere rondes) een volledige publieke URL
function kasticketPad(waarde) {
  const i = waarde.indexOf('/receipts/');
  return i >= 0 ? decodeURIComponent(waarde.slice(i + '/receipts/'.length).split('?')[0]) : waarde;
}

/** Tijdelijke link (1 uur) naar een kasticket; enkel leiding mag ze aanvragen (storage-policy). */
export async function kasticketLink(receiptUrl) {
  if (!receiptUrl) return null;
  const { data, error } = await supabase.storage.from('receipts').createSignedUrl(kasticketPad(receiptUrl), 3600);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchFrituurBestellingen(sessieId) {
  let query = supabase.from('frituur_bestellingen').select('*').order('created_at', { ascending: false });

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
    status: b.status, // Directe cast naar DB type
    periodId: b.period_id || undefined,
    factuurId: b.factuur_id || null,
  }));
}

// ==================== FRITUUR MENU ITEMS ====================

export async function fetchFryItems() {
  const { data, error } = await supabase.from('frituur_items').select('*').order('category').order('name');

  if (error) throw error;
  return (data || []).map(i => ({
    ...i,
    category: i.category,
    description: i.description ?? null,
  }));
}

export async function addFryItem(item) {
  const { data, error } = await supabase.from('frituur_items').insert([item]).select('id').single();

  if (error) throw error;
  return data.id;
}

export async function updateFryItem(id, updates) {
  const { error } = await supabase.from('frituur_items').update(updates).eq('id', id);

  if (error) throw error;
}

export async function deleteFryItem(id) {
  const { error } = await supabase.from('frituur_items').delete().eq('id', id);

  if (error) throw error;
}

export async function addFrituurBestelling(userId, userName, sessieId, items, totaalPrijs, periodId) {
  // Maak een veilige snack_naam, zelfs als items leeg is of stukgaat
  let veiligeSnackNaam = 'Bestelling via App';
  if (items && items.length > 0) {
    veiligeSnackNaam = items
      .map(i => i.name)
      .join(', ')
      .substring(0, 200);
  }

  const { data, error } = await supabase
    .from('frituur_bestellingen')
    .insert([
      {
        user_id: userId,
        user_name: userName,
        sessie_id: sessieId,
        snack_naam: veiligeSnackNaam,
        items: items || [],
        totaal_prijs: totaalPrijs,
        status: 'open',
        period_id: periodId || null,
      },
    ])
    .select('id')
    .single();

  if (error) {
    console.error('❌ Definitieve DB Fout:', error.message, error.details);
    throw error;
  }
  return data.id;
}

export async function deleteFrituurBestelling(id) {
  await verwijderRij('frituur_bestellingen', id, 'Je kan deze bestelling niet (meer) annuleren');
}

export async function finalizeFrituurSessie(sessieId, actualAmount) {
  const { data, error } = await supabase.rpc('finalize_frituur_sessie', {
    p_sessie_id: sessieId,
    p_actual_amount: actualAmount,
  });

  if (error) throw error;
  return data;
}

// ==================== STOCK ITEMS ====================

export async function fetchStockItems() {
  const { data, error } = await supabase.from('stock_items').select('*').order('name');

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

export async function addStockItem(item) {
  const { error } = await supabase.from('stock_items').insert([
    {
      name: item.name || '',
      label: item.label || null,
      category: item.category || null,
      count: item.count || 0,
      unit: item.unit || null,
      expiry_date: item.exp || null,
      urgent: item.urgent || false,
      icon: item.icon || null,
      color: item.color || null,
    },
  ]);
  if (error) throw error;
}

export async function updateStockItem(supabaseId, updates) {
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

export async function deleteStockItem(supabaseId) {
  const { error } = await supabase.from('stock_items').delete().eq('id', supabaseId);
  if (error) throw error;
}

// ==================== FACTUREN ====================

export async function fetchFacturen(userId) {
  let query = supabase.from('facturen').select('*, profiles(naam)').order('created_at', { ascending: false });

  if (userId) {
    query = query.eq('user_id', userId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(f => ({
    ...f,
    totaal_bedrag: Number(f.totaal_bedrag || 0),
    drank_bedrag: Number(f.drank_bedrag || 0),
    friet_bedrag: Number(f.friet_bedrag || 0),
    correctie_bedrag: Number(f.correctie_bedrag || 0),
  }));
}

// Rekeninggegevens voor de betaal-QR (ingesteld door Drankteam)
export async function fetchBetaalgegevens() {
  const [naam, iban, bic] = await Promise.all([
    fetchSetting('betaal_naam'),
    fetchSetting('betaal_iban'),
    fetchSetting('betaal_bic'),
  ]);
  return { naam: naam || '', iban: iban || '', bic: bic || '' };
}

export async function saveBetaalgegevens({ naam, iban, bic }) {
  await Promise.all([
    updateSetting('betaal_naam', naam || ''),
    updateSetting('betaal_iban', iban || ''),
    updateSetting('betaal_bic', bic || ''),
  ]);
}

export async function updateFactuurStatus(id, status) {
  const { error } = await supabase.from('facturen').update({ status }).eq('id', id);
  if (error) throw error;
}

// ==================== COUNTDOWNS ====================

export async function fetchCountdowns() {
  const { data, error } = await supabase.from('countdowns').select('*');
  if (error) throw error;
  return (data || []).map(c => ({
    ...c,
    targetDate: new Date(c.target_date),
  }));
}

export async function saveCountdowns(countdowns) {
  const payload = countdowns.map(c => ({
    id: c.id,
    title: c.title,
    target_date: c.targetDate instanceof Date ? c.targetDate.toISOString().split('T')[0] : String(c.targetDate),
  }));

  const { data: existing } = await supabase.from('countdowns').select('id');
  const toDelete = (existing || []).map(r => r.id).filter(id => !countdowns.map(c => c.id).includes(id));

  if (toDelete.length > 0) await supabase.from('countdowns').delete().in('id', toDelete);
  if (payload.length > 0) {
    const { error } = await supabase.from('countdowns').upsert(payload, { onConflict: 'id' });
    if (error) throw error;
  }
}

// ==================== APP SETTINGS ====================

// ==================== BILLING PERIODS ====================

export function calculateWerkjaar(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-11, Aug is 7
  const day = date.getDate();

  if (month < 7 || (month === 7 && day < 15)) {
    return `${year - 1}-${year}`;
  } else {
    return `${year}-${year + 1}`;
  }
}

export async function fetchBillingPeriods() {
  const { data, error } = await supabase
    .from('billing_periods')
    .select('*')
    .order('werkjaar', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapBillingPeriod);
}

export async function fetchOpenBillingPeriod() {
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

export async function createBillingPeriod(payload) {
  const startDatum = payload.start_datum ? new Date(payload.start_datum) : new Date();
  const werkjaar = calculateWerkjaar(startDatum);

  const { data, error } = await supabase
    .from('billing_periods')
    .insert([
      {
        naam: payload.naam,
        start_datum: startDatum.toISOString(),
        is_closed: false,
        geschatte_kost: payload.geschatte_kost || 0,
        werkjaar: werkjaar,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return mapBillingPeriod(data);
}

export async function updateBillingPeriod(id, updates) {
  const { error } = await supabase.from('billing_periods').update(updates).eq('id', id);

  if (error) throw error;
}

function mapBillingPeriod(p) {
  return {
    ...p,
    naam: p.naam || p.name || '',
    start_datum: p.start_datum || p.start_date || '',
    eind_datum: p.eind_datum || p.end_date || null,
    is_closed: p.is_closed || false,
    geschatte_kost: Number(p.geschatte_kost || 0),
    echte_kost: p.echte_kost == null ? null : Number(p.echte_kost),
  };
}

// ==================== BILLING CORRECTIONS ====================

export async function fetchBillingCorrections(periodId) {
  const { data, error } = await supabase
    .from('billing_corrections')
    .select('*')
    .eq('period_id', periodId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(c => ({
    ...c,
    correctie_bedrag: Number(c.correctie_bedrag || 0),
  }));
}

export async function addBillingCorrection(userId, periodId, bedrag, notitie, userNaam) {
  const { data, error } = await supabase
    .from('billing_corrections')
    .insert([
      {
        user_id: userId,
        period_id: periodId,
        correctie_bedrag: bedrag,
        notitie: notitie || null,
        user_naam: userNaam || null,
      },
    ])
    .select()
    .single();

  if (error) throw error;
  return {
    ...data,
    correctie_bedrag: Number(data.correctie_bedrag),
  };
}

// ==================== APP SETTINGS ====================

export async function fetchSetting(key) {
  const { data, error } = await supabase.from('app_settings').select('value').eq('key', key).single();

  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = not found
  return data?.value || null;
}

export async function updateSetting(key, value) {
  const { error } = await supabase.from('app_settings').upsert({ key, value, updated_at: new Date().toISOString() });

  if (error) throw error;
}

export async function fetchAvailableRoles() {
  const data = await fetchSetting('available_roles');
  if (data) {
    try {
      return JSON.parse(data);
    } catch (e) {
      console.error('Failed to parse available_roles', e);
    }
  }
  return [];
}

// ==================== ROLLEN (groepen, werkgroepen, hoofdleiding) ====================

/** Haalt groepen, werkgroepen en lidmaatschappen op. Geeft null als de tabellen nog niet gemigreerd zijn. */
export async function fetchRolData() {
  const [groepen, werkgroepen, profielGroepen, profielWerkgroepen] = await Promise.all([
    supabase.from('groepen').select('*').order('volgorde'),
    supabase.from('werkgroepen').select('*').order('naam'),
    supabase.from('profiel_groepen').select('profile_id, groep_id'),
    supabase.from('profiel_werkgroepen').select('profile_id, werkgroep_id'),
  ]);
  const fout = groepen.error || werkgroepen.error || profielGroepen.error || profielWerkgroepen.error;
  if (fout) {
    console.warn('Rollentabellen niet beschikbaar (migratie nog niet uitgevoerd?)', fout.message);
    return null;
  }
  return {
    groepen: groepen.data || [],
    werkgroepen: werkgroepen.data || [],
    profielGroepen: profielGroepen.data || [],
    profielWerkgroepen: profielWerkgroepen.data || [],
  };
}

export async function saveWerkgroep({ id, naam, rechten }) {
  const row = { naam: naam.trim(), rechten: rechten || [] };
  const query = id
    ? supabase.from('werkgroepen').update(row).eq('id', id).select().single()
    : supabase.from('werkgroepen').insert(row).select().single();
  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function deleteWerkgroep(id) {
  const { error } = await supabase.from('werkgroepen').delete().eq('id', id);
  if (error) throw error;
}

/** Vervangt de groepen van één leider door de gegeven lijst. */
export async function setProfielGroepen(profileId, groepIds) {
  const { error: delError } = await supabase.from('profiel_groepen').delete().eq('profile_id', profileId);
  if (delError) throw delError;
  if (groepIds.length === 0) return;
  const { error } = await supabase
    .from('profiel_groepen')
    .insert(groepIds.map(groep_id => ({ profile_id: profileId, groep_id })));
  if (error) throw error;
}

/** Vervangt de werkgroepen van één leider door de gegeven lijst. */
export async function setProfielWerkgroepen(profileId, werkgroepIds) {
  const { error: delError } = await supabase.from('profiel_werkgroepen').delete().eq('profile_id', profileId);
  if (delError) throw delError;
  if (werkgroepIds.length === 0) return;
  const { error } = await supabase
    .from('profiel_werkgroepen')
    .insert(werkgroepIds.map(werkgroep_id => ({ profile_id: profileId, werkgroep_id })));
  if (error) throw error;
}

export async function setHoofdleiding(profileId, isHoofdleiding) {
  const { error } = await supabase.from('profiles').update({ is_hoofdleiding: isHoofdleiding }).eq('id', profileId);
  if (error) throw error;
}

export async function setProfielActief(profileId, actief) {
  const { error } = await supabase.from('profiles').update({ actief }).eq('id', profileId);
  if (error) throw error;
}

// ==================== SHOP ====================

export async function fetchShopProducts(category) {
  let query = supabase.from('shop_products').select('*, variants:shop_variants(*)');
  if (category) query = query.eq('category', category);
  const { data, error } = await query.order('name');
  if (error) throw error;
  return (data || []).map(p => ({
    ...p,
    variants: p.variants || [],
  }));
}

export async function saveShopProduct(product) {
  const { data, error } = await supabase
    .from('shop_products')
    .upsert(product)
    .select('*, variants:shop_variants(*)')
    .single();
  if (error) throw error;
  return {
    ...data,
    variants: data.variants || [],
  };
}

export async function deleteShopProduct(id) {
  const { error } = await supabase.from('shop_products').delete().eq('id', id);
  if (error) throw error;
}

export async function updateShopVariantStock(variantId, newStock) {
  const { error } = await supabase.from('shop_variants').update({ stock: newStock }).eq('id', variantId);
  if (error) throw error;
}

export async function addShopVariant(productId, name, stock = 0) {
  const { data, error } = await supabase
    .from('shop_variants')
    .insert([{ product_id: productId, name, stock }])
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deleteShopVariant(id) {
  const { error } = await supabase.from('shop_variants').delete().eq('id', id);
  if (error) throw error;
}

export async function uploadShopImage(productId, file) {
  const fileExt = file.name.split('.').pop();
  const fileName = `shop-${productId}-${Date.now()}.${fileExt}`;
  const filePath = `${fileName}`;

  const { error: uploadError } = await supabase.storage.from('shop-images').upload(filePath, file, { upsert: true });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('shop-images').getPublicUrl(filePath);
  return data.publicUrl;
}

// ==================== FRITUUR ADMIN DASHBOARD ====================

export async function fetchAllFrituurSessies() {
  const { data, error } = await supabase.from('frituur_sessies').select('*').order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function fetchAllFrituurBestellingen() {
  const { data, error } = await supabase
    .from('frituur_bestellingen')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data || [];
}

export async function updateFrituurBestelling(id, totaalPrijs, items) {
  const { error } = await supabase
    .from('frituur_bestellingen')
    .update({ totaal_prijs: totaalPrijs, items: items })
    .eq('id', id);

  if (error) throw error;
}

// ==================== BERICHTEN ====================

/** Verstuurt een bericht via de database (rechtencontrole + ontvangers bepalen). Geeft het aantal ontvangers. */
export async function stuurBericht({ doel, doelId, personen, titel, bericht, afzenderNaam }) {
  const { data, error } = await supabase.rpc('stuur_bericht', {
    p_doel: doel,
    p_doel_id: doelId,
    p_personen: personen,
    p_titel: titel,
    p_bericht: bericht,
    p_afzender_naam: afzenderNaam,
  });
  if (error) throw error;
  return data || 0;
}

// ==================== POLLS ====================

/** Alle polls met opties en stemmen; [] als de tabellen nog niet gemigreerd zijn. */
export async function fetchPolls() {
  const { data, error } = await supabase
    .from('polls')
    // Relaties expliciet benoemd: poll_stemmen verwijst naar polls én poll_opties
    .select('*, poll_opties!poll_opties_poll_id_fkey(*), poll_stemmen!poll_stemmen_poll_id_fkey(user_id, optie_id)')
    .order('deadline', { ascending: false });
  if (error) {
    console.warn('Polls niet beschikbaar (migratie nog niet uitgevoerd?)', error.message);
    return [];
  }
  return (data || []).map(p => ({
    ...p,
    opties: [...(p.poll_opties || [])].sort((a, b) => a.volgorde - b.volgorde),
    stemmen: p.poll_stemmen || [],
    isOpen: new Date(p.deadline) > new Date(),
  }));
}

export async function createPoll({ vraag, opties, deadline, userId }) {
  const { data: poll, error } = await supabase
    .from('polls')
    .insert({ vraag: vraag.trim(), deadline: new Date(deadline).toISOString(), gemaakt_door: userId })
    .select()
    .single();
  if (error) throw error;
  const { error: optieError } = await supabase
    .from('poll_opties')
    .insert(opties.map((tekst, i) => ({ poll_id: poll.id, tekst: tekst.trim(), volgorde: i })));
  if (optieError) {
    await supabase.from('polls').delete().eq('id', poll.id);
    throw optieError;
  }
  return poll;
}

/** Stemmen of je stem aanpassen; optieId null trekt je stem in. */
export async function stemOpPoll(pollId, userId, optieId) {
  if (!optieId) {
    const { error } = await supabase.from('poll_stemmen').delete().eq('poll_id', pollId).eq('user_id', userId);
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('poll_stemmen').upsert({ poll_id: pollId, user_id: userId, optie_id: optieId });
  if (error) throw error;
}

export async function deletePoll(pollId) {
  await verwijderRij('polls', pollId, 'Enkel de maker of hoofdleiding kan deze poll verwijderen');
}
