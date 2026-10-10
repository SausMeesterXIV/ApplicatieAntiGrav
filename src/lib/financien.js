// Financiën: database en koppeling met de Google Sheet. Rekenhulp staat in financienReken.js.
import { supabase } from './supabase';
import { euro } from './geld';

export * from './financienReken';

// ==================== Database ====================

const naarPost = r => ({ ...r, bedrag: Number(r.bedrag || 0) });

/** Drankfacturen + andere betalingen. Financiën/hoofdleiding: iedereen; anders enkel de eigen. */
export async function fetchPosten() {
  const { data, error } = await supabase.rpc('financien_overzicht');
  if (error) throw error;
  return (data || []).map(naarPost);
}

export async function zetBetaald(soort, id, betaald) {
  const { error } = await supabase.rpc('zet_betaald', { p_soort: soort, p_id: id, p_betaald: betaald });
  if (error) throw error;
}

/** Nieuwe betaling voor een selectie leiding: posten = [{ user_id, bedrag }] */
export async function maakBetaling({ titel, omschrijving, vervaldatum, standaardBedrag, posten, aangemaaktDoor }) {
  const { data, error } = await supabase
    .from('betalingen')
    .insert({
      titel: titel.trim(),
      omschrijving: omschrijving?.trim() || null,
      vervaldatum: vervaldatum || null,
      standaard_bedrag: standaardBedrag,
      aangemaakt_door: aangemaaktDoor,
    })
    .select('id')
    .single();
  if (error) throw error;
  await voegPostenToe(data.id, posten);
  return data.id;
}

export async function voegPostenToe(betalingId, posten) {
  if (!posten.length) return;
  const { error } = await supabase
    .from('betaling_posten')
    .insert(posten.map(p => ({ betaling_id: betalingId, user_id: p.user_id, bedrag: p.bedrag })));
  if (error) throw error;
}

export async function updateBetaling(id, velden) {
  const { error } = await supabase.from('betalingen').update(velden).eq('id', id);
  if (error) throw error;
}

export async function verwijderBetaling(id) {
  const { error } = await supabase.from('betalingen').delete().eq('id', id);
  if (error) throw error;
}

export async function updatePost(id, velden) {
  const { error } = await supabase.from('betaling_posten').update(velden).eq('id', id);
  if (error) throw error;
}

export async function verwijderPost(id) {
  const { error } = await supabase.from('betaling_posten').delete().eq('id', id);
  if (error) throw error;
}

/** Schatting van de lopende drankperiode (Financiën ziet iedereen) */
export async function fetchSchattingen() {
  const { data, error } = await supabase.rpc('periode_overzicht', { p_period_id: null, p_echte_kost: null });
  if (error) throw error;
  return data || [];
}

// ==================== Google Sheet ====================

export async function fetchSheetKoppeling() {
  const { data, error } = await supabase.from('financien_sheet').select('*').maybeSingle();
  if (error) throw error;
  return data;
}

/** actie: 'aanmaken' | 'sync' | 'koppeling' (extra: { aan: true/false }) */
export async function sheetActie(actie, extra = {}) {
  const { data, error } = await supabase.functions.invoke('financien-sheet', { body: { actie, ...extra } });
  if (error) {
    let bericht = null;
    try {
      bericht = (await error.context.json()).error;
    } catch {
      // geen JSON-antwoord (bv. functie nog niet gedeployed)
    }
    throw new Error(bericht || 'De koppeling met Google Sheets werkt nog niet (functie niet beschikbaar).');
  }
  return data;
}

// ==================== Herinneringen ====================

/**
 * Stuurt elke leider met een open bedrag een melding (en push): één per leider, met het totaal.
 * posten: de open posten waarvoor herinnerd wordt. Geeft het aantal verstuurde meldingen terug.
 */
export async function herinner(zender, posten, context) {
  const perLeider = new Map();
  for (const p of posten) {
    if (p.status === 'betaald' || !(Number(p.bedrag) > 0)) continue;
    const l = perLeider.get(p.user_id) || { bedrag: 0, titels: [] };
    l.bedrag += Number(p.bedrag);
    if (!l.titels.includes(p.titel)) l.titels.push(p.titel);
    perLeider.set(p.user_id, l);
  }
  const rijen = [...perLeider.entries()].map(([userId, l]) => ({
    zender_id: zender.id,
    ontvanger_id: userId,
    zender_naam: zender.nickname || zender.naam || null,
    titel: 'Herinnering: nog te betalen',
    bericht: `Je moet nog ${euro(l.bedrag)} betalen voor ${context || l.titels.join(', ')}. In "Mijn rekening" vind je de QR-code en de mededeling.`,
    action: '/mijn-factuur',
    type: 'official',
  }));
  if (!rijen.length) return 0;
  const { error } = await supabase.from('notificaties').insert(rijen);
  if (error) throw error;
  return rijen.length;
}

