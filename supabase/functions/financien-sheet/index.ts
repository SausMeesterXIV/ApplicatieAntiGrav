// Edge function: Financiën <-> Google Sheet (twee richtingen).
//  - 'aanmaken': maakt een nieuwe Google Sheet in de Drive van KSA (enkel Financiën/hoofdleiding)
//  - 'sync': wijzigingen uit de Sheet naar de app halen en de Sheet bijwerken
//      * tabblad Strepen: aantal strepen per leider per drank in de lopende periode (enkel lezen)
//  - 'koppeling': koppeling AAN/UIT zetten (noodplan: zonder app verder werken in de Sheet)
//  - noodplan: de schakelaar staat ook in de Sheet zelf (tabblad Uitleg, cel B2), zodat hij werkt als de
//    app plat ligt. Elke dag een losse reservekopie in Drive (14 dagen bewaard) en een extra kopie vóór
//    het opnieuw koppelen.
//      * aangeroepen door de database bij elke wijziging (pg_net) en elke 30 seconden (pg_cron)
//      * of door Financiën met de knop "Nu synchroniseren"
//  - de rekenlogica (wat is er veranderd, wat schrijven we terug) staat in ../_shared/financienSheet.js
//
// Secrets (Supabase Dashboard > Edge Functions > Secrets), zie supabase/README.md:
//   GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN  (dezelfde als voor drive-fotos)
//   FINANCIEN_MAP_ID   (optioneel) id van de Drive-map waar de Sheet in komt; deel die map enkel met
//                      Financiën en hoofdleiding
// SUPABASE_URL, SUPABASE_ANON_KEY en SUPABASE_SERVICE_ROLE_KEY zijn standaard beschikbaar.

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import {
  KOLOMMEN,
  OVERZICHT,
  STREPEN,
  TABBLAD,
  belgischeDatum,
  gewensteRijen,
  maakSnapshot,
  overzichtRijen,
  strepenRijen,
  verwerkSheet,
  zelfdeRaster,
} from '../_shared/financienSheet.js';

const SHEETS = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE = 'https://www.googleapis.com/drive/v3';

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

class Fout extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}

// ---------------------------------------------------------------------
// Google-toegang met de refresh token van het KSA-account
// ---------------------------------------------------------------------
let token: { waarde: string; geldigTot: number } | null = null;

async function googleToken(): Promise<string> {
  if (token && token.geldigTot > Date.now() + 60_000) return token.waarde;
  const antwoord = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: Deno.env.get('GOOGLE_CLIENT_ID') ?? '',
      client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET') ?? '',
      refresh_token: Deno.env.get('GOOGLE_REFRESH_TOKEN') ?? '',
      grant_type: 'refresh_token',
    }),
  });
  if (!antwoord.ok) {
    console.error('Google-token mislukt', await antwoord.text());
    throw new Fout('De koppeling met Google werkt niet (meer). Laat de hoofdleiding ze opnieuw instellen.', 502);
  }
  const data = await antwoord.json();
  token = { waarde: data.access_token, geldigTot: Date.now() + data.expires_in * 1000 };
  return token.waarde;
}

async function google(url: string, init: RequestInit = {}) {
  const antwoord = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${await googleToken()}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  if (!antwoord.ok) {
    const tekst = await antwoord.text();
    console.error('Google-fout', url, antwoord.status, tekst);
    if (antwoord.status === 404) throw new Fout('Het rekenblad werd niet gevonden (verwijderd?). Maak een nieuw aan.', 404);
    if (antwoord.status === 403 && tekst.includes('SERVICE_DISABLED')) {
      throw new Fout('De Google Sheets API staat nog niet aan in het Google Cloud-project (zie supabase/README.md).', 503);
    }
    throw new Fout('Google gaf een fout. Probeer het later opnieuw.', 502);
  }
  return antwoord.status === 204 ? null : antwoord.json();
}

// ---------------------------------------------------------------------
// Data uit de app
// ---------------------------------------------------------------------
type Item = {
  sleutel: string;
  soort: 'drank' | 'betaling';
  id: string;
  omschrijving: string;
  naam: string;
  bedrag: number;
  vervaldatum: string | null;
  betaald: boolean;
  betaald_op: string | null;
  mededeling: string;
  opmerking: string;
};

