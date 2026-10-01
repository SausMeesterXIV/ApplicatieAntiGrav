import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { useAgenda } from '../agenda/AgendaContext';
import * as db from '../../lib/supabaseService';
import { isHoofdleiding } from '../../lib/roleUtils';
import { ChevronBack } from '../../components/ChevronBack';
import { BottomSheet } from '../../components/Modal';
import { Bijlagen, NieuweBijlagen } from '../../components/Bijlagen';
import { showToast } from '../../components/Toast';

// Verslagen van groepsraden: iedereen leest en schrijft; aanpassen/verwijderen: auteur en hoofdleiding.
// Optioneel gekoppeld aan een agenda-item; bijlagen (bv. pdf) in privé-opslag.

const datumTekst = d => new Date(d).toLocaleDateString('nl-BE', { day: 'numeric', month: 'long', year: 'numeric' });
const vandaag = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const VerslagenScreen = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const [verslagen, setVerslagen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [zoek, setZoek] = useState('');
  const [open, setOpen] = useState(null); // id van het opengeklapte verslag
  const [bewerken, setBewerken] = useState(null); // null = dicht, {} = nieuw, verslag = bewerken

  const laad = () =>
    db
      .fetchVerslagen()
      .then(setVerslagen)
      .catch(e => {
        console.error(e);
        showToast('Verslagen laden mislukt', 'error');
      })
      .finally(() => setLaden(false));

  useEffect(() => {
    laad();
  }, []);

  const magAanpassen = v => v.auteur_id === currentUser?.id || isHoofdleiding(currentUser);

  const zichtbaar = useMemo(() => {
    const z = zoek.trim().toLowerCase();
    if (!z) return verslagen;
    return verslagen.filter(v => `${v.titel} ${v.inhoud || ''} ${v.event?.titel || ''}`.toLowerCase().includes(z));
  }, [verslagen, zoek]);

  const verwijder = async v => {
    if (!window.confirm(`Verslag "${v.titel}" en de bijlagen verwijderen?`)) return;
    try {
      await db.deleteVerslag(v.id);
      setVerslagen(prev => prev.filter(x => x.id !== v.id));
      showToast('Verslag verwijderd', 'info');
    } catch (e) {
      showToast(e.message || 'Verwijderen mislukt', 'error');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800 space-y-3">
        <div className="flex items-center gap-3">
          <ChevronBack onClick={() => navigate(-1)} />
          <h1 className="text-xl font-bold flex-1">Verslagen</h1>
          <button
            onClick={() => setBewerken({})}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-600 text-white flex items-center gap-1"
          >
            <span className="material-icons-round text-base">add</span> Nieuw
          </button>
        </div>
        <input
          value={zoek}
          onChange={e => setZoek(e.target.value)}
          placeholder="Zoek in verslagen…"
          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1e2330] border border-gray-200 dark:border-gray-700 text-sm"
        />
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-3">
        {laden && <p className="text-center text-sm text-gray-500 py-6">Laden…</p>}
        {!laden && zichtbaar.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-6">
            {zoek ? 'Geen verslagen gevonden.' : 'Nog geen verslagen. Voeg het eerste toe met "Nieuw".'}
          </p>
        )}

        {zichtbaar.map(v => {
          const isOpen = open === v.id;
          return (
            <article
              key={v.id}
              className="bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden"
            >
              <button onClick={() => setOpen(isOpen ? null : v.id)} className="w-full text-left p-4 flex gap-3">
                <span className="material-icons-round text-blue-600 dark:text-blue-400">description</span>
                <div className="flex-1 min-w-0">
                  <h2 className="font-bold truncate">{v.titel}</h2>
                  <p className="text-xs text-gray-500">
                    {datumTekst(v.datum)}
                    {v.auteur && ` · ${v.auteur.nickname || v.auteur.naam}`}
                    {v.event && ` · ${v.event.titel}`}
                  </p>
                </div>
                <span className="material-icons-round text-gray-400">{isOpen ? 'expand_less' : 'expand_more'}</span>
              </button>

              {isOpen && (
                <div className="px-4 pb-4 space-y-3">
                  {v.inhoud && (
                    <p className="text-sm whitespace-pre-wrap text-gray-700 dark:text-gray-300">{v.inhoud}</p>
                  )}
                  <Bijlagen item={{ verslagId: v.id }} magBeheren={magAanpassen(v)} />
                  {magAanpassen(v) && (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setBewerken(v)}
                        className="flex-1 py-2 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-bold flex items-center justify-center gap-1"
                      >
                        <span className="material-icons-round text-base">edit</span> Aanpassen
                      </button>
                      <button
                        onClick={() => verwijder(v)}
                        className="flex-1 py-2 rounded-xl bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 text-sm font-bold flex items-center justify-center gap-1"
                      >
                        <span className="material-icons-round text-base">delete</span> Verwijderen
                      </button>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </main>

      {bewerken && (
        <VerslagFormulier
          verslag={bewerken}
          onClose={() => setBewerken(null)}
          onSaved={async id => {
            setBewerken(null);
            await laad();
            setOpen(id);
          }}
        />
      )}
    </div>
  );
};

const VerslagFormulier = ({ verslag, onClose, onSaved }) => {
  const { events } = useAgenda();
  // Concept op dit toestel: typen gaat niet verloren bij sluiten, wegnavigeren of een lege batterij
  const conceptSleutel = `ksa-verslag-concept-${verslag.id || 'nieuw'}`;
  const [concept] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem(conceptSleutel) || 'null');
    } catch {
      return null;
    }
  });
  const [titel, setTitel] = useState(concept?.titel ?? verslag.titel ?? '');
  const [datum, setDatum] = useState(concept?.datum ?? verslag.datum ?? vandaag());
  const [inhoud, setInhoud] = useState(concept?.inhoud ?? verslag.inhoud ?? '');
  const [eventId, setEventId] = useState(concept?.eventId ?? verslag.event_id ?? '');
  const gewijzigd =
    titel !== (verslag.titel || '') || inhoud !== (verslag.inhoud || '') || eventId !== (verslag.event_id || '');

  useEffect(() => {
    if (concept) showToast('Je niet-opgeslagen concept is teruggezet', 'info');
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        if (gewijzigd) localStorage.setItem(conceptSleutel, JSON.stringify({ titel, datum, inhoud, eventId }));
        else localStorage.removeItem(conceptSleutel);
      } catch {
        // geen opslag op dit toestel: enkel de waarschuwing hieronder
      }
    }, 400);
    return () => clearTimeout(t);
  }, [titel, datum, inhoud, eventId, gewijzigd]);

  // Waarschuwing bij herladen of de app/tab sluiten met niet-opgeslagen tekst
  useEffect(() => {
    if (!gewijzigd) return;
    const waarschuw = e => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', waarschuw);
    return () => window.removeEventListener('beforeunload', waarschuw);
  }, [gewijzigd]);

  const sluit = () => {
    if (gewijzigd)
      showToast('Niet opgeslagen: je tekst staat klaar als concept als je het formulier opnieuw opent', 'info');
    onClose();
  };
  const [bestanden, setBestanden] = useState([]); // enkel bij een nieuw verslag; bij bewerken via <Bijlagen>
  const [bezig, setBezig] = useState(false);

  // Agenda-items om aan te koppelen: nieuwste eerst
  const keuzes = useMemo(() => [...events].sort((a, b) => new Date(b.date) - new Date(a.date)), [events]);

  const opslaan = async () => {
    if (!titel.trim()) {
      showToast('Geef het verslag een titel', 'error');
      return;
    }
    setBezig(true);
    try {
      const opgeslagen = await db.saveVerslag({ id: verslag.id, titel: titel.trim(), datum, inhoud, eventId });
      for (const file of bestanden) {
        try {
          await db.uploadBijlage({ verslagId: opgeslagen.id }, file);
        } catch (e) {
          showToast(e.message || `Uploaden van ${file.name} mislukt`, 'error');
        }
      }
      try {
        localStorage.removeItem(conceptSleutel);
      } catch {
        // niets te wissen
      }
      showToast('Verslag opgeslagen', 'success');
      await onSaved(opgeslagen.id);
    } catch (e) {
      console.error(e);
      showToast('Opslaan mislukt: ' + (e.message || 'onbekende fout'), 'error');
    } finally {
      setBezig(false);
    }
  };

  const veld =
    'w-full px-3 py-2.5 rounded-xl bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 text-sm';

  return (
    <BottomSheet isOpen onClose={sluit} title={verslag.id ? 'Verslag aanpassen' : 'Nieuw verslag'}>
      <div className="space-y-3 pb-4">
        <input
          value={titel}
          onChange={e => setTitel(e.target.value)}
          placeholder="bv. Groepsraad oktober"
          className={veld}
        />
        <input type="date" value={datum} onChange={e => setDatum(e.target.value)} className={veld} />
        <select value={eventId} onChange={e => setEventId(e.target.value)} className={veld}>
          <option value="">Niet gekoppeld aan een agenda-item</option>
          {keuzes.map(e => (
            <option key={e.id} value={e.id}>
              {new Date(e.date).toLocaleDateString('nl-BE')} · {e.title}
            </option>
          ))}
        </select>
        <textarea
          rows={10}
          value={inhoud}
          onChange={e => setInhoud(e.target.value)}
          placeholder="Het verslag (of voeg het toe als bijlage)"
          className={`${veld} resize-y`}
        />

        <div>
          <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2 px-1">Bijlagen</p>
          {verslag.id ? (
            <Bijlagen item={{ verslagId: verslag.id }} magBeheren />
          ) : (
            <NieuweBijlagen bestanden={bestanden} onChange={setBestanden} />
          )}
        </div>

        <button
          onClick={opslaan}
          disabled={bezig}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60"
        >
          {bezig ? 'Opslaan…' : 'Opslaan'}
        </button>
      </div>
    </BottomSheet>
  );
};
