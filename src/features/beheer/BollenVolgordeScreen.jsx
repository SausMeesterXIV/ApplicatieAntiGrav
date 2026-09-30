import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { ChevronBack } from '../../components/ChevronBack';
import { showToast } from '../../components/Toast';
import { bollenVoor, bewaarVolgorde, gekozenVolgorde, volledigeVolgorde, STANDAARD_VOLGORDE } from '../home/bollen';

// Instellingen > Volgorde bollen: kies welke bollen eerst staan op je startscherm.
// Je ziet enkel de bollen van je eigen rollen (hoofdleiding: allemaal).
export const BollenVolgordeScreen = () => {
  const navigate = useNavigate();
  const { currentUser, setCurrentUser } = useAuth();
  const [lijst, setLijst] = useState(() => bollenVoor(currentUser, gekozenVolgorde(currentUser)));
  const [bezig, setBezig] = useState(false);

  const verplaats = (i, richting) => {
    const j = i + richting;
    if (j < 0 || j >= lijst.length) return;
    const nieuw = [...lijst];
    [nieuw[i], nieuw[j]] = [nieuw[j], nieuw[i]];
    setLijst(nieuw);
  };

  const standaard = () => setLijst(bollenVoor(currentUser, null));

  // De bollen die je niet ziet (andere rollen) behouden hun plaats achteraan
  const volgorde = useMemo(() => {
    const zichtbaar = lijst.map(b => b.id);
    return [...zichtbaar, ...volledigeVolgorde(gekozenVolgorde(currentUser)).filter(id => !zichtbaar.includes(id))];
  }, [lijst, currentUser]);

  const opslaan = async () => {
    if (!currentUser) return;
    setBezig(true);
    const isStandaard = volgorde.join() === STANDAARD_VOLGORDE.join();
    const waarde = isStandaard ? null : volgorde;
    try {
      await bewaarVolgorde(currentUser.id, waarde);
      showToast('Volgorde opgeslagen', 'success');
    } catch (e) {
      console.warn('Volgorde op profiel bewaren mislukt', e);
      showToast('Opgeslagen op dit toestel', 'info');
    } finally {
      setCurrentUser({ ...currentUser, startscherm_bollen: waarde });
      setBezig(false);
      navigate(-1);
    }
  };

  return (
    <div className="flex flex-col min-h-full bg-gray-50 dark:bg-[#0f172a] text-inkt dark:text-white">
      <header className="px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] pb-2 space-y-2">
        <div className="flex items-center gap-2">
          <ChevronBack onClick={() => navigate(-1)} />
          <h1 className="text-2xl font-extrabold tracking-tight">Volgorde bollen</h1>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Bepaal welke bollen eerst staan op je startscherm. Bollen van een rol zie je enkel als je die rol hebt.
        </p>
      </header>

      <main className="flex-1 px-4 pb-4 space-y-3">
        {/* Voorbeeld van het startscherm */}
        <div
          className="rounded-3xl bg-kaart-event dark:bg-kaart-event-d py-3 overflow-x-auto no-scrollbar"
          aria-hidden="true"
        >
          <div className="flex gap-3 px-4 w-max">
            {lijst.map(b => (
              <div key={b.id} className="flex flex-col items-center gap-1 w-14">
                <span
                  className={`flex items-center justify-center w-12 h-12 rounded-full text-sm font-extrabold ${b.kleur} ${
                    b.rol ? '' : 'text-inkt dark:text-white'
                  }`}
                >
                  {b.afk}
                </span>
                <span className="text-[11px] text-gray-600 dark:text-gray-300 truncate max-w-full">{b.label}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 px-1">Voorbeeld van je startscherm</p>

        <ol className="space-y-2">
          {lijst.map((b, i) => (
            <li
              key={b.id}
              className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d pl-3 pr-1 py-2 flex items-center gap-3"
            >
              <span
                className={`flex items-center justify-center w-10 h-10 shrink-0 rounded-full text-xs font-extrabold ${b.kleur} ${
                  b.rol ? '' : 'text-inkt dark:text-white'
                }`}
              >
                {b.afk}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block font-bold truncate">{b.label}</span>
                {b.rol && <span className="block text-xs text-gray-500 dark:text-gray-400">rol: {b.rol}</span>}
              </span>
              <button
                type="button"
                onClick={() => verplaats(i, -1)}
                disabled={i === 0}
                aria-label={`${b.label} naar boven`}
                className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-25 active:bg-black/5 dark:active:bg-white/10"
              >
                <span className="material-icons-round">expand_less</span>
              </button>
              <button
                type="button"
                onClick={() => verplaats(i, 1)}
                disabled={i === lijst.length - 1}
                aria-label={`${b.label} naar beneden`}
                className="w-11 h-11 rounded-full flex items-center justify-center disabled:opacity-25 active:bg-black/5 dark:active:bg-white/10"
              >
                <span className="material-icons-round">expand_more</span>
              </button>
            </li>
          ))}
        </ol>
      </main>

      <footer className="sticky bottom-0 px-4 py-3 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur grid grid-cols-[1fr_1.4fr] gap-3">
        <button
          type="button"
          onClick={standaard}
          className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d py-3.5 font-bold"
        >
          Standaard
        </button>
        <button
          type="button"
          onClick={opslaan}
          disabled={bezig}
          className="rounded-2xl bg-inkt dark:bg-white text-white dark:text-inkt py-3.5 font-bold disabled:opacity-60"
        >
          {bezig ? 'Opslaan…' : 'Opslaan'}
        </button>
      </footer>
    </div>
  );
};
