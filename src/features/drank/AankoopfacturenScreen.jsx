import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../../components/ChevronBack';
import { BottomSheet } from '../../components/Modal';
import { showToast } from '../../components/Toast';
import * as db from '../../lib/supabaseService';
import { euro } from '../../lib/geld';
import { MAX_FOTO_MB, verkleinFoto } from '../../lib/foto';
import { useAuth } from '../auth/AuthContext';
import { deelOfDownload, factuurRef, laadBijlage, maakMiniFactuur, miniFactuurNaam } from '../../lib/miniFactuur';

// Aankoopfacturen (migratie 003800): facturen die KSA krijgt (brouwer, drankcentrale, ...), voor Team Drank en
// Financiën. Per factuur een bedrag, mededeling, datum, betaald en een foto of PDF; gebundeld per drankperiode.

const veld =
  'w-full px-4 py-3 rounded-xl bg-kaart-event dark:bg-white/10 border-0 text-base focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30';
const Label = ({ children }) => (
  <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-2">{children}</p>
);

const vandaag = () => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Brussels' }).format(new Date());
const datumTekst = d => (d ? new Date(`${d}T12:00:00`).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const leegFormulier = periodId => ({
  id: null,
  period_id: periodId || '',
  leverancier: '',
  bedragTekst: '',
  mededeling: '',
  factuurdatum: vandaag(),
  betaald: false,
  notitie: '',
  foto_pad: null,
});

export const AankoopfacturenScreen = () => {
  const navigate = useNavigate();
  const { users } = useAuth();
  const [facturen, setFacturen] = useState([]);
  const [periodes, setPeriodes] = useState([]);
  const [laden, setLaden] = useState(true);
  const [dicht, setDicht] = useState(() => new Set()); // dichtgeklapte periodes
  const [form, setForm] = useState(null); // open formulier (nieuw of aanpassen)
  const [foto, setFoto] = useState(null); // nieuw gekozen bestand
  const [fotoLink, setFotoLink] = useState(null); // link naar de bestaande foto
  const [bezig, setBezig] = useState(false);
  const [pdfBezig, setPdfBezig] = useState(false);

  const laad = useCallback(async () => {
    try {
      const [f, p] = await Promise.all([db.fetchAankoopfacturen(), db.fetchBillingPeriods()]);
      setFacturen(f);
      setPeriodes(p);
      // Afgesloten periodes standaard dicht, de open periode open
      setDicht(prev => (prev.size ? prev : new Set(p.filter(x => x.is_closed).map(x => x.id))));
    } catch {
      showToast('Aankoopfacturen laden lukte niet', 'error');
    } finally {
      setLaden(false);
    }
  }, []);
  useEffect(() => {
    laad();
  }, [laad]);

  const openPeriode = periodes.find(p => !p.is_closed);
  const groepen = useMemo(
    () =>
      periodes
        .map(p => ({ periode: p, facturen: facturen.filter(f => f.period_id === p.id) }))
        .filter(g => g.facturen.length || !g.periode.is_closed),
    [periodes, facturen],
  );

  const open = f => {
    setFoto(null);
    setFotoLink(null);
    if (!f) return setForm(leegFormulier(openPeriode?.id || periodes[0]?.id));
    setForm({ ...f, bedragTekst: f.bedrag.toFixed(2).replace('.', ','), mededeling: f.mededeling || '', notitie: f.notitie || '' });
    if (f.foto_pad) db.aankoopfactuurLink(f.foto_pad).then(setFotoLink).catch(() => {});
  };
  const zet = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const kiesFoto = async e => {
    const bestand = e.target.files?.[0];
    e.target.value = '';
    if (!bestand) return;
    const klein = await verkleinFoto(bestand);
    if (klein.size > MAX_FOTO_MB * 1024 * 1024) return showToast(`Het bestand is groter dan ${MAX_FOTO_MB} MB`, 'warning');
    setFoto(klein);
  };

  const bedrag = parseFloat(String(form?.bedragTekst || '').replace(',', '.'));
  const kanBewaren = form && form.leverancier.trim() && Number.isFinite(bedrag) && bedrag >= 0 && form.period_id;

  const bewaar = async () => {
    if (!kanBewaren || bezig) return;
    setBezig(true);
    try {
      await db.bewaarAankoopfactuur(
        {
          id: form.id,
          period_id: form.period_id,
          leverancier: form.leverancier.trim(),
          bedrag: Math.round(bedrag * 100) / 100,
          mededeling: form.mededeling.trim() || null,
          factuurdatum: form.factuurdatum || null,
          betaald: form.betaald,
          notitie: form.notitie.trim() || null,
        },
        foto,
        foto ? form.foto_pad : null,
      );
      showToast(form.id ? 'Factuur aangepast' : 'Factuur bewaard', 'success');
      setForm(null);
      await laad();
    } catch (e) {
      showToast(e.message || 'Bewaren lukte niet', 'error');
    } finally {
      setBezig(false);
    }
  };

  const verwijder = async () => {
    if (!form?.id || !window.confirm(`Factuur van ${form.leverancier} verwijderen? De foto gaat mee weg.`)) return;
    try {
      await db.verwijderAankoopfactuur(form);
      showToast('Factuur verwijderd', 'success');
      setForm(null);
      await laad();
    } catch (e) {
      showToast(e.message || 'Verwijderen lukte niet', 'error');
    }
  };

  const naamVan = id => users?.find(u => u.id === id)?.naam || 'onbekend';
  const tijdstip = t => (t ? new Date(t).toLocaleString('nl-BE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '');

  // Mini-factuur als PDF van de bewaarde gegevens, met de foto of PDF van de factuur achteraan
  const maakPdf = async () => {
    const f = facturen.find(x => x.id === form?.id);
    if (!f || pdfBezig) return;
    setPdfBezig(true);
    try {
      const link = f.foto_pad ? fotoLink || (await db.aankoopfactuurLink(f.foto_pad)) : null;
      const bijlage = link ? await laadBijlage(link) : null;
      const bytes = await maakMiniFactuur({
        factuur: f,
        periodeNaam: periodes.find(p => p.id === f.period_id)?.naam,
        ingevoerdDoor: naamVan(f.aangemaakt_door),
        bijlage,
      });
      const uitkomst = await deelOfDownload(bytes, miniFactuurNaam(f));
      if (uitkomst === 'gedownload') showToast('PDF gedownload', 'success');
      if (f.foto_pad && !bijlage) showToast('De foto kon niet mee in de PDF', 'warning');
    } catch (e) {
      console.error(e);
      showToast('PDF maken lukte niet', 'error');
    } finally {
      setPdfBezig(false);
    }
  };

  const kopieer = async tekst => {
    try {
      await navigator.clipboard.writeText(tekst);
      showToast('Mededeling gekopieerd', 'success');
    } catch {
      showToast('Kopiëren lukte niet', 'error');
    }
  };

  const wissel = id =>
    setDicht(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });

  const isPdf = (form?.foto_pad || '').toLowerCase().endsWith('.pdf');

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white pb-nav-safe">
      <header className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-2 flex items-center gap-2">
        <ChevronBack onClick={() => navigate(-1)} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Aankoopfacturen</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">Brouwer, drankcentrale, … per periode</p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-2 space-y-5">
        <button
          type="button"
          disabled={!periodes.length}
          onClick={() => open(null)}
          className="w-full rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt py-4 font-bold flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-40"
        >
          <span className="material-icons-round">add_a_photo</span> Nieuwe factuur
        </button>

        {laden && <p className="px-2 text-sm text-gray-500">Laden…</p>}

        {groepen.map(({ periode, facturen: lijst }) => {
          const totaal = lijst.reduce((s, f) => s + f.bedrag, 0);
          const onbetaald = lijst.filter(f => !f.betaald).length;
          const isDicht = dicht.has(periode.id);
          return (
            <section key={periode.id} className="space-y-2">
              <button
                type="button"
                onClick={() => wissel(periode.id)}
                aria-expanded={!isDicht}
                className="w-full px-2 flex items-center gap-2 text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 truncate">
                    {periode.naam}
                    {!periode.is_closed && ' · lopend'}
                  </span>
                  <span className="block text-sm text-gray-500 dark:text-gray-400">
                    {lijst.length} {lijst.length === 1 ? 'factuur' : 'facturen'}
                    {onbetaald ? ` · ${onbetaald} niet betaald` : ''}
                  </span>
                </span>
                <span className="font-extrabold tabular-nums">{euro(totaal)}</span>
                <span className={`material-icons-round text-gray-500 transition-transform ${isDicht ? '' : 'rotate-180'}`}>expand_more</span>
              </button>
              {!isDicht &&
                (lijst.length === 0 ? (
                  <p className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
                    Nog geen facturen in deze periode.
                  </p>
                ) : (
                  <div className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-hidden divide-y divide-white dark:divide-white/5">
                    {lijst.map(f => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => open(f)}
                        className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-black/5 dark:active:bg-white/5"
                      >
                        <span className="material-icons-round text-xl text-gray-500 dark:text-gray-400">
                          {f.foto_pad ? (f.foto_pad.endsWith('.pdf') ? 'picture_as_pdf' : 'image') : 'receipt_long'}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="block font-semibold truncate">{f.leverancier}</span>
                          <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">
                            {datumTekst(f.factuurdatum)}
                            {f.mededeling ? ` · ${f.mededeling}` : ''}
                          </span>
                        </span>
                        <span className="text-right">
                          <span className="block font-extrabold tabular-nums">{euro(f.bedrag)}</span>
                          <span className={`block text-xs font-bold ${f.betaald ? 'text-green-700 dark:text-green-400' : 'text-gray-500 dark:text-gray-400'}`}>
                            {f.betaald ? 'Betaald' : 'Niet betaald'}
                          </span>
                        </span>
                      </button>
                    ))}
                  </div>
                ))}
            </section>
          );
        })}
      </main>

      <BottomSheet
        isOpen={!!form}
        onClose={() => setForm(null)}
        title={form?.id ? 'Factuur' : 'Nieuwe factuur'}
        subtitle={periodes.find(p => p.id === form?.period_id)?.naam}
      >
        {form && (
          <div className="space-y-5 pb-2">
            <div>
              <Label>Leverancier</Label>
              <input value={form.leverancier} onChange={e => zet('leverancier', e.target.value)} placeholder="bv. Brouwerij Van Steenberge" maxLength={80} className={veld} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Bedrag (€)</Label>
                <input inputMode="decimal" value={form.bedragTekst} onChange={e => zet('bedragTekst', e.target.value)} placeholder="bv. 245,80" className={veld} />
              </div>
              <div>
                <Label>Factuurdatum</Label>
                <input type="date" value={form.factuurdatum || ''} onChange={e => zet('factuurdatum', e.target.value)} className={veld} />
              </div>
            </div>
            <div>
              <Label>Mededeling</Label>
              <div className="flex gap-2">
                <input value={form.mededeling} onChange={e => zet('mededeling', e.target.value)} placeholder="bv. +++123/4567/89012+++" maxLength={140} className={`${veld} font-mono`} />
                {form.mededeling && (
                  <button type="button" onClick={() => kopieer(form.mededeling)} className="shrink-0 rounded-xl bg-kaart-event dark:bg-white/10 px-3" aria-label="Mededeling kopiëren">
                    <span className="material-icons-round">content_copy</span>
                  </button>
                )}
              </div>
            </div>
            <div>
              <Label>Periode</Label>
              <select value={form.period_id} onChange={e => zet('period_id', e.target.value)} className={veld}>
                {periodes.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.naam}
                    {p.is_closed ? '' : ' (lopend)'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label>Foto of PDF van de factuur</Label>
              {(foto || form.foto_pad) && (
                <div className="mb-2 rounded-2xl bg-kaart-event dark:bg-white/10 p-3 flex items-center gap-3">
                  {foto ? (
                    foto.type.startsWith('image/') ? (
                      <img src={URL.createObjectURL(foto)} alt="Gekozen foto" className="h-20 w-16 object-cover rounded-lg" />
                    ) : (
                      <span className="material-icons-round text-4xl text-gray-500">picture_as_pdf</span>
                    )
                  ) : fotoLink && !isPdf ? (
                    <img src={fotoLink} alt="Factuur" className="h-20 w-16 object-cover rounded-lg" />
                  ) : (
                    <span className="material-icons-round text-4xl text-gray-500">{isPdf ? 'picture_as_pdf' : 'image'}</span>
                  )}
                  <span className="flex-1 min-w-0 text-sm">
                    {foto ? (
                      <>
                        <span className="block font-semibold truncate">{foto.name}</span>
                        <span className="text-gray-500">{(foto.size / 1024).toFixed(0)} kB · wordt bewaard</span>
                      </>
                    ) : (
                      <span className="font-semibold">Bewaard</span>
                    )}
                  </span>
                  {!foto && fotoLink && (
                    <a href={fotoLink} target="_blank" rel="noopener noreferrer" className="rounded-xl bg-white dark:bg-white/10 px-3 py-2 text-sm font-bold">
                      Openen
                    </a>
                  )}
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="rounded-xl bg-kaart-event dark:bg-white/10 py-3 font-bold flex items-center justify-center gap-2 cursor-pointer">
                  <span className="material-icons-round">photo_camera</span> Foto nemen
                  <input type="file" accept="image/*" capture="environment" onChange={kiesFoto} className="hidden" />
                </label>
                <label className="rounded-xl bg-kaart-event dark:bg-white/10 py-3 font-bold flex items-center justify-center gap-2 cursor-pointer">
                  <span className="material-icons-round">upload_file</span> Bestand
                  <input type="file" accept="image/*,application/pdf" onChange={kiesFoto} className="hidden" />
                </label>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-2xl bg-kaart-event dark:bg-white/10 px-4 py-3">
              <span className="font-semibold">Betaald</span>
              <input type="checkbox" checked={form.betaald} onChange={e => zet('betaald', e.target.checked)} className="h-5 w-5 accent-inkt" />
            </label>

            <div>
              <Label>Notitie (optioneel)</Label>
              <textarea value={form.notitie} onChange={e => zet('notitie', e.target.value)} rows={2} maxLength={500} placeholder="bv. 12 bakken Freedom, 4 bakken Cola" className={veld} />
            </div>

            <button
              type="button"
              disabled={!kanBewaren || bezig}
              onClick={bewaar}
              className="w-full rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt py-4 font-bold disabled:opacity-40"
            >
              {bezig ? 'Bezig…' : form.id ? 'Aanpassingen bewaren' : 'Factuur bewaren'}
            </button>
            {form.id && (
              <div className="rounded-2xl bg-kaart-event dark:bg-white/10 p-4 space-y-3">
                <div className="text-sm text-gray-500 dark:text-gray-400 space-y-0.5">
                  <p>
                    <span className="font-mono font-semibold text-inkt dark:text-white">{factuurRef(form)}</span>
                  </p>
                  <p>
                    Ingevoerd door {naamVan(form.aangemaakt_door)}
                    {form.created_at && ` op ${tijdstip(form.created_at)}`}
                  </p>
                  {form.updated_at && form.updated_at !== form.created_at && <p>Laatst aangepast op {tijdstip(form.updated_at)}</p>}
                </div>
                <button
                  type="button"
                  onClick={maakPdf}
                  disabled={pdfBezig}
                  className="w-full rounded-xl bg-white dark:bg-white/10 py-3 font-bold flex items-center justify-center gap-2 disabled:opacity-40"
                >
                  <span className="material-icons-round">picture_as_pdf</span>
                  {pdfBezig ? 'PDF maken…' : 'Mini-factuur als PDF'}
                </button>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Een nette samenvatting van de bewaarde gegevens, met de foto of PDF van de factuur erbij. Handig om in de
                  Drive te zetten.
                </p>
              </div>
            )}
            {form.id && (
              <button type="button" onClick={verwijder} className="w-full rounded-xl py-3 font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15">
                Verwijderen
              </button>
            )}
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