async function laadItems(db: SupabaseClient): Promise<Item[]> {
  const [facturen, posten] = await Promise.all([
    db
      .from('facturen')
      .select('id, user_naam, periode, totaal_bedrag, mededeling, status, betaald_op, opmerking, profiles(naam)'),
    db
      .from('betaling_posten')
      .select('id, bedrag, mededeling, status, betaald_op, opmerking, profiles(naam), betalingen(titel, vervaldatum)'),
  ]);
  if (facturen.error) throw facturen.error;
  if (posten.error) throw posten.error;

  const items: Item[] = [];
  for (const f of facturen.data ?? []) {
    if (!(Number(f.totaal_bedrag) > 0)) continue; // niets te betalen
    items.push({
      sleutel: `drank:${f.id}`,
      soort: 'drank',
      id: f.id,
      omschrijving: `Drank – ${f.periode ?? 'periode'}`,
      // deno-lint-ignore no-explicit-any
      naam: (f as any).profiles?.naam ?? f.user_naam ?? '?',
      bedrag: Number(f.totaal_bedrag),
      vervaldatum: null,
      betaald: f.status === 'betaald',
      betaald_op: belgischeDatum(f.betaald_op),
      mededeling: f.mededeling ?? '',
      opmerking: f.opmerking ?? '',
    });
  }
  for (const p of posten.data ?? []) {
    // deno-lint-ignore no-explicit-any
    const x = p as any;
    items.push({
      sleutel: `betaling:${p.id}`,
      soort: 'betaling',
      id: p.id,
      omschrijving: x.betalingen?.titel ?? 'Betaling',
      naam: x.profiles?.naam ?? '?',
      bedrag: Number(p.bedrag),
      vervaldatum: x.betalingen?.vervaldatum ?? null,
      betaald: p.status === 'betaald',
      betaald_op: belgischeDatum(p.betaald_op),
      mededeling: p.mededeling ?? '',
      opmerking: p.opmerking ?? '',
    });
  }
  return items;
}

// Strepen van de lopende periode (nog niet gefactureerd), voor het tabblad Strepen
async function laadStrepen(db: SupabaseClient) {
  const { data: periode } = await db
    .from('billing_periods')
    .select('id, naam, start_datum')
    .eq('is_closed', false)
    .order('start_datum', { ascending: false })
    .limit(1)
    .maybeSingle();
  let query = db.from('consumpties').select('user_id, drank_id, aantal, prijs, profiles(naam)').is('factuur_id', null);
  query = periode ? query.or(`period_id.eq.${periode.id},period_id.is.null`) : query.is('period_id', null);
  const [strepen, dranken] = await Promise.all([query, db.from('dranken').select('id, naam, prijs')]);
  if (strepen.error) throw strepen.error;
  if (dranken.error) throw dranken.error;
  return {
    periode,
    dranken: dranken.data ?? [],
    // deno-lint-ignore no-explicit-any
    strepen: (strepen.data ?? []).map((s: any) => ({ ...s, naam: s.profiles?.naam })),
  };
}

// Een datum uit de Sheet wordt 12u 's middags (Belgische tijd valt dan altijd op dezelfde dag)
const tijdstip = (datum: string | null) => (datum ? `${datum}T12:00:00Z` : null);

async function pasToe(db: SupabaseClient, soort: string, id: string, velden: Record<string, unknown>) {
  const tabel = soort === 'drank' ? 'facturen' : 'betaling_posten';
  // Eerst de status (de database zet dan de datum van vandaag), daarna eventueel een eigen datum
  if ('betaald' in velden) {
    const { error } = await db
      .from(tabel)
      .update({ status: velden.betaald ? 'betaald' : 'onbetaald' })
      .eq('id', id);
    if (error) throw error;
  }
  const rest: Record<string, unknown> = {};
  if ('betaald_op' in velden && velden.betaald_op) rest.betaald_op = tijdstip(velden.betaald_op as string);
  if ('opmerking' in velden) rest.opmerking = velden.opmerking || null;
  if ('bedrag' in velden && soort === 'betaling') rest.bedrag = velden.bedrag;
  if (Object.keys(rest).length) {
    const { error } = await db.from(tabel).update(rest).eq('id', id);
    if (error) throw error;
  }
}

