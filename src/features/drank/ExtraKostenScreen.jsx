import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from './DrinkContext';
import { ChevronBack } from '../../components/ChevronBack';
import { BottomSheet } from '../../components/Modal';
import { showToast } from '../../components/Toast';
import * as db from '../../lib/supabaseService';
import { euro } from '../../lib/geld';

// Extra kosten op de drankfactuur (migratie 003500), voor Drankteam en Financiën.
// Bv. de cara's van een weekend: een totaal verdelen over wie meedeed, of een vast bedrag per persoon.
// Per persoon komt het als aparte regel (correctie) op de drankfactuur van de open periode.

const veld =
  'w-full px-4 py-3 rounded-xl bg-kaart-event dark:bg-white/10 border-0 text-base focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30';
const Label = ({ children }) => (
  <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-2">{children}</p>
);
const Chip = ({ actief, children, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-full px-3.5 py-2 text-sm font-bold ${
      actief ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'bg-kaart-event dark:bg-white/10'
    }`}
  >
    {children}
  </button>
);

// Zelfde verdeling als de database (maak_extra_kost): centen naar beneden, de rest 1 cent extra voor de eersten
const verdeling = (totaal, n) => {
  if (!n || !(totaal > 0)) return null;
  const centen = Math.round(totaal * 100);
  const basis = Math.floor(centen / n);
  return { basis: basis / 100, rest: centen % n };
};

export const ExtraKostenScreen = () => {
  const navigate = useNavigate();
  const { users, groepen } = useAuth();
  const { activePeriod, refreshDrinksData } = useDrink();

  const [kosten, setKosten] = useState([]);
  const [laden, setLaden] = useState(true);
  const [nieuw, setNieuw] = useState(false);
  const [open, setOpen] = useState(null); // id van de uitgeklapte kost

  // Formulier
  const [titel, setTitel] = useState('');
  const [wijze, setWijze] = useState('verdelen');
  const [bedragTekst, setBedragTekst] = useState('');
  const [gekozen, setGekozen] = useState(new Set());
  const [zoek, setZoek] = useState('');
  const [bezig, setBezig] = useState(false);

  const laad = useCallback(async () => {
    if (!activePeriod?.id) return setLaden(false);
    try {
      setKosten(await db.fetchExtraKosten(activePeriod.id));
    } catch {
      showToast('Extra kosten laden lukte niet', 'error');
    } finally {
      setLaden(false);
    }
  }, [activePeriod?.id]);
  useEffect(() => {
    laad();
  }, [laad]);

  const leden = useMemo(
    () => (users || []).filter(u => u.actief).sort((a, b) => (a.naam || '').localeCompare(b.naam || '')),
    [users],
  );
  const zichtbaar = useMemo(() => {
    const q = zoek.trim().toLowerCase();
    return q ? leden.filter(u => `${u.naam} ${u.nickname || ''}`.toLowerCase().includes(q)) : leden;
  }, [leden, zoek]);

  const bedrag = parseFloat(String(bedragTekst).replace(',', '.'));
  const n = gekozen.size;
  const v = wijze === 'verdelen' ? verdeling(bedrag, n) : null;
  const totaal = wijze === 'verdelen' ? bedrag : bedrag * n;

  const wissel = id =>
    setGekozen(prev => {
      const s = new Set(prev);
      s.has(id) ? s.delete(id) : s.add(id);
      return s;
    });
  const kiesGroep = groepId => setGekozen(new Set(leden.filter(u => u.groepIds?.includes(groepId)).map(u => u.id)));

  const reset = () => {
    setTitel('');
    setWijze('verdelen');
    setBedragTekst('');
    setGekozen(new Set());
    setZoek('');
  };

  const bewaar = async () => {
    if (!titel.trim()) return showToast("Geef de extra kost een naam, bv. Cara's weekend", 'warning');
    if (!(bedrag > 0)) return showToast('Vul een bedrag groter dan 0 in', 'warning');
    if (!n) return showToast('Kies minstens één persoon', 'warning');
    const uitleg =
      wijze === 'verdelen'
        ? `${euro(bedrag)} verdelen over ${n} ${n === 1 ? 'persoon' : 'personen'} (± ${euro(v.basis)} p.p.)`
        : `${euro(bedrag)} voor ${n} ${n === 1 ? 'persoon' : 'personen'} (samen ${euro(totaal)})`;
    if (!window.confirm(`${titel.trim()}: ${uitleg}. Op de drankfactuur van ${activePeriod?.naam}?`)) return;
    setBezig(true);
    try {
      await db.maakExtraKost(titel.trim(), wijze, Math.round(bedrag * 100) / 100, [...gekozen]);
      showToast(`${titel.trim()} aangerekend aan ${n} ${n === 1 ? 'persoon' : 'personen'}`, 'success');
      reset();
      setNieuw(false);
      await laad();
      refreshDrinksData?.(); // voorlopige rekeningen bijwerken
    } catch (e) {
      showToast(e.message || 'Bewaren lukte niet', 'error');
    } finally {
      setBezig(false);
    }
  };

  const verwijder = async k => {
    if (!window.confirm(`${k.titel} verwijderen? Het verdwijnt van de rekening van ${k.posten.length} personen.`)) return;
    try {
      await db.verwijderExtraKost(k.id);
      showToast(`${k.titel} verwijderd`, 'success');
      await laad();
      refreshDrinksData?.();
    } catch (e) {
      showToast(e.message || 'Verwijderen lukte niet', 'error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white pb-nav-safe">
      <header className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-2 flex items-center gap-2">
        <ChevronBack onClick={() => navigate(-1)} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Extra kosten</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            Op de drankfactuur · {activePeriod?.naam || 'geen open periode'}
          </p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-2 space-y-5">
        <p className="text-gray-600 dark:text-gray-300">
          Bv. de cara's van een weekend. Verdeel een totaal over wie meedeed, of reken iedereen hetzelfde bedrag aan.
          Het komt als aparte regel op de drankfactuur.
        </p>

        <button
          type="button"
          disabled={!activePeriod}
          onClick={() => setNieuw(true)}
          className="w-full rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt py-4 font-bold flex items-center justify-center gap-2 active:scale-[0.99] disabled:opacity-40"
        >
          <span className="material-icons-round">add</span> Nieuwe extra kost
        </button>

        <section className="space-y-2">
          <h2 className="px-2 text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
            Deze periode
          </h2>
          {laden ? (
            <p className="px-2 text-sm text-gray-500">Laden…</p>
          ) : kosten.length === 0 ? (
            <p className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
              Nog geen extra kosten in deze periode.
            </p>
          ) : (
            kosten.map(k => {
              const som = k.posten.reduce((a, p) => a + p.correctie_bedrag, 0);
              const uit = open === k.id;
              return (
                <div key={k.id} className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setOpen(uit ? null : k.id)}
                    aria-expanded={uit}
                    className="w-full px-5 py-4 flex items-center gap-3 text-left"
                  >
                    <span className="flex-1 min-w-0">
                      <span className="block font-semibold truncate">{k.titel}</span>
                      <span className="block text-sm text-gray-500 dark:text-gray-400">
                        {k.wijze === 'verdelen' ? `${euro(k.bedrag)} verdeeld` : `${euro(k.bedrag)} per persoon`} ·{' '}
                        {k.posten.length} {k.posten.length === 1 ? 'persoon' : 'personen'}
                      </span>
                    </span>
                    <span className="font-extrabold tabular-nums">{euro(som)}</span>
                    <span className={`material-icons-round text-gray-500 transition-transform ${uit ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  </button>
                  {uit && (
                    <div className="border-t border-white dark:border-white/5">
                      <ul className="divide-y divide-white dark:divide-white/5">
                        {[...k.posten]
                          .sort((a, b) => (a.user_naam || '').localeCompare(b.user_naam || ''))
                          .map(p => (
                            <li key={p.user_id} className="px-5 py-2.5 flex justify-between text-sm">
                              <span className="truncate">{p.user_naam}</span>
                              <span className="tabular-nums">{euro(p.correctie_bedrag)}</span>
                            </li>
                          ))}
                      </ul>
                      <div className="px-5 py-3">
                        <button
                          type="button"
                          onClick={() => verwijder(k)}
                          className="w-full rounded-xl py-2.5 font-bold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15"
                        >
                          Verwijderen
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </section>
      </main>

      <BottomSheet isOpen={nieuw} onClose={() => setNieuw(false)} title="Nieuwe extra kost" subtitle={activePeriod?.naam}>
        <div className="pb-4 space-y-5 text-inkt dark:text-white">
          <div>
            <Label>Naam</Label>
            <input value={titel} onChange={e => setTitel(e.target.value)} maxLength={80} placeholder="bv. Cara's weekend" className={veld} />
          </div>

          <div>
            <Label>Hoe aanrekenen?</Label>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['verdelen', 'Totaal verdelen', 'Gelijk over de gekozen personen'],
                ['per_persoon', 'Per persoon', 'Iedereen hetzelfde bedrag'],
              ].map(([id, titelKeuze, sub]) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setWijze(id)}
                  className={`rounded-2xl px-4 py-3 text-left ${
                    wijze === id ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'bg-kaart-event dark:bg-kaart-event-d'
                  }`}
                >
                  <span className="block font-bold">{titelKeuze}</span>
                  <span className={`block text-xs ${wijze === id ? 'opacity-80' : 'text-gray-500 dark:text-gray-400'}`}>{sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label>{wijze === 'verdelen' ? 'Totaalbedrag (€)' : 'Bedrag per persoon (€)'}</Label>
            <input inputMode="decimal" value={bedragTekst} onChange={e => setBedragTekst(e.target.value)} placeholder="bv. 60,00" className={veld} />
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Label>Wie betaalt mee? ({n})</Label>
              <button type="button" onClick={() => setGekozen(new Set())} className="text-xs font-bold text-gray-500 underline">
                Niemand
              </button>
            </div>
            <div className="flex flex-wrap gap-2 mb-3">
              <Chip actief={n === leden.length && n > 0} onClick={() => setGekozen(new Set(leden.map(u => u.id)))}>
                Iedereen
              </Chip>
              {(groepen || []).map(g => (
                <Chip key={g.id} onClick={() => kiesGroep(g.id)}>
                  {g.naam}
                </Chip>
              ))}
            </div>
            <input type="search" value={zoek} onChange={e => setZoek(e.target.value)} placeholder="Zoek leiding" className={`${veld} mb-2`} />
            <ul className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d divide-y divide-white dark:divide-white/5 max-h-72 overflow-y-auto">
              {zichtbaar.map(u => (
                <li key={u.id}>
                  <label className="flex items-center gap-3 px-4 py-3">
                    <input type="checkbox" checked={gekozen.has(u.id)} onChange={() => wissel(u.id)} className="w-5 h-5 accent-[#16161a]" />
                    <span className="flex-1 min-w-0 truncate font-semibold">{u.naam}</span>
                    {u.isOudleiding && <span className="text-xs text-gray-500">oudleiding</span>}
                  </label>
                </li>
              ))}
            </ul>
          </div>

          {n > 0 && bedrag > 0 && (
            <div className="rounded-2xl bg-kaart-strepen dark:bg-kaart-strepen-d px-5 py-4">
              {wijze === 'verdelen' ? (
                <p>
                  <b className="tabular-nums">{euro(v.basis)}</b> per persoon
                  {v.rest > 0 && <> ({v.rest} betalen 1 cent meer)</>}, samen precies <b className="tabular-nums">{euro(bedrag)}</b>.
                </p>
              ) : (
                <p>
                  <b className="tabular-nums">{euro(bedrag)}</b> per persoon, samen <b className="tabular-nums">{euro(totaal)}</b>.
                </p>
              )}
            </div>
          )}

          <button
            type="button"
            disabled={bezig}
            onClick={bewaar}
            className="w-full rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt py-4 font-bold active:scale-[0.99] disabled:opacity-40"
          >
            {bezig ? 'Bewaren…' : 'Aanrekenen'}
          </button>
        </div>
      </BottomSheet>
    </div>
  );
};
