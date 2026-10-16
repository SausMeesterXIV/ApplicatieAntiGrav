import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from './DrinkContext';

import { ChevronBack } from '../../components/ChevronBack';
import { BottomSheet } from '../../components/Modal';
import { Groep, Rij } from '../../components/Lijst';
import { hapticSuccess } from '../../lib/haptics';
import { StrepenAdminPanel } from './StrepenAdminPanel';
import { SPECIAL_DRINKS, inVasteVolgorde } from '../../lib/constants';
import { updateProfile } from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';
import { hasRole } from '../../lib/roleUtils';
import { euro } from '../../lib/geld';

// Strepen (design-update): zelfde stijl als het startscherm en Instellingen.
// Bovenaan wat je vandaag streepte en je voorlopige rekening, daaronder drank kiezen en strepen,
// en onderaan een gegroepeerde lijst (geschiedenis, ranking, nudge, snelle drank).
// Het Team Drank-dashboard staat hier niet meer: daarvoor is er een eigen bol op het startscherm.

const isVandaag = d => {
  const x = new Date(d);
  const n = new Date();
  return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate();
};

const Label = ({ children }) => (
  <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-2">{children}</p>
);

export const StrepenScreen = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useAuth();
  const { balances, streaks, handleAddCost, dranken, activePeriod } = useDrink();

  // Hier streep je altijd voor jezelf; Drankteam streept voor anderen via het Team Drank-dashboard
  const isTeamDrank = hasRole(currentUser, 'drank') || hasRole(currentUser, 'hoofdleiding');

  const [selectedDrink, setSelectedDrink] = useState(null);
  const [aantal, setAantal] = useState(1);
  const [plusEen, setPlusEen] = useState(null); // korte "+N"-animatie
  const [beheerOpen, setBeheerOpen] = useState(false);
  const [snelOpen, setSnelOpen] = useState(false);

  const rekening = (balances && currentUser && balances[currentUser.id]) || 0;
  const vandaag = useMemo(
    () =>
      streaks
        .filter(s => s.userId === currentUser?.id && isVandaag(s.timestamp))
        .reduce((som, s) => som + (s.amount || 1), 0),
    [streaks, currentUser?.id],
  );

  // Alle dranken (Freedom eerst), behalve Bak Freedom (eigen knop). Enkel een drank uit deze lijst mag
  // klaarstaan: anders stond bij het openen bv. "Bak Freedom" (eerste in het alfabet) klaar zonder dat je hem zag.
  const keuzeDranken = useMemo(
    () => inVasteVolgorde(dranken.filter(d => d.name !== SPECIAL_DRINKS.BAK_FREEDOM)),
    [dranken],
  );
  const bakFreedom = dranken.find(d => d.name === SPECIAL_DRINKS.BAK_FREEDOM);

  useEffect(() => {
    if (!keuzeDranken.some(d => d.id === selectedDrink?.id)) setSelectedDrink(keuzeDranken[0] || null);
  }, [keuzeDranken, selectedDrink]);

  const snelleDrank =
    keuzeDranken.find(d => String(d.id) === String(currentUser?.quickDrinkId)) ||
    keuzeDranken.find(d => d.name === SPECIAL_DRINKS.PINT_FREEDOM) ||
    keuzeDranken[0];

  // Per ongeluk dubbel tikken (binnen 0,6 s) telt als één keer toevoegen
  const laatsteTik = useRef(0);
  const streep = async (drank, n) => {
    if (!drank || !currentUser) return;
    if (Date.now() - laatsteTik.current < 600) return;
    laatsteTik.current = Date.now();

    handleAddCost(currentUser.id, drank.id, n, currentUser.naam);
    setPlusEen(n);
    setTimeout(() => setPlusEen(null), 800);
    await hapticSuccess();
  };

  const kiesSnelleDrank = async drank => {
    try {
      await updateProfile(currentUser.id, { quick_drink_id: drank.id });
      setCurrentUser({ ...currentUser, quickDrinkId: drank.id, quick_drink_id: drank.id });
      showToast(`Snelle drank: ${drank.name}`, 'success');
      setSnelOpen(false);
    } catch {
      showToast('Snelle drank opslaan mislukt', 'error');
    }
  };

  const n = Math.max(1, aantal || 1);

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white pb-nav-safe">
      <header className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-2 flex items-center gap-2">
        <ChevronBack onClick={() => navigate(-1)} />
        <h1 className="flex-1 text-[28px] font-extrabold tracking-tight">Strepen</h1>
        {isTeamDrank && (
          <button
            type="button"
            onClick={() => setBeheerOpen(true)}
            className="w-10 h-10 rounded-full bg-kaart-event dark:bg-kaart-event-d flex items-center justify-center"
            aria-label="Dranken beheren"
          >
            <span className="material-icons-round text-xl">tune</span>
          </button>
        )}
      </header>

      <main className="flex-1 px-4 pt-2 space-y-6">
        {/* Vandaag en voorlopige rekening */}
        <article className="rounded-[28px] bg-kaart-strepen dark:bg-kaart-strepen-d p-6">
          <p className="text-base text-slate-600 dark:text-slate-300">Vandaag gestreept</p>
          <p className="text-7xl font-extrabold leading-none tabular-nums">{vandaag}</p>
          <button
            type="button"
            onClick={() => navigate('/mijn-factuur')}
            className="mt-6 w-full rounded-2xl bg-white dark:bg-white/10 px-5 py-4 flex items-center justify-between text-left active:scale-[0.99]"
          >
            <span className="min-w-0">
              <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">
                Voorlopige rekening{activePeriod ? ` · ${activePeriod.naam}` : ''}
              </span>
              <span className="block text-2xl font-extrabold tabular-nums">{euro(rekening)}</span>
            </span>
            <span className="material-icons-round text-xl text-gray-500 dark:text-gray-400">chevron_right</span>
          </button>
        </article>

        {/* Strepen zetten */}
        <section className="relative rounded-[28px] bg-kaart-event dark:bg-kaart-event-d p-5 space-y-5">
          {plusEen && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
              <span className="text-5xl font-extrabold animate-bounce-up">+{plusEen}</span>
            </div>
          )}

          <div>
            <Label>Drank</Label>
            <div className="flex flex-wrap gap-2">
              {keuzeDranken.map(drank => {
                const actief = selectedDrink?.id === drank.id;
                return (
                  <button
                    key={drank.id}
                    type="button"
                    onClick={() => setSelectedDrink(drank)}
                    aria-pressed={actief}
                    className={`rounded-full px-4 py-2.5 text-sm font-bold flex items-center gap-1 ${
                      actief ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'bg-white dark:bg-white/10'
                    }`}
                  >
                    {drank.name}
                    {drank.isTemporary && <span className="material-icons-round text-sm opacity-70">timer</span>}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <Label>Aantal</Label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setAantal(Math.max(1, n - 1))}
                className="w-14 h-14 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center active:scale-95"
                aria-label="Eén minder"
              >
                <span className="material-icons-round text-2xl">remove</span>
              </button>
              <input
                type="number"
                inputMode="numeric"
                pattern="[0-9]*"
                min="1"
                value={aantal || ''}
                onChange={e => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                  if (!isNaN(val)) setAantal(Math.max(0, val));
                }}
                onBlur={() => setAantal(n)}
                onClick={e => e.target.select()}
                aria-label="Aantal"
                className="flex-1 min-w-0 h-14 rounded-2xl bg-white dark:bg-white/10 border-0 text-center text-3xl font-extrabold tabular-nums focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
              />
              <button
                type="button"
                onClick={() => setAantal(n + 1)}
                className="w-14 h-14 rounded-2xl bg-white dark:bg-white/10 flex items-center justify-center active:scale-95"
                aria-label="Eén meer"
              >
                <span className="material-icons-round text-2xl">add</span>
              </button>
            </div>
          </div>

          <button
            type="button"
            disabled={!selectedDrink}
            onClick={async () => {
              await streep(selectedDrink, n);
              setAantal(1);
            }}
            className="w-full rounded-2xl bg-inkt dark:bg-white px-5 py-4 flex items-center justify-between gap-3 text-white dark:text-inkt active:scale-[0.99] disabled:opacity-40"
          >
            <span className="text-xl font-bold truncate">
              {selectedDrink ? `${n}× ${selectedDrink.name}` : 'Kies een drank'}
            </span>
            <span className="text-xl font-extrabold tabular-nums shrink-0">
              {euro((selectedDrink?.price || 0) * n)}
            </span>
          </button>

          {bakFreedom && (
            <button
              type="button"
              onClick={() => streep(bakFreedom, 1)}
              className="w-full rounded-2xl bg-white dark:bg-white/10 px-5 py-4 flex items-center justify-between gap-3 active:scale-[0.99]"
            >
              <span className="flex items-center gap-3 min-w-0">
                <span className="material-icons-round text-2xl text-gray-500 dark:text-gray-400">sports_bar</span>
                <span className="text-base font-bold truncate">{bakFreedom.name}</span>
              </span>
              <span className="flex items-center gap-3 shrink-0">
                <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">{euro(bakFreedom.price)}</span>
                <span className="text-xl font-extrabold">+1</span>
              </span>
            </button>
          )}
        </section>

        <Groep titel="Meer">
          <Rij icoon="history" label="Mijn geschiedenis" onClick={() => navigate('/strepen/geschiedenis')} />
          <Rij icoon="emoji_events" label="Ranking" waarde="Deze periode" onClick={() => navigate('/strepen/ranking')} />
          <Rij icoon="back_hand" label="Stuur een nudge" onClick={() => navigate('/nudges')} />
          <Rij
            icoon="bolt"
            label="Snelle drank"
            waarde={snelleDrank?.name || 'Kies'}
            onClick={() => setSnelOpen(true)}
          />
        </Groep>
      </main>

      <BottomSheet
        isOpen={snelOpen}
        onClose={() => setSnelOpen(false)}
        title="Snelle drank"
        subtitle="De grote +1-knop op je startscherm"
      >
        <ul className="pb-4 divide-y divide-gray-100 dark:divide-gray-800">
          {keuzeDranken.map(d => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => kiesSnelleDrank(d)}
                className="w-full flex items-center justify-between py-3.5 text-left"
              >
                <span className="font-semibold">{d.name}</span>
                {String(d.id) === String(snelleDrank?.id) && <span className="material-icons-round">check</span>}
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>

      {isTeamDrank && (
        <BottomSheet isOpen={beheerOpen} onClose={() => setBeheerOpen(false)} title="Dranken beheren">
          <StrepenAdminPanel
            onDrinkDeleted={id => {
              if (selectedDrink?.id === id) setSelectedDrink(null);
            }}
          />
        </BottomSheet>
      )}
    </div>
  );
};
