import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from '../drank/DrinkContext';
import { useAgenda } from '../agenda/AgendaContext';
import { useFries } from '../friet/FriesContext';
import { isHoofdleiding } from '../../lib/roleUtils';
import * as db from '../../lib/supabaseService';
import { UserAvatar } from '../../components/UserAvatar';
import { SkeletonCard, SkeletonEvent } from '../../components/Skeleton';
import { Bollenrij } from './Bollenrij';
import { HomeCarrousel } from './HomeCarrousel';
import { bollenVoor, gekozenVolgorde } from './bollen';

// Startscherm (design-update, Instagram-stijl):
// bollen bovenaan · groot veegbaar vierkant (friet als er een ronde loopt, strepen, ranking)
// · twee eerstvolgende agenda-items · aftelling naar kamp.

const DAG = 24 * 60 * 60 * 1000;
const middernacht = d => {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
};

// Rol onder "Hoi …": hoofdleiding, anders je eerste werkgroep, anders gewoon leiding
const rolLabel = user =>
  isHoofdleiding(user)
    ? 'hoofdleiding'
    : (user?.roles || []).find(r => r !== 'Hoofdleiding')?.toLowerCase() || 'leiding';

export const HomeScreen = () => {
  const navigate = useNavigate();
  const { currentUser, loading: authLoading } = useAuth();
  const { loading: drinkLoading } = useDrink();
  const { events, countdowns, notifications } = useAgenda();
  const { rondeLoopt } = useFries();

  const loading = authLoading || drinkLoading;
  const naam = currentUser?.nickname || currentUser?.naam?.split(' ')[0] || '';

  // Polls waarop je nog niet stemde (voor de ring rond Polls)
  const [openPolls, setOpenPolls] = useState(0);
  useEffect(() => {
    if (!currentUser) return;
    db.fetchPolls()
      .then(polls =>
        setOpenPolls(polls.filter(p => p.isOpen && !p.stemmen.some(s => s.user_id === currentUser.id)).length),
      )
      .catch(() => {});
  }, [currentUser?.id]);

  const bollen = useMemo(() => bollenVoor(currentUser, gekozenVolgorde(currentUser)), [currentUser]);

  // Oranje ring: er is iets nieuws of iets open
  const nieuw = useMemo(() => {
    const ongelezen = type => notifications.some(n => n.type === type && !n.isRead);
    const s = new Set();
    if (rondeLoopt) s.add('friet');
    if (ongelezen('agenda')) s.add('agenda');
    if (openPolls > 0 || ongelezen('poll')) s.add('polls');
    if (ongelezen('verslag')) s.add('verslagen');
    return s;
  }, [notifications, rondeLoopt, openPolls]);

  const eerstvolgend = useMemo(() => {
    const vandaag = middernacht(new Date());
    return (events || [])
      .filter(e => e?.date && new Date(e.date) >= vandaag)
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(0, 2);
  }, [events]);

  const aftelling = useMemo(() => {
    const vandaag = middernacht(new Date());
    return (countdowns || [])
      .map(c => ({ ...c, doel: middernacht(c.targetDate) }))
      .filter(c => c.doel >= vandaag)
      .sort((a, b) => a.doel - b.doel)[0];
  }, [countdowns]);

  return (
    <div className="flex flex-col min-h-full bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white">
      <header className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
            Hoi {naam || 'daar'} · {rolLabel(currentUser)}
          </p>
          <h1 className="text-[28px] leading-tight font-extrabold tracking-tight">ksa aalter</h1>
        </div>
        <button
          type="button"
          onClick={() => navigate('/settings')}
          aria-label="Instellingen"
          className="shrink-0 rounded-full"
        >
          <UserAvatar user={currentUser || undefined} size="md" />
        </button>
      </header>

      <main className="flex-1 px-4 pb-8 space-y-6">
        <Bollenrij bollen={bollen} nieuw={nieuw} />

        {loading ? (
          <div className="space-y-4">
            <SkeletonCard lines={6} />
            <SkeletonEvent />
          </div>
        ) : (
          // Computer: vierkant links, agenda en aftelling rechts. Gsm: alles onder elkaar.
          <div className="space-y-6 lg:space-y-0 lg:grid lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-8 lg:items-start">
            <HomeCarrousel />

            <div className="space-y-6">
              <section className="space-y-3" aria-labelledby="eerstvolgend">
                <div className="flex items-baseline justify-between">
                  <h2 id="eerstvolgend" className="text-lg font-bold">
                    Eerstvolgend
                  </h2>
                  <button type="button" onClick={() => navigate('/agenda')} className="text-sm font-semibold">
                    Hele agenda
                  </button>
                </div>
                {eerstvolgend.length === 0 ? (
                  <p className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d px-4 py-5 text-sm text-gray-500 dark:text-gray-400">
                    Niets gepland. Zet iets in de agenda met de + op het agendascherm.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {eerstvolgend.map(e => (
                      <li key={e.id}>
                        <EventRij event={e} onClick={() => navigate('/agenda')} />
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {aftelling && <KampAftelling aftelling={aftelling} />}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

const EventRij = ({ event, onClick }) => {
  const d = new Date(event.date);
  const dag = d.toLocaleDateString('nl-BE', { weekday: 'short' }).replace('.', '').slice(0, 2).toUpperCase();
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl bg-kaart-event dark:bg-kaart-event-d p-3 flex items-center gap-4 active:scale-[0.99] transition-transform"
    >
      <span className="w-14 h-14 shrink-0 rounded-xl bg-white dark:bg-white/10 flex flex-col items-center justify-center leading-none">
        <span className="text-[11px] font-semibold text-gray-500 dark:text-gray-400">{dag}</span>
        <span className="text-xl font-extrabold tabular-nums mt-0.5">{d.getDate()}</span>
      </span>
      <span className="min-w-0">
        <span className="block font-bold text-base truncate">{event.title}</span>
        <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">
          {event.startTime}
          {event.location ? ` · ${event.location}` : ''}
        </span>
      </span>
    </button>
  );
};

// Aftelling naar de eerstvolgende aftelklok (bv. kamp). De balk loopt vanaf het begin van het werkjaar (15 augustus).
const KampAftelling = ({ aftelling }) => {
  const vandaag = middernacht(new Date());
  const nachten = Math.round((aftelling.doel - vandaag) / DAG);

  const jaar =
    aftelling.doel.getMonth() > 7 || (aftelling.doel.getMonth() === 7 && aftelling.doel.getDate() >= 15)
      ? aftelling.doel.getFullYear()
      : aftelling.doel.getFullYear() - 1;
  const start = new Date(jaar, 7, 15);
  const voortgang = Math.min(1, Math.max(0, (vandaag - start) / (aftelling.doel - start || 1)));

  const vertrek = aftelling.doel
    .toLocaleDateString('nl-BE', { weekday: 'short', day: 'numeric', month: 'short' })
    .replace(/\./g, '');

  return (
    <section
      aria-label={`Aftellen naar ${aftelling.title}`}
      className="rounded-[24px] bg-kaart-kamp dark:bg-kaart-kamp-d px-5 py-4 flex items-center gap-4"
    >
      <div className="flex-1 min-w-0 space-y-2">
        <p className="font-bold text-violet-700 dark:text-violet-300 truncate">Aftellen naar {aftelling.title}</p>
        <div className="h-2 rounded-full bg-white dark:bg-white/10 overflow-hidden">
          <div className="h-full rounded-full bg-violet-500" style={{ width: `${Math.round(voortgang * 100)}%` }} />
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-300">vertrek {vertrek}</p>
      </div>
      <div className="text-right shrink-0">
        {nachten === 0 ? (
          <p className="text-2xl font-extrabold text-violet-800 dark:text-violet-200">Vandaag!</p>
        ) : (
          <>
            <p className="text-5xl font-extrabold leading-none text-violet-800 dark:text-violet-200 tabular-nums">
              {nachten}
            </p>
            <p className="text-sm font-bold text-violet-700 dark:text-violet-300">
              {nachten === 1 ? 'nacht' : 'nachten'}
            </p>
          </>
        )}
      </div>
    </section>
  );
};