type Nieuw = {
  rijNr: number;
  titel: string;
  vervaldatum: string | null;
  user_id: string;
  bedrag: number;
  betaald: boolean;
  betaald_op: string | null;
  opmerking: string;
};

async function maakNieuw(db: SupabaseClient, nieuw: Nieuw[], problemen: string[]) {
  for (const n of nieuw) {
    // Zelfde titel en deadline = dezelfde betaling (bv. meerdere rijen "Trui 2026")
    let query = db.from('betalingen').select('id').ilike('titel', n.titel.replace(/[%_]/g, '\\$&'));
    query = n.vervaldatum ? query.eq('vervaldatum', n.vervaldatum) : query.is('vervaldatum', null);
    const { data: bestaand } = await query.limit(1).maybeSingle();
    let betalingId = bestaand?.id;
    if (!betalingId) {
      const { data, error } = await db
        .from('betalingen')
        .insert({ titel: n.titel, vervaldatum: n.vervaldatum, standaard_bedrag: n.bedrag })
        .select('id')
        .single();
      if (error) throw error;
      betalingId = data.id;
    }
    const { data: post, error } = await db
      .from('betaling_posten')
      .insert({ betaling_id: betalingId, user_id: n.user_id, bedrag: n.bedrag, opmerking: n.opmerking || null })
      .select('id')
      .single();
    if (error) {
      if (error.code === '23505') {
        problemen.push(`Rij ${n.rijNr}: deze leider staat al in "${n.titel}"; pas die rij aan in plaats van een nieuwe te maken`);
        continue;
      }
      throw error;
    }
    if (n.betaald) await pasToe(db, 'betaling', post.id, { betaald: true, betaald_op: n.betaald_op });
  }
}

// ---------------------------------------------------------------------
// Sheet lezen en schrijven
// ---------------------------------------------------------------------
async function leesSheet(id: string) {
  const ranges = [`${TABBLAD}!A1:J5000`, `${OVERZICHT}!A1:F1000`, `${STREPEN}!A1:AZ2000`, SCHAKELAAR]
    .map(r => `ranges=${encodeURIComponent(r)}`)
    .join('&');
  const data = await google(
    `${SHEETS}/${id}/values:batchGet?${ranges}&valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER`,
  );
  return {
    betalingen: (data.valueRanges?.[0]?.values ?? []) as unknown[][],
    overzicht: (data.valueRanges?.[1]?.values ?? []) as unknown[][],
    strepen: (data.valueRanges?.[2]?.values ?? []) as unknown[][],
    // Leeg of onleesbaar = AAN (enkel een uitdrukkelijke UIT pauzeert)
    gekoppeld: String(data.valueRanges?.[3]?.values?.[0]?.[0] ?? 'AAN').trim().toUpperCase() !== 'UIT',
  };
}

async function schrijfTabblad(id: string, tabblad: string, rijen: unknown[][], huidigAantal: number, laatsteKolom: string) {
  await google(`${SHEETS}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: `${tabblad}!A1`, values: rijen }] }),
  });
  if (huidigAantal > rijen.length) {
    await google(`${SHEETS}/${id}/values:batchClear`, {
      method: 'POST',
      body: JSON.stringify({ ranges: [`${tabblad}!A${rijen.length + 1}:${laatsteKolom}${huidigAantal + 1}`] }),
    });
  }
}

// Tabblad met wisselende breedte (Overzicht, Strepen): eerst leegmaken, dan schrijven
async function vervangTabblad(id: string, tabblad: string, rijen: unknown[][]) {
  await google(`${SHEETS}/${id}/values:batchClear`, {
    method: 'POST',
    body: JSON.stringify({ ranges: [`${tabblad}!A1:AZ5000`] }),
  });
  await google(`${SHEETS}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: `${tabblad}!A1`, values: rijen }] }),
  });
}

const STREPEN_ID = 4;
const SCHAKELAAR = 'Uitleg!B2';
const KOPIE_DAGEN = 14;

