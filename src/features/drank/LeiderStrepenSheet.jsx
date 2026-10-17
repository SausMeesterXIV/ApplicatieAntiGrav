import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BottomSheet } from '../../components/Modal';
import { useDrink } from './DrinkContext';
import { inVasteVolgorde } from '../../lib/constants';
import { hapticSuccess } from '../../lib/haptics';
import { showToast } from '../../components/Toast';
import { euro } from '../../lib/geld';
import { drankLabel } from '../../lib/dranken';

// Drankteam: de strepen van één leider in de open periode bekijken, bijzetten en verwijderen.
// Bijzetten en verwijderen mag hier op elk moment; de database controleert dat je Drankteam bent.

const tijdstip = d =>
  new Date(d).toLocaleString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const Label = ({ children }) => (
  <p className="text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400 mb-2">{children}</p>
);

export const LeiderStrepenSheet = ({ leider, onClose }) => {
  const { dranken, alleDranken, streaks, activePeriod, handleAddCost, handleDeleteStreak } = useDrink();
  const [drankId, setDrankId] = useState(null);
  const [aantal, setAantal] = useState(1);
  const [ookAndere, setOokAndere] = useState(false);

  // Eerst wat nu beschikbaar is; Drankteam kan ook afgelopen/geplande tijdelijke dranken en dranken
  // die uit de lijst zijn kiezen (nieuwste eerst), bv. om achteraf iets te corrigeren.
  const beschikbaar = useMemo(() => inVasteVolgorde(dranken), [dranken]);
  const andere = useMemo(
    () =>
      alleDranken
        .filter(d => !dranken.some(b => b.id === d.id))
        .sort((a, b) => (b.geldigVan || 0) - (a.geldigVan || 0)),
    [alleDranken, dranken],
  );
  const keuze = ookAndere ? [...beschikbaar, ...andere] : beschikbaar;
  const drank = alleDranken.find(d => d.id === drankId) || beschikbaar[0] || null;
  const n = Math.max(1, aantal || 1);

  // Bij een andere leider opnieuw beginnen met 1× de eerste drank
  useEffect(() => {
    setDrankId(null);
    setAantal(1);
  }, [leider?.id]);

  const strepen = useMemo(
    () =>
      streaks
        .filter(s => s.userId === leider?.id && s.period_id === activePeriod?.id)
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)),
    [streaks, leider?.id, activePeriod?.id],
  );
  const totaal = strepen.reduce((som, s) => som + s.price * s.amount, 0);
  const aantalStrepen = strepen.reduce((som, s) => som + s.amount, 0);

  // Per ongeluk dubbel tikken (binnen 0,6 s) telt als één keer bijzetten
  const laatsteTik = useRef(0);
  const bijzetten = async () => {
    if (!drank || !leider) return;
    if (Date.now() - laatsteTik.current < 600) return;
    laatsteTik.current = Date.now();
    handleAddCost(leider.id, drank.id, n, leider.naam);
    showToast(`${n} ${drank.name} bij ${leider.naam}`, 'success');
    setAantal(1);
    await hapticSuccess();
  };

  const verwijder = s => {
    if (window.confirm(`${s.amount} ${s.drinkLabel || s.drinkName} van ${leider.naam} verwijderen?`)) handleDeleteStreak(s.id);
  };

  return (
    <BottomSheet
      isOpen={!!leider}
      onClose={onClose}
      title={leider?.naam || ''}
      subtitle={`${aantalStrepen} strepen · ${euro(totaal)} deze periode`}
    >
      <div className="pb-4 space-y-6 text-inkt dark:text-white">
        {!activePeriod ? (
          <p className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-5 py-4 text-sm">
            Er staat geen drankperiode open. Open eerst een periode via Facturen.
          </p>
        ) : (
          <section className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d p-4 space-y-4">
            <div>
              <Label>Bijzetten</Label>
              <div className="flex flex-wrap gap-2">
                {keuze.map(d => {
                  const actief = drank?.id === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDrankId(d.id)}
                      aria-pressed={actief}
                      className={`rounded-full px-4 py-2 text-sm font-bold ${
                        actief ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'bg-white dark:bg-white/10'
                      }`}
                    >
                      {d.isTemporary || d.uitLijst ? drankLabel(d) : d.name}
                    </button>
                  );
                })}
                {andere.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setOokAndere(!ookAndere)}
                    className="rounded-full px-4 py-2 text-sm font-bold text-gray-500 dark:text-gray-400 underline underline-offset-2"
                  >
                    {ookAndere ? 'Minder tonen' : `Andere dranken (${andere.length})`}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setAantal(Math.max(1, n - 1))}
                className="w-12 h-12 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center active:scale-95"
                aria-label="Eén minder"
              >
                <span className="material-icons-round">remove</span>
              </button>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                value={aantal || ''}
                onChange={e => {
                  const val = e.target.value === '' ? 0 : parseInt(e.target.value, 10);
                  if (!isNaN(val)) setAantal(Math.max(0, val));
                }}
                onBlur={() => setAantal(n)}
                onClick={e => e.target.select()}
                aria-label="Aantal"
                className="flex-1 min-w-0 h-12 rounded-xl bg-white dark:bg-white/10 border-0 text-center text-xl font-extrabold tabular-nums focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30"
              />
              <button
                type="button"
                onClick={() => setAantal(n + 1)}
                className="w-12 h-12 rounded-xl bg-white dark:bg-white/10 flex items-center justify-center active:scale-95"
                aria-label="Eén meer"
              >
                <span className="material-icons-round">add</span>
              </button>
            </div>

            <button
              type="button"
              disabled={!drank}
              onClick={bijzetten}
              className="w-full rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt px-5 py-3.5 flex items-center justify-between gap-3 text-lg font-bold active:scale-[0.99] disabled:opacity-40"
            >
              <span className="truncate">
                +{n} {drank?.name}
              </span>
              <span className="tabular-nums shrink-0">{euro((drank?.price || 0) * n)}</span>
            </button>
          </section>
        )}

        <section className="space-y-2">
          <Label>Strepen deze periode</Label>
          {strepen.length === 0 ? (
            <p className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-5 py-4 text-sm text-gray-500 dark:text-gray-400">
              Nog geen strepen deze periode.
            </p>
          ) : (
            <ul className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-hidden divide-y divide-white dark:divide-white/5">
              {strepen.map(s => (
                <li key={s.id} className="px-4 py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold truncate">
                      {s.amount} {s.drinkLabel || s.drinkName}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 tabular-nums">
                      {tijdstip(s.timestamp)} · {euro(s.price * s.amount)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => verwijder(s)}
                    className="shrink-0 rounded-full bg-red-50 dark:bg-red-900/15 text-red-600 dark:text-red-400 px-3.5 py-2 text-sm font-bold active:scale-95"
                    aria-label={`${s.amount} ${s.drinkLabel || s.drinkName} verwijderen`}
                  >
                    Verwijder
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </BottomSheet>
  );
};
