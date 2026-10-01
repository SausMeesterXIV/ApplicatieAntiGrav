import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from '../drank/DrinkContext';
import { useFries } from '../friet/FriesContext';
import * as db from '../../lib/supabaseService';
import { SPECIAL_DRINKS } from '../../lib/constants';
import { hapticSuccess } from '../../lib/haptics';
import { showToast } from '../../components/Toast';

// Het grote vierkant op het startscherm, veegbaar zoals een Instagram-post met meerdere foto's.
// Volgorde: ranking eerst, dan strepen. Zolang er een frietronde loopt (open, wordt besteld, afhalen,
// en tot een halfuur na het afhaaluur "Smakelijk") staat de frietkaart helemaal vooraan; daarna verdwijnt ze.

export const HomeCarrousel = () => {
  const { rondeLoopt } = useFries();

  const kaarten = [
    ...(rondeLoopt ? [{ id: 'friet', Kaart: FrietKaart }] : []),
    { id: 'ranking', Kaart: RankingKaart },
    { id: 'strepen', Kaart: StrepenKaart },
  ];

  const baan = useRef(null);
  const [actief, setActief] = useState(0);

  // Als de volgorde verandert (ronde gaat open of dicht): terug naar de eerste kaart
  const volgorde = kaarten.map(k => k.id).join();
  useEffect(() => {
    baan.current?.scrollTo({ left: 0 });
    setActief(0);
  }, [volgorde]);

  const opScroll = () => {
    const el = baan.current;
    if (!el?.firstElementChild) return;
    const stap = el.firstElementChild.getBoundingClientRect().width + 12; // kaartbreedte + gap-3
    setActief(Math.min(kaarten.length - 1, Math.max(0, Math.round(el.scrollLeft / stap))));
  };

  const gaNaar = i => {
    const el = baan.current;
    const kaart = el?.children[i];
    if (kaart) el.scrollTo({ left: kaart.offsetLeft - el.offsetLeft, behavior: 'smooth' });
  };

  return (
    <section aria-roledescription="carrousel" aria-label="Snel strepen en friet" className="space-y-3">
      <div className="relative group/carrousel">
        <div
          ref={baan}
          onScroll={opScroll}
          className="-mx-4 px-4 flex gap-3 overflow-x-auto snap-x snap-mandatory no-scrollbar scroll-px-4"
        >
          {kaarten.map(({ id, Kaart }, i) => (
            <div
              key={id}
              className="snap-start shrink-0 w-[calc(100%-20px)] aspect-square max-h-[440px] lg:max-h-[520px]"
              aria-roledescription="kaart"
              aria-label={`${i + 1} van ${kaarten.length}`}
            >
              <Kaart positie={`${i + 1}/${kaarten.length}`} />
            </div>
          ))}
        </div>

        {/* Pijlen voor muis en toetsenbord (op een computer kan je niet vegen) */}
        {[
          { richting: -1, icoon: 'chevron_left', label: 'Vorige kaart', plaats: 'left-2', zichtbaar: actief > 0 },
          {
            richting: 1,
            icoon: 'chevron_right',
            label: 'Volgende kaart',
            plaats: 'right-2',
            zichtbaar: actief < kaarten.length - 1,
          },
        ].map(p =>
          p.zichtbaar ? (
            <button
              key={p.richting}
              type="button"
              onClick={() => gaNaar(actief + p.richting)}
              aria-label={p.label}
              className={`hidden lg:flex absolute top-1/2 -translate-y-1/2 ${p.plaats} w-10 h-10 items-center justify-center rounded-full bg-white/95 dark:bg-inkt/90 text-inkt dark:text-white shadow-lg opacity-0 group-hover/carrousel:opacity-100 focus-visible:opacity-100 transition-opacity`}
            >
              <span className="material-icons-round">{p.icoon}</span>
            </button>
          ) : null,
        )}
      </div>
      <div className="flex justify-center gap-1.5" role="tablist" aria-label="Kaarten">
        {kaarten.map(({ id }, i) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={i === actief}
            aria-label={`Kaart ${i + 1}`}
            onClick={() => gaNaar(i)}
            className={`h-1.5 rounded-full transition-all ${
              i === actief ? 'w-4 bg-inkt dark:bg-white' : 'w-1.5 bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>
    </section>
  );
};

// ---------------------------------------------------------------------------

const Label = ({ children }) => (
  <span className="inline-block rounded-full bg-white/90 dark:bg-black/30 px-3 py-1.5 text-sm font-bold text-inkt dark:text-white">
    {children}
  </span>
);

const Positie = ({ children }) => (
  <span className="rounded-full bg-inkt/80 dark:bg-white/20 px-2.5 py-1 text-xs font-bold text-white tabular-nums">
    {children}
  </span>
);

const Kop = ({ label, positie }) => (
  <div className="flex items-start justify-between gap-2">
    <Label>{label}</Label>
    <Positie>{positie}</Positie>
  </div>
);

// Frietzak-icoon zoals in de wireframe (lijnen, geen opvulling)
const Frietzak = () => (
  <svg viewBox="0 0 64 64" className="w-20 h-20 text-amber-500 dark:text-amber-400" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 28V12M30 28V6M38 28V10M44 28V16" />
      <path d="M12 26h40l-6 30H18z" />
    </g>
  </svg>
);

const FrietKaart = ({ positie }) => {
  const navigate = useNavigate();
  const { frietFase, friesPickupTime, friesOrders } = useFries();

  const bestellingen = friesOrders.filter(o => o.status === 'open');
  const namen = [...new Set(bestellingen.map(o => (o.userName || '').split(' ')[0]).filter(Boolean))];
  const wie =
    namen.length === 0
      ? 'Nog niemand besteld'
      : namen.length <= 2
        ? namen.join(' en ')
        : `${namen.slice(0, 2).join(', ')} en ${namen.length - 2} ${namen.length - 2 === 1 ? 'andere' : 'anderen'}`;
  const aantal = `${bestellingen.length} ${bestellingen.length === 1 ? 'bestelling' : 'bestellingen'}`;

  const Knop = ({ children }) => (
    <button
      type="button"
      onClick={() => navigate('/frituur')}
      className="mt-4 w-full rounded-2xl bg-inkt dark:bg-white py-3.5 text-base font-bold text-white dark:text-inkt active:scale-[0.99]"
    >
      {children}
    </button>
  );

  // Besteld: het afhaaluur in het groot
  if (frietFase === 'afhalen') {
    return (
      <article className="h-full rounded-[28px] bg-bol-friet dark:bg-bol-friet-d p-6 flex flex-col text-inkt dark:text-white">
        <Kop label="Besteld" positie={positie} />
        <div className="flex-1 flex flex-col justify-center">
          {friesPickupTime ? (
            <>
              <p className="text-lg font-semibold text-amber-900/80 dark:text-amber-100/80">Frieten afhalen om</p>
              <p className="text-[88px] leading-none font-extrabold tracking-tight tabular-nums">{friesPickupTime}</p>
            </>
          ) : (
            <h2 className="text-[40px] leading-[0.95] font-extrabold tracking-tight">
              Frieten
              <br />
              zijn besteld
            </h2>
          )}
        </div>
        <p className="text-sm text-amber-900/80 dark:text-amber-100/80">
          {aantal} · {wie}
        </p>
        <Knop>Bekijk de ronde</Knop>
      </article>
    );
  }

  // Tot een halfuur na het afhaaluur
  if (frietFase === 'smakelijk') {
    return (
      <article className="h-full rounded-[28px] bg-bol-friet dark:bg-bol-friet-d p-6 flex flex-col text-inkt dark:text-white">
        <Kop label="Frieten zijn er" positie={positie} />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center">
          <Frietzak />
          <p className="text-[56px] leading-none font-extrabold tracking-tight">Smakelijk!</p>
        </div>
        <Knop>Wie had wat?</Knop>
      </article>
    );
  }

  // Open (bestellen) of wordt besteld
  const open = frietFase === 'open';
  return (
    <article className="h-full rounded-[28px] bg-bol-friet dark:bg-bol-friet-d p-6 flex flex-col text-inkt dark:text-white">
      <Kop label={open ? 'Nu open' : 'Wordt besteld'} positie={positie} />
      <div className="flex-1 flex justify-end items-center">
        <Frietzak />
      </div>
      <h2 className="text-[40px] leading-[0.95] font-extrabold tracking-tight">
        {open ? 'Frietronde' : 'Frieten'}
        <br />
        {open ? 'is open' : 'worden besteld'}
      </h2>
      <p className="mt-2 text-sm text-amber-900/80 dark:text-amber-100/80">
        {aantal} · {wie}
      </p>
      <Knop>{open ? 'Bestel mee' : 'Bekijk de ronde'}</Knop>
    </article>
  );
};

const isVandaag = d => {
  const x = new Date(d);
  const n = new Date();
  return x.getFullYear() === n.getFullYear() && x.getMonth() === n.getMonth() && x.getDate() === n.getDate();
};

const StrepenKaart = ({ positie }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { streaks, dranken, handleAddCost } = useDrink();

  const vandaag = useMemo(
    () =>
      streaks
        .filter(s => s.userId === currentUser?.id && isVandaag(s.timestamp))
        .reduce((som, s) => som + (s.amount || 1), 0),
    [streaks, currentUser?.id],
  );

  // Snelle drank (instelbaar) + je twee meest gestreepte andere dranken
  const [snel, ...anderen] = useMemo(() => {
    const geldig = dranken.filter(d => d.name !== SPECIAL_DRINKS.BAK_FREEDOM);
    if (!geldig.length) return [];
    const snelste = geldig.find(d => String(d.id) === String(currentUser?.quickDrinkId)) || geldig[0];
    const telling = {};
    streaks
      .filter(s => s.userId === currentUser?.id)
      .forEach(s => (telling[s.drinkId] = (telling[s.drinkId] || 0) + (s.amount || 1)));
    const rest = geldig.filter(d => d.id !== snelste.id).sort((a, b) => (telling[b.id] || 0) - (telling[a.id] || 0));
    return [snelste, ...rest.slice(0, 2)];
  }, [dranken, streaks, currentUser?.id, currentUser?.quickDrinkId]);

  // Per ongeluk dubbel tikken (binnen 0,6 s op dezelfde drank) telt als één streep
  const laatsteTik = useRef({});
  const streep = drank => {
    if (!currentUser) return;
    const nu = Date.now();
    if (nu - (laatsteTik.current[drank.id] || 0) < 600) return;
    laatsteTik.current[drank.id] = nu;
    handleAddCost(currentUser.id, drank.id, 1, currentUser.naam);
    hapticSuccess();
    showToast(`+1 ${drank.name}`, 'success');
  };

  return (
    <article className="h-full rounded-[28px] bg-kaart-strepen dark:bg-kaart-strepen-d p-6 flex flex-col text-inkt dark:text-white">
      <Kop label="Strepen" positie={positie} />
      <p className="mt-6 text-base text-slate-600 dark:text-slate-300">Vandaag gestreept</p>
      <p className="text-7xl font-extrabold leading-none tabular-nums">{vandaag}</p>
      <div className="flex-1" />
      {snel ? (
        <div className="space-y-2">
          <button
            type="button"
            onClick={() => streep(snel)}
            className="w-full rounded-2xl bg-inkt dark:bg-white px-5 py-4 flex items-center justify-between text-white dark:text-inkt active:scale-[0.99]"
          >
            <span className="text-xl font-bold truncate">{snel.name}</span>
            <span className="text-2xl font-extrabold">+1</span>
          </button>
          <div className="grid grid-cols-3 gap-2">
            {anderen.map(d => (
              <button
                key={d.id}
                type="button"
                onClick={() => streep(d)}
                className="rounded-xl bg-white dark:bg-white/10 px-2 py-3 text-sm font-bold truncate active:scale-[0.98]"
              >
                {d.name} +1
              </button>
            ))}
            <button
              type="button"
              onClick={() => navigate('/strepen')}
              className={`rounded-xl bg-white dark:bg-white/10 px-2 py-3 text-sm font-bold ${
                ['col-span-3', 'col-span-2', ''][anderen.length]
              }`}
            >
              Alle…
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => navigate('/strepen')}
          className="w-full rounded-2xl bg-inkt dark:bg-white py-4 text-base font-bold text-white dark:text-inkt"
        >
          Naar strepen
        </button>
      )}
    </article>
  );
};

const RankingKaart = ({ positie }) => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { streaks } = useDrink();
  const [ranking, setRanking] = useState(null);

  // Opnieuw ophalen als er gestreept wordt
  useEffect(() => {
    db.fetchRanking()
      .then(setRanking)
      .catch(() => setRanking([]));
  }, [streaks.length]);

  const top = (ranking || []).slice(0, 3);
  const mijnPlek = (ranking || []).findIndex(r => r.user_id === currentUser?.id);

  return (
    <article className="h-full rounded-[28px] bg-kaart-event dark:bg-kaart-event-d p-6 flex flex-col text-inkt dark:text-white">
      <Kop label="Ranking" positie={positie} />
      <p className="mt-6 text-base text-slate-600 dark:text-slate-300">Meeste strepen deze periode</p>
      <ol className="mt-4 space-y-2 flex-1">
        {ranking === null && <li className="text-sm text-slate-500">Laden…</li>}
        {ranking?.length === 0 && <li className="text-sm text-slate-500">Nog geen strepen deze periode.</li>}
        {top.map((r, i) => (
          <li
            key={r.user_id}
            className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${
              r.user_id === currentUser?.id
                ? 'bg-inkt text-white dark:bg-white dark:text-inkt'
                : 'bg-white dark:bg-white/10'
            }`}
          >
            <span className="text-2xl font-extrabold w-6 tabular-nums">{i + 1}</span>
            <span className="flex-1 font-bold truncate">{r.naam}</span>
            <span className="font-bold tabular-nums">{r.strepen}</span>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => navigate('/strepen/ranking')}
        className="w-full rounded-2xl bg-white dark:bg-white/10 py-3 text-sm font-bold"
      >
        {mijnPlek >= 3 ? `Jij staat ${mijnPlek + 1}e · volledige ranking` : 'Volledige ranking'}
      </button>
    </article>
  );
};