async function zetSchakelaar(id: string, aan: boolean) {
  await google(`${SHEETS}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: SCHAKELAAR, values: [[aan ? 'AAN' : 'UIT']] }] }),
  });
}

const vandaagBe = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());

/** Losse (niet-gekoppelde) kopie in dezelfde Drive-map; kopieën ouder dan 14 dagen naar de prullenbak */
async function maakReservekopie(db: SupabaseClient, id: string, reden: string) {
  const naam = `KSA Aalter – Financiën leiding – reservekopie ${vandaagBe()}${reden ? ` (${reden})` : ''}`;
  await google(`${DRIVE}/files/${id}/copy?supportsAllDrives=true`, { method: 'POST', body: JSON.stringify({ name: naam }) });
  const meta = await google(`${DRIVE}/files/${id}?fields=parents&supportsAllDrives=true`);
  const map = meta.parents?.[0];
  if (map) {
    const grens = new Date(Date.now() - KOPIE_DAGEN * 86400000).toISOString();
    const q = encodeURIComponent(
      `'${map}' in parents and name contains 'Financiën leiding – reservekopie' and trashed = false and createdTime < '${grens}'`,
    );
    const oud = await google(`${DRIVE}/files?q=${q}&fields=files(id)&supportsAllDrives=true&includeItemsFromAllDrives=true`);
    for (const f of oud.files ?? []) {
      await google(`${DRIVE}/files/${f.id}?supportsAllDrives=true`, { method: 'PATCH', body: JSON.stringify({ trashed: true }) });
    }
    await db.from('financien_sheet').update({ map_url: `https://drive.google.com/drive/folders/${map}` }).eq('id', 1);
  }
}
const kopOpmaak = (sheetId: number, kolommen: number) => ({
  repeatCell: {
    range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: kolommen },
    cell: {
      userEnteredFormat: {
        backgroundColor: { red: 0.09, green: 0.09, blue: 0.1 },
        textFormat: { bold: true, foregroundColor: { red: 1, green: 1, blue: 1 } },
      },
    },
    fields: 'userEnteredFormat(backgroundColor,textFormat)',
  },
});

