// Oudleiding (account met gebruikersnaam), leidingsgroep per werkjaar en friet voor iemand zonder account.
// De database dwingt dezelfde regels af (migratie 20261001002500).
import { supabase } from './supabase';

// Oudleiding logt in met een gebruikersnaam; intern is dat <gebruikersnaam>@oudleiding.ksa-aalter.be
// (er wordt nooit naar dat adres gemaild).
export const OUDLEIDING_DOMEIN = 'oudleiding.ksa-aalter.be';

/** "jan.peeters" -> "jan.peeters@oudleiding.ksa-aalter.be"; een e-mailadres blijft zoals het is. */
export const naarLoginEmail = invoer => {
  const s = String(invoer || '')
    .trim()
    .toLowerCase();
  return s.includes('@') ? s : `${s}@${OUDLEIDING_DOMEIN}`;
};

export const gebruikersnaamVan = email =>
  String(email || '')
    .toLowerCase()
    .endsWith(`@${OUDLEIDING_DOMEIN}`)
    ? email.split('@')[0]
    : null;

export const gebruikersnaamGeldig = g => /^[a-z0-9][a-z0-9._-]{2,29}$/.test(String(g || ''));

// ==================== Leidingsgroep per werkjaar ====================

/** Werkjaar voor de groepskeuze: start op 1 september ("2026-2027"). */
export function groepWerkjaar(datum = new Date()) {
  const jaar = datum.getFullYear();
  return datum.getMonth() >= 8 ? `${jaar}-${jaar + 1}` : `${jaar - 1}-${jaar}`;
}

/** Leiding kiest elk werkjaar (en bij de eerste keer) precies één groep; oudleiding en godmode (staat buiten de leiding) niet. */
export const moetGroepKiezen = user =>
  !!user && !user.isOudleiding && user.rol !== 'godmode' && user.groep_werkjaar !== groepWerkjaar();

export async function kiesGroep(groepId) {
  const { error } = await supabase.rpc('kies_groep', { p_groep_id: groepId });
  if (error) throw error;
}

// ==================== Wat oudleiding ziet ====================

const OUDLEIDING_SCHERMEN = [
  '/',
  '/strepen',
  '/strepen/ranking',
  '/strepen/geschiedenis',
  '/mijn-factuur',
  '/frituur',
  '/frituur/overzicht',
  '/frituur/samenvatting',
  '/frituur/geschiedenis',
  '/fries-comparison',
  '/notificaties',
  '/settings',
];

export const oudleidingMag = pad => OUDLEIDING_SCHERMEN.includes(String(pad || '/').replace(/(.)\/$/, '$1'));

// ==================== Registreren en beheer ====================

async function oudleidingActie(body) {
  const { data, error } = await supabase.functions.invoke('oudleiding', {
    body,
  });
  if (error) {
    let bericht = null;
    try {
      bericht = (await error.context.json()).error;
    } catch {
      // geen JSON-antwoord (bv. functie nog niet gedeployed)
    }
    throw new Error(bericht || 'Registreren voor oudleiding werkt nog niet. Vraag het aan Drankteam.');
  }
  return data;
}

/** Oudleiding registreert met de code van Drankteam en wordt daarna meteen ingelogd. */
export async function registreerOudleiding({ naam, gebruikersnaam, wachtwoord, code }) {
  const g = String(gebruikersnaam || '')
    .trim()
    .toLowerCase();
  await oudleidingActie({
    actie: 'registreren',
    naam,
    gebruikersnaam: g,
    wachtwoord,
    code,
  });
  const { error } = await supabase.auth.signInWithPassword({
    email: naarLoginEmail(g),
    password: wachtwoord,
  });
  if (error) throw error;
}

/** Drankteam/hoofdleiding: nieuw wachtwoord voor een oudleider (die kan geen mail ontvangen). */
export const zetOudleidingWachtwoord = (userId, wachtwoord) =>
  oudleidingActie({ actie: 'wachtwoord', user_id: userId, wachtwoord });

export async function fetchOudleidingCode() {
  const { data, error } = await supabase
    .from('oudleiding_instellingen')
    .select('code, code_gewijzigd_op')
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** code null = registreren voor oudleiding uitzetten */
export async function zetOudleidingCode(code) {
  const { error } = await supabase.rpc('zet_oudleidingscode', { p_code: code });
  if (error) throw error;
}

export async function zetOudleidingActief(userId, actief) {
  const { error } = await supabase.rpc('zet_oudleiding_actief', {
    p_user_id: userId,
    p_actief: actief,
  });
  if (error) throw error;
}

// ==================== Friet voor iemand zonder account ====================

export async function addExterneFrietBestelling(externNaam, sessieId, items, totaalPrijs) {
  const { data, error } = await supabase
    .from('frituur_bestellingen')
    .insert({
      user_id: null,
      extern_naam: externNaam.trim(),
      user_name: externNaam.trim(),
      sessie_id: sessieId,
      snack_naam:
        (items || [])
          .map(i => i.name)
          .join(', ')
          .substring(0, 200) || 'Bestelling via App',
      items: items || [],
      totaal_prijs: totaalPrijs,
      status: 'open',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

export async function fetchExterneFrietBestellingen() {
  const { data, error } = await supabase
    .from('frituur_bestellingen')
    .select('*, besteller:profiles!frituur_bestellingen_besteld_door_fkey(naam, nickname)')
    .not('extern_naam', 'is', null)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function zetExternBetaald(id, betaald) {
  const { data, error } = await supabase
    .from('frituur_bestellingen')
    .update({ extern_betaald: betaald })
    .eq('id', id)
    .select('extern_betaald');
  if (error) throw error;
  if (data?.[0]?.extern_betaald !== betaald) throw new Error('Enkel Drankteam kan dit op betaald zetten');
}
