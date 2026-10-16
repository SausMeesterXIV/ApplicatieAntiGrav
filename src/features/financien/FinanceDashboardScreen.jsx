import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ChevronBack } from '../../components/ChevronBack';
import { showToast } from '../../components/Toast';
import { euro } from '../../lib/geld';
import * as fin from '../../lib/financien';
import { UittrekselInlezen } from '../drank/UittrekselInlezen';
import { DrankSheetKaart } from './DrankSheetKaart';
import { BetalingSheet } from './BetalingSheet';
import { LeiderSheet } from './LeiderSheet';
import { NieuweBetalingSheet } from './NieuweBetalingSheet';
import { datumKort } from './datum';

// Financiën (recht 'financien' + hoofdleiding): wie moet nog wat betalen, drank én andere betalingen.
// De formele boekhouding blijft in de Drive; deze tab is het overzicht, gekoppeld aan een Google Sheet.

export const FinanceDashboardScreen = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [posten, setPosten] = useState([]);
  const [schattingen, setSchattingen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [tab, setTab] = useState('overzicht');
  const [zoek, setZoek] = useState('');
  const [openGroep, setOpenGroep] = useState(null); // sleutel van een betaling
  const [openLeider, setOpenLeider] = useState(null); // user_id
  const [nieuw, setNieuw] = useState(false);

  const laad = useCallback(async () => {
    try {
      const [p, s] = await Promise.all([fin.fetchPosten(), fin.fetchSchattingen().catch(() => [])]);
      setPosten(p);
      setSchattingen(s);
    } catch (e) {
      console.error(e);
      showToast('Financiën laden mislukt', 'error');
    } finally {
      setLaden(false);
    }
  }, []);

  useEffect(() => {
    laad();
  }, [laad]);

  const totaal = useMemo(() => fin.totalen(posten), [posten]);
  const leiders = useMemo(() => fin.perLeider(posten, schattingen), [posten, schattingen]);
  const groepen = useMemo(() => fin.perBetaling(posten), [posten]);

  const z = zoek.trim().toLowerCase();
  const zichtbareLeiders = leiders.filter(
    l => (!z || l.naam.toLowerCase().includes(z)) && (l.open > 0 || l.schatting > 0 || z),
  );
  const zichtbareGroepen = groepen.filter(
    g => !z || g.titel.toLowerCase().includes(z) || g.posten.some(p => (p.naam || '').toLowerCase().includes(z)),
  );

  // Voor het inlezen van het bankuittreksel: alle open posten in de vorm die UittrekselInlezen verwacht
  const uittrekselPosten = useMemo(
    () =>
      posten
        .filter(fin.isOpen)
        .map(p => ({ ...p, id: `${p.soort}:${p.id}`, totaal_bedrag: p.bedrag, user_naam: `${p.naam} · ${p.titel}` })),
    [posten],
  );

  const zetBetaaldVanUittreksel = async ids => {
    for (const sleutel of ids) {
      const [soort, id] = sleutel.split(':');
      await fin.zetBetaald(soort, id, true);
    }
    await laad();
  };

  const groep = groepen.find(g => g.sleutel === openGroep);
  const leider = leiders.find(l => l.userId === openLeider);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800 space-y-3">
        <div className="flex items-center gap-3">
          <ChevronBack onClick={() => navigate(-1)} />
          <h1 className="text-xl font-bold flex-1">Financiën</h1>
          {/* Extra kost op de drankfactuur (bv. cara's van een weekend), zie ExtraKostenScreen */}
          <button
            onClick={() => navigate('/extra-kosten')}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-kaart-event dark:bg-kaart-event-d flex items-center gap-1"
          >
            <span className="material-icons-round text-base">group_add</span> Extra kost
          </button>
          <button
            onClick={() => setNieuw(true)}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-inkt text-white dark:bg-white dark:text-inkt flex items-center gap-1"
          >
            <span className="material-icons-round text-base">add</span> Betaling
          </button>
        </div>
        <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-gray-200/70 dark:bg-gray-800" role="tablist">
          {[
            ['overzicht', 'Wie moet betalen'],
            ['betalingen', 'Betalingen'],
          ].map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={`py-1.5 rounded-lg text-sm font-bold transition ${
                tab === id ? 'bg-white dark:bg-[#1e2330] shadow-sm' : 'text-gray-500'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          value={zoek}
          onChange={e => setZoek(e.target.value)}
          placeholder={tab === 'overzicht' ? 'Zoek leider…' : 'Zoek betaling of leider…'}
          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1e2330] border border-gray-200 dark:border-gray-700 text-sm"
        />
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-4">
        {/* Kerncijfers */}
        <section className="grid grid-cols-3 gap-2">
          {[
            [
              'Openstaand',
              totaal.open,
              `${totaal.aantalOpen} ${totaal.aantalOpen === 1 ? 'bedrag' : 'bedragen'}`,
              'text-gray-900 dark:text-white',
            ],
            ['Te laat', totaal.teLaat, 'deadline voorbij', totaal.teLaat > 0 ? 'text-red-600' : 'text-gray-400'],
            ['Ontvangen', totaal.ontvangen, 'betaald', 'text-green-600'],
          ].map(([label, bedrag, sub, kleur]) => (
            <div key={label} className="bg-white dark:bg-[#1e2330] rounded-2xl p-3 border border-gray-100 dark:border-gray-800">
              <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
              <p className={`text-lg font-black mt-0.5 ${kleur}`}>{euro(bedrag)}</p>
              <p className="text-[11px] text-gray-500">{sub}</p>
            </div>
          ))}
        </section>

        {laden && <p className="text-center text-sm text-gray-500 py-6">Laden…</p>}

        {!laden && tab === 'overzicht' && (
          <>
            <section>
              <h2 className="text-sm font-bold text-gray-500 uppercase tracking-wider px-1 mb-2">Wie moet nog betalen</h2>
              <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
                {zichtbareLeiders.length === 0 && (
                  <p className="p-4 text-center text-sm text-gray-500">{z ? 'Niemand gevonden.' : 'Iedereen is in orde. 🎉'}</p>
                )}
                {zichtbareLeiders.map(l => (
                  <button
                    key={l.userId}
                    onClick={() => setOpenLeider(l.userId)}
                    className="w-full p-4 flex items-center gap-3 text-left"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{l.naam}</p>
                      <p className="text-xs text-gray-500">
                        {[
                          l.drank > 0 && `Drank ${euro(l.drank)}`,
                          l.andere > 0 && `Andere ${euro(l.andere)}`,
                          l.schatting > 0 && `Lopend ~${euro(l.schatting)}`,
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    {l.teLaat > 0 && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600">
                        te laat
                      </span>
                    )}
                    <span className={`font-black ${l.open > 0 ? '' : 'text-gray-400'}`}>{euro(l.open)}</span>
                    <span className="material-icons-round text-gray-400">chevron_right</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-500 px-1 mt-2">
                "Lopend" is de schatting van de drankperiode die nog niet afgesloten is; die telt nog niet mee in het
                openstaande bedrag.
              </p>
            </section>

            <UittrekselInlezen facturen={uittrekselPosten} onBetaald={zetBetaaldVanUittreksel} />
            <DrankSheetKaart />
          </>
        )}

        {!laden && tab === 'betalingen' && (
          <section className="space-y-2">
            {zichtbareGroepen.length === 0 && (
              <p className="text-center text-sm text-gray-500 py-6">
                {z ? 'Niets gevonden.' : 'Nog geen betalingen. Maak er een met "+ Betaling".'}
              </p>
            )}
            {zichtbareGroepen.map(g => {
              const procent = g.aantal ? Math.round((g.aantalBetaald / g.aantal) * 100) : 100;
              const teLaat = g.posten.some(p => fin.isTeLaat(p));
              return (
                <button
                  key={g.sleutel}
                  onClick={() => setOpenGroep(g.sleutel)}
                  className="w-full text-left bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-100 dark:border-gray-800 p-4 space-y-2"
                >
                  <div className="flex items-start gap-3">
                    <span className="material-icons-round text-gray-400 mt-0.5">
                      {g.soort === 'drank' ? 'local_bar' : 'receipt_long'}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">{g.titel}</p>
                      <p className="text-xs text-gray-500">
                        {g.aantalBetaald}/{g.aantal} betaald · {euro(g.betaald)} van {euro(g.totaal)}
                        {g.vervaldatum && ` · voor ${datumKort(g.vervaldatum)}`}
                      </p>
                    </div>
                    {teLaat && (
                      <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600">
                        te laat
                      </span>
                    )}
                  </div>
                  <div className="h-1.5 rounded-full bg-gray-100 dark:bg-gray-800 overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full" style={{ width: `${procent}%` }} />
                  </div>
                </button>
              );
            })}
          </section>
        )}
      </main>

      {groep && (
        <BetalingSheet groep={groep} currentUser={currentUser} onClose={() => setOpenGroep(null)} onGewijzigd={laad} />
      )}
      {leider && (
        <LeiderSheet leider={leider} currentUser={currentUser} onClose={() => setOpenLeider(null)} onGewijzigd={laad} />
      )}
      {nieuw && (
        <NieuweBetalingSheet
          currentUser={currentUser}
          onClose={() => setNieuw(false)}
          onGemaakt={async () => {
            setNieuw(false);
            setTab('betalingen');
            await laad();
          }}
        />
      )}
    </div>
  );
};