// Oudere rekenbladen hebben nog geen tabblad Strepen: dan voegen we het toe
async function zorgVoorStrepen(id: string) {
  const meta = await google(`${SHEETS}/${id}?fields=sheets.properties(sheetId,title)`);
  // deno-lint-ignore no-explicit-any
  if ((meta.sheets ?? []).some((s: any) => s.properties?.title === STREPEN)) return;
  await google(`${SHEETS}/${id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        { addSheet: { properties: { sheetId: STREPEN_ID, title: STREPEN, index: 2, gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 } } } },
        kopOpmaak(STREPEN_ID, 52),
        { addProtectedRange: { protectedRange: { range: { sheetId: STREPEN_ID }, description: 'Wordt ingevuld door de KSA-app', warningOnly: true } } },
      ],
    }),
  });
}

// ---------------------------------------------------------------------
// Synchroniseren
// ---------------------------------------------------------------------
async function synchroniseer(db: SupabaseClient): Promise<Record<string, unknown>> {
  const { data: claim, error: claimFout } = await db.rpc('financien_sheet_claim', { p_seconden: 90 });
  if (claimFout) throw claimFout;
  if (!claim) return { bezig: true };

  let fout: string | null = null;
  const resultaat = { aangepast: 0, nieuw: 0, problemen: [] as string[] };
  try {
    for (let ronde = 0; ronde < 3; ronde++) {
      const { data: koppeling } = await db.from('financien_sheet').select('spreadsheet_id').eq('id', 1).single();
      const id = koppeling?.spreadsheet_id;
      if (!id) throw new Fout('Er is nog geen rekenblad gekoppeld', 409);

      if (ronde === 0) await zorgVoorStrepen(id);
      const [sheet, profielenRes, snapshotRes, strepenData] = await Promise.all([
        leesSheet(id),
        db.from('profiles').select('id, naam, nickname').eq('actief', true),
        db.from('financien_sheet_snapshot').select('sleutel, waarden'),
        laadStrepen(db),
      ]);
      // Noodplan: koppeling UIT (in de Sheet of via de app) -> niets lezen of schrijven
      const { data: status } = await db.from('financien_sheet').select('gepauzeerd, laatste_kopie_op').eq('id', 1).single();
      if (!sheet.gekoppeld) {
        if (!status?.gepauzeerd) await db.from('financien_sheet').update({ gepauzeerd: true }).eq('id', 1);
        return { gepauzeerd: true };
      }
      // De kolommen van Betalingen moeten kloppen, anders lezen we verkeerde cellen
      const kop = (sheet.betalingen[0] ?? []).map(c => String(c ?? '').trim());
      if (kop.length && KOLOMMEN.some((k, i) => kop[i] !== k)) {
        throw new Fout(
          'De kolommen van het tabblad Betalingen zijn veranderd (bv. een kolom ingevoegd of hernoemd). Zet ze terug zoals in het tabblad Uitleg staat, of maak een nieuw rekenblad.',
          409,
        );
      }
      if (status?.gepauzeerd) {
        // Terug AAN: eerst een kopie van hoe het rekenblad er nu uitziet
        await maakReservekopie(db, id, 'voor het opnieuw koppelen');
        await db.from('financien_sheet').update({ gepauzeerd: false }).eq('id', 1);
      }
      const profielen = profielenRes.data ?? [];
      const snapshot = Object.fromEntries((snapshotRes.data ?? []).map(r => [r.sleutel, r.waarden]));
      let items = await laadItems(db);

      // 1. Sheet -> app
      const { updates, nieuw, behouden, problemen } = verwerkSheet({
        rijen: sheet.betalingen,
        items,
        snapshot,
        profielen,
      });
      for (const u of updates) await pasToe(db, u.soort, u.id, u.velden);
      await maakNieuw(db, nieuw as Nieuw[], problemen);
      resultaat.aangepast += updates.length;
      resultaat.nieuw += nieuw.length;
      resultaat.problemen = problemen;
      if (updates.length || nieuw.length) items = await laadItems(db);

      // 2. App -> Sheet (enkel schrijven als er iets verschilt)
      // Nieuwe rijen die net aangemaakt zijn, staan nu in items; enkel de onverwerkte blijven onderaan staan.
      const gewenst = gewensteRijen(items, behouden);
      if (!zelfdeRaster(sheet.betalingen, gewenst)) {
        await schrijfTabblad(id, TABBLAD, gewenst, sheet.betalingen.length, 'J');
      }
      const { data: schattingen } = await db.rpc('periode_overzicht', { p_period_id: null, p_echte_kost: null });
      const overzicht = overzichtRijen(items, schattingen ?? []);
      if (problemen.length) overzicht.push([], ['Aandachtspunten (tabblad Betalingen)'], ...problemen.map(p => [p]));
      if (!zelfdeRaster(sheet.overzicht, overzicht)) {
        await vervangTabblad(id, OVERZICHT, overzicht);
      }
      const strepen = strepenRijen(strepenData);
      if (!zelfdeRaster(sheet.strepen, strepen)) {
        await vervangTabblad(id, STREPEN, strepen);
      }

      // 3. Snapshot bewaren: dit zijn nu de waarden in de app én in de Sheet
      const snap = maakSnapshot(items);
      const rijen = Object.entries(snap).map(([sleutel, waarden]) => ({ sleutel, waarden, updated_at: new Date().toISOString() }));
      if (rijen.length) {
        const { error } = await db.from('financien_sheet_snapshot').upsert(rijen);
        if (error) throw error;
      }
      const weg = Object.keys(snapshot).filter(k => !(k in snap));
      if (weg.length) await db.from('financien_sheet_snapshot').delete().in('sleutel', weg);
      await db.from('financien_sheet').update({ problemen }).eq('id', 1);

      // Elke dag één losse reservekopie
      if (ronde === 0 && status?.laatste_kopie_op !== vandaagBe()) {
        await maakReservekopie(db, id, '');
        await db.from('financien_sheet').update({ laatste_kopie_op: vandaagBe() }).eq('id', 1);
      }

      // Veranderde er intussen iets in de app? Dan nog een ronde.
      const { data: nogEens } = await db.from('financien_sheet').select('gewijzigd').eq('id', 1).single();
      if (!nogEens?.gewijzigd) break;
      await db.from('financien_sheet').update({ gewijzigd: false }).eq('id', 1);
    }
  } catch (e) {
    fout = e instanceof Fout ? e.message : 'Synchroniseren mislukt';
    if (!(e instanceof Fout)) console.error(e);
    throw e;
  } finally {
    await db.rpc('financien_sheet_vrijgeven', { p_fout: fout, p_gewijzigd_op: null });
  }
  return resultaat;
}

// ---------------------------------------------------------------------
// Nieuw rekenblad
// ---------------------------------------------------------------------
const UITLEG = [
  ['KSA Aalter – Financiën leiding'],
  ['Koppeling met de app:', 'AAN'],
  ['Zet op UIT om zonder de app verder te werken (noodplan). De app raakt dit rekenblad dan niet meer aan.'],
  [''],
  ['Dit rekenblad is gekoppeld aan de KSA-app. Wijzigingen gaan in twee richtingen.'],
  [''],
  ['Tabblad Betalingen'],
  ['• Eén rij per drankfactuur (van Drankteam) of andere betaling (t-shirt, trui, activiteit, …) per leider.'],
  ['• Je mag aanpassen: Betaald (vinkje), Betaald op, Opmerking, en het Bedrag van andere betalingen.'],
  ['• Grijze kolommen (Soort, Mededeling) beheert de app: aanpassingen daar worden teruggezet.'],
  ['• Bedragen van drank komen uit de strepen en pas je aan in de app (Drankteam).'],
  ['• Nieuwe andere betaling: vul onderaan een rij in met Omschrijving, Leider (naam zoals in de app) en Bedrag.'],
  ['  Optioneel: Te betalen voor, Betaald, Opmerking. Laat de kolom Soort leeg of zet "Andere".'],
  ['  Rijen met dezelfde Omschrijving en deadline horen bij dezelfde betaling.'],
  ['• Een rij verwijderen kan niet hier (ze komt terug): verwijder in de app (Financiën).'],
  [''],
  ['Tabblad Strepen'],
  ['• Aantal strepen per leider per drank in de lopende periode, met totalen en de prijs per streep uit de app.'],
  ['• Elke streep in de app staat hier binnen enkele seconden. Enkel lezen: strepen zet je in de app.'],
  ['• Zo kan je hier de prijs per streep berekenen (bv. bakprijs / totaal strepen van die drank).'],
  ['• Bij het afsluiten van een periode begint dit tabblad opnieuw; de strepen zitten dan in de drankfacturen.'],
  [''],
  ['Tabblad Overzicht'],
  ['• Per leider wat nog openstaat. Dit tabblad wordt door de app ingevuld; aanpassingen gaan verloren.'],
  [''],
  ['Synchronisatie'],
  ['• Wijzigingen in de app staan binnen enkele seconden hier.'],
  ['• Wijzigingen hier staan binnen ongeveer 30 seconden in de app.'],
  ['• Passen twee mensen tegelijk dezelfde cel aan (in de app en hier), dan wint de app.'],
  ['• Een oud rekenblad overnemen? Kopieer de gegevens in nieuwe rijen onderaan het tabblad Betalingen.'],
  ['• Eigen berekeningen? Maak een eigen tabblad: Overzicht en Strepen worden door de app overschreven.'],
  [''],
  ['Noodplan: werkt de app niet (goed)?'],
  ['1. Zet bovenaan "Koppeling met de app" op UIT. Vanaf dan werk je hier zoals vroeger: alles mag.'],
  ['2. Strepen tel je dan zelf bij (bv. in een eigen tabblad); de app vult het tabblad Strepen niet meer aan.'],
  ['3. Elke dag maakt de app een losse reservekopie van dit rekenblad in dezelfde Drive-map (14 dagen bewaard).'],
  ['4. Terug naar de app? Zet de koppeling weer op AAN. De app maakt eerst nog een reservekopie en neemt dan over:'],
  ['   Betaald, Betaald op, Opmerking, Bedrag (andere betalingen) en nieuwe rijen. Wat de app beheert, komt terug:'],
  ['   verwijderde rijen, de grijze kolommen en de tabbladen Overzicht en Strepen.'],
  ['   Voeg geen kolommen in of toe in Betalingen: dan weigert de app te synchroniseren.'],
];

async function maakAan(db: SupabaseClient) {
  const blad = await google(SHEETS, {
    method: 'POST',
    body: JSON.stringify({
      properties: { title: 'KSA Aalter – Financiën leiding', locale: 'nl_BE', timeZone: 'Europe/Brussels' },
      sheets: [
        { properties: { sheetId: 1, title: OVERZICHT, index: 0, gridProperties: { frozenRowCount: 1 } } },
        {
          properties: {
            sheetId: 2,
            title: TABBLAD,
            index: 1,
            gridProperties: { frozenRowCount: 1, rowCount: 3000, columnCount: KOLOMMEN.length },
          },
        },
        {
          properties: {
            sheetId: STREPEN_ID,
            title: STREPEN,
            index: 2,
            gridProperties: { frozenRowCount: 1, frozenColumnCount: 1 },
          },
        },
        { properties: { sheetId: 3, title: 'Uitleg', index: 3 } },
      ],
    }),
  });
  const id: string = blad.spreadsheetId;

  const grijs = { red: 0.95, green: 0.95, blue: 0.96 };
  const kolom = (sheetId: number, start: number, eind = start + 1) => ({
    sheetId,
    startRowIndex: 1,
    startColumnIndex: start,
    endColumnIndex: eind,
  });
  const euro = { type: 'CURRENCY', pattern: '[$€-813] #,##0.00' };
  const datum = { type: 'DATE', pattern: 'dd/mm/yyyy' };

  await google(`${SHEETS}/${id}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        kopOpmaak(2, KOLOMMEN.length),
        kopOpmaak(1, 6),
        kopOpmaak(STREPEN_ID, 52),
        {
          addProtectedRange: {
            protectedRange: { range: { sheetId: STREPEN_ID }, description: 'Wordt ingevuld door de KSA-app', warningOnly: true },
          },
        },
        { repeatCell: { range: kolom(2, 3), cell: { userEnteredFormat: { numberFormat: euro } }, fields: 'userEnteredFormat.numberFormat' } },
        { repeatCell: { range: kolom(2, 4), cell: { userEnteredFormat: { numberFormat: datum } }, fields: 'userEnteredFormat.numberFormat' } },
        { repeatCell: { range: kolom(2, 6), cell: { userEnteredFormat: { numberFormat: datum } }, fields: 'userEnteredFormat.numberFormat' } },
        { repeatCell: { range: kolom(1, 1, 6), cell: { userEnteredFormat: { numberFormat: euro } }, fields: 'userEnteredFormat.numberFormat' } },
        // Schakelaar AAN/UIT (tabblad Uitleg, cel B2)
        {
          setDataValidation: {
            range: { sheetId: 3, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 1, endColumnIndex: 2 },
            rule: {
              condition: { type: 'ONE_OF_LIST', values: [{ userEnteredValue: 'AAN' }, { userEnteredValue: 'UIT' }] },
              strict: true,
              showCustomUi: true,
            },
          },
        },
        {
          repeatCell: {
            range: { sheetId: 3, startRowIndex: 1, endRowIndex: 2, startColumnIndex: 0, endColumnIndex: 2 },
            cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.85, green: 0.95, blue: 0.87 } } },
            fields: 'userEnteredFormat(textFormat,backgroundColor)',
          },
        },
        // Vinkjes in de kolom Betaald
        { setDataValidation: { range: kolom(2, 5), rule: { condition: { type: 'BOOLEAN' }, strict: false } } },
        // Kolommen die de app beheert: grijs, en een waarschuwing als je ze toch aanpast
        ...[0, 7].map(c => ({
          repeatCell: { range: kolom(2, c), cell: { userEnteredFormat: { backgroundColor: grijs } }, fields: 'userEnteredFormat.backgroundColor' },
        })),
        ...[0, 7, 9].map(c => ({
          addProtectedRange: {
            protectedRange: { range: kolom(2, c), description: 'Beheerd door de KSA-app', warningOnly: true },
          },
        })),
        {
          addProtectedRange: {
            protectedRange: { range: { sheetId: 1 }, description: 'Wordt ingevuld door de KSA-app', warningOnly: true },
          },
        },
        // Technische ID-kolom verbergen
        {
          updateDimensionProperties: {
            range: { sheetId: 2, dimension: 'COLUMNS', startIndex: 9, endIndex: 10 },
            properties: { hiddenByUser: true },
            fields: 'hiddenByUser',
          },
        },
        ...[
          [0, 90], [1, 260], [2, 170], [3, 90], [4, 120], [5, 70], [6, 110], [7, 190], [8, 220],
        ].map(([c, px]) => ({
          updateDimensionProperties: {
            range: { sheetId: 2, dimension: 'COLUMNS', startIndex: c, endIndex: c + 1 },
            properties: { pixelSize: px },
            fields: 'pixelSize',
          },
        })),
        {
          updateDimensionProperties: {
            range: { sheetId: 1, dimension: 'COLUMNS', startIndex: 0, endIndex: 6 },
            properties: { pixelSize: 170 },
            fields: 'pixelSize',
          },
        },
      ],
    }),
  });

  await google(`${SHEETS}/${id}/values:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({ valueInputOption: 'RAW', data: [{ range: 'Uitleg!A1', values: UITLEG }] }),
  });

  // In de gekozen Drive-map zetten (enkel Financiën en hoofdleiding hebben daar toegang)
  const map = Deno.env.get('FINANCIEN_MAP_ID');
  if (map) {
    const meta = await google(`${DRIVE}/files/${id}?fields=parents&supportsAllDrives=true`);
    const weg = (meta.parents ?? []).join(',');
    await google(
      `${DRIVE}/files/${id}?addParents=${encodeURIComponent(map)}${weg ? `&removeParents=${encodeURIComponent(weg)}` : ''}&supportsAllDrives=true`,
      { method: 'PATCH', body: '{}' },
    );
  }

  const url = `https://docs.google.com/spreadsheets/d/${id}/edit`;
  // Nieuw blad: oude snapshot weg, zodat de app de bron is bij de eerste synchronisatie
  await db.from('financien_sheet_snapshot').delete().neq('sleutel', '');
  const { error } = await db
    .from('financien_sheet')
    .update({ spreadsheet_id: id, url, laatste_fout: null, problemen: [], gewijzigd: true, gepauzeerd: false, laatste_kopie_op: null })
    .eq('id', 1);
  if (error) throw error;
  return { id, url };
}

