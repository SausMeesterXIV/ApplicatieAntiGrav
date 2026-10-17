import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ChevronBack } from '../../components/ChevronBack';
import { BottomSheet } from '../../components/Modal';
import { UserAvatar } from '../../components/UserAvatar';

// Mijn leiding (bol voor alle leiding): wie is er dit jaar leiding, met profielfoto, per groep of per rol.
// Oudleiding, inactieve accounts en Godmode (staat buiten de leiding) tonen we niet.

const INDELING = [
  ['groep', 'Per groep'],
  ['rol', 'Per rol'],
  ['naam', 'A–Z'],
];

export const MijnLeidingScreen = () => {
  const navigate = useNavigate();
  const { users, groepen, werkgroepen } = useAuth();
  const [indeling, setIndeling] = useState('groep');
  const [filter, setFilter] = useState(null); // null | 'hoofd' | 'g:<id>' | 'w:<id>'
  const [zoek, setZoek] = useState('');
  const [gekozen, setGekozen] = useState(null);

  const leiding = useMemo(
    () =>
      (users || [])
        .filter(u => u.actief && !u.isOudleiding && !u.isGodmode)
        .sort((a, b) => (a.naam || '').localeCompare(b.naam || '')),
    [users],
  );

  const groepVan = u => groepen.find(g => u.groepIds?.includes(g.id));
  const werkgroepenVan = u => werkgroepen.filter(w => u.werkgroepIds?.includes(w.id));

  const past = u => {
    const q = zoek.trim().toLowerCase();
    if (q && !`${u.naam || ''} ${u.nickname || ''}`.toLowerCase().includes(q)) return false;
    if (!filter) return true;
    if (filter === 'hoofd') return u.isHoofdleiding;
    const [soort, id] = filter.split(':');
    return soort === 'g' ? u.groepIds?.includes(Number(id)) : u.werkgroepIds?.includes(id);
  };
  const zichtbaar = leiding.filter(past);

  // Secties volgens de gekozen indeling; iemand met meerdere rollen staat in elke rol
  const secties = useMemo(() => {
    if (indeling === 'naam') return [{ titel: null, leden: zichtbaar }];
    if (indeling === 'groep') {
      const lijst = groepen.map(g => ({ titel: g.naam, leden: zichtbaar.filter(u => u.groepIds?.includes(g.id)) }));
      lijst.push({ titel: 'Nog geen groep', leden: zichtbaar.filter(u => !u.groepIds?.length) });
      return lijst.filter(s => s.leden.length);
    }
    const lijst = [
      { titel: 'Hoofdleiding', leden: zichtbaar.filter(u => u.isHoofdleiding) },
      ...werkgroepen.map(w => ({ titel: w.naam, leden: zichtbaar.filter(u => u.werkgroepIds?.includes(w.id)) })),
      { titel: 'Zonder rol', leden: zichtbaar.filter(u => !u.isHoofdleiding && !u.werkgroepIds?.length) },
    ];
    return lijst.filter(s => s.leden.length);
  }, [indeling, zichtbaar, groepen, werkgroepen]);

  const chips = [
    [null, 'Iedereen'],
    ...groepen.map(g => [`g:${g.id}`, g.naam]),
    ['hoofd', 'Hoofdleiding'],
    ...werkgroepen.map(w => [`w:${w.id}`, w.naam]),
  ];

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white pb-nav-safe">
      <header className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-2 flex items-center gap-2">
        <ChevronBack onClick={() => navigate(-1)} />
        <div className="min-w-0 flex-1">
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">Mijn leiding</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">{leiding.length} leiders dit werkjaar</p>
        </div>
      </header>

      <main className="flex-1 px-4 pt-2 space-y-4">
        <label className="flex items-center gap-2 rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-4">
          <span className="material-icons-round text-xl text-gray-500 dark:text-gray-400">search</span>
          <input
            type="search"
            value={zoek}
            onChange={e => setZoek(e.target.value)}
            placeholder="Zoek op naam"
            aria-label="Zoek op naam"
            className="flex-1 min-w-0 bg-transparent border-0 py-3.5 text-base focus:outline-none focus:ring-0"
          />
        </label>

        <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-gray-200/70 dark:bg-gray-800" role="tablist">
          {INDELING.map(([id, label]) => (
            <button
              key={id}
              role="tab"
              aria-selected={indeling === id}
              onClick={() => setIndeling(id)}
              className={`py-1.5 rounded-lg text-sm font-bold transition ${indeling === id ? 'bg-white dark:bg-[#1e2330] shadow-sm' : 'text-gray-500'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {chips.map(([id, label]) => (
            <button
              key={id || 'alle'}
              type="button"
              onClick={() => setFilter(id)}
              aria-pressed={filter === id}
              className={`px-3 py-1.5 rounded-full text-sm font-semibold ${
                filter === id ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'bg-kaart-event dark:bg-kaart-event-d'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {zichtbaar.length === 0 && (
          <p className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-5 py-6 text-center text-sm text-gray-500 dark:text-gray-400">
            Niemand gevonden.
          </p>
        )}

        {secties.map(s => (
          <section key={s.titel || 'alle'} className="space-y-2">
            {s.titel && (
              <h2 className="px-1 text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">
                {s.titel} · {s.leden.length}
              </h2>
            )}
            <ul className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-2">
              {s.leden.map(u => (
                <li key={u.id}>
                  <button
                    type="button"
                    onClick={() => setGekozen(u)}
                    className="w-full rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-2 py-3 flex flex-col items-center gap-2 text-center active:scale-[0.98] transition-transform"
                  >
                    <UserAvatar user={u} size="xl" />
                    <span className="w-full text-sm font-bold leading-tight line-clamp-2">{u.naam}</span>
                    <span className="w-full text-xs text-gray-500 dark:text-gray-400 truncate">
                      {u.isHoofdleiding ? 'Hoofdleiding' : groepVan(u)?.naam || '—'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </main>

      <BottomSheet isOpen={!!gekozen} onClose={() => setGekozen(null)} title={gekozen?.naam}>
        {gekozen && (
          <div className="flex flex-col items-center gap-4 pb-4 text-center">
            <UserAvatar user={gekozen} size="xl" className="!h-28 !w-28 !text-3xl" />
            {gekozen.nickname && <p className="text-gray-500 dark:text-gray-400">„{gekozen.nickname}"</p>}
            <div className="flex flex-wrap justify-center gap-2">
              {groepVan(gekozen) && (
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-bol-agenda dark:bg-bol-agenda-d">
                  {groepVan(gekozen).naam}
                </span>
              )}
              {gekozen.isHoofdleiding && (
                <span className="px-3 py-1.5 rounded-full text-sm font-semibold bg-inkt text-white dark:bg-white dark:text-inkt">
                  Hoofdleiding
                </span>
              )}
              {werkgroepenVan(gekozen).map(w => (
                <span key={w.id} className="px-3 py-1.5 rounded-full text-sm font-semibold bg-kaart-event dark:bg-white/10">
                  {w.naam}
                </span>
              ))}
            </div>
          </div>
        )}
      </BottomSheet>
    </div>
  );
};