// ---------------------------------------------------------------------
Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return json({ error: 'Enkel POST' }, 405);

  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const db = createClient(url, serviceKey, { auth: { persistSession: false } });

  try {
    const autorisatie = req.headers.get('Authorization') ?? '';
    const systeem = serviceKey !== '' && autorisatie === `Bearer ${serviceKey}`;
    if (!systeem) {
      // Ingelogde leiding met het recht Financiën (of hoofdleiding)
      const gebruiker = createClient(url, Deno.env.get('SUPABASE_ANON_KEY') ?? '', {
        global: { headers: { Authorization: autorisatie } },
      });
      const { data: user } = await gebruiker.auth.getUser();
      const { data: magFinancien } = await gebruiker.rpc('heeft_recht', { p_recht: 'financien' });
      if (!user?.user || !magFinancien) throw new Fout('Enkel voor Financiën en hoofdleiding', 403);
    }

    const body = await req.json().catch(() => ({}));
    switch (body.actie) {
      case 'sync':
        return json(await synchroniseer(db));
      case 'koppeling': {
        if (systeem) throw new Fout('Enkel vanuit de app', 403);
        const { data: k } = await db.from('financien_sheet').select('spreadsheet_id').eq('id', 1).single();
        if (!k?.spreadsheet_id) throw new Fout('Er is nog geen rekenblad gekoppeld', 409);
        await zetSchakelaar(k.spreadsheet_id, !!body.aan);
        if (!body.aan) {
          await db.from('financien_sheet').update({ gepauzeerd: true }).eq('id', 1);
          return json({ gepauzeerd: true });
        }
        return json(await synchroniseer(db));
      }
      case 'aanmaken': {
        if (systeem) throw new Fout('Enkel vanuit de app', 403);
        const blad = await maakAan(db);
        const sync = await synchroniseer(db).catch(e => ({ fout: e instanceof Fout ? e.message : 'Synchroniseren mislukt' }));
        return json({ ...blad, sync });
      }
      default:
        throw new Fout('Onbekende actie');
    }
  } catch (e) {
    const status = e instanceof Fout ? e.status : 500;
    if (!(e instanceof Fout)) console.error(e);
    return json({ error: e instanceof Fout ? e.message : 'Er ging iets mis' }, status);
  }
});
