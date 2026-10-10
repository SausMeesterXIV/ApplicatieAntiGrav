import React, { useMemo, useState } from 'react';
import { BottomSheet } from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { euro } from '../../lib/geld';
import * as fin from '../../lib/financien';
import { PostRij } from './PostRij';
import { datumKort } from './datum';

// Detail van één betaling (of drankperiode): wie heeft betaald, herinneren, aanpassen.
export const BetalingSheet = ({ groep, currentUser, onClose, onGewijzigd }) => {
  const { users } = useAuth();
  const [bewerken, setBewerken] = useState(false);
  const [bezig, setBezig] = useState(false);
  const isDrank = groep.soort === 'drank';
  const open = groep.posten.filter(fin.isOpen);

  const herinnerOpen = async () => {
    if (!open.length) return;
    if (!window.confirm(`${open.length} ${open.length === 1 ? 'leider' : 'leiders'} een herinnering sturen voor "${groep.titel}"?`)) return;
    setBezig(true);
    try {
      const n = await fin.herinner(currentUser, open, `"${groep.titel}"`);
      showToast(`${n} ${n === 1 ? 'herinnering' : 'herinneringen'} verstuurd`, 'success');
    } catch (e) {
      showToast(e.message || 'Versturen mislukt', 'error');
    } finally {
      setBezig(false);
    }
  };

  const verwijder = async () => {
    if (!window.confirm(`"${groep.titel}" helemaal verwijderen, voor iedereen? Dit kan niet ongedaan worden.`)) return;
    try {
      await fin.verwijderBetaling(groep.id);
      showToast('Betaling verwijderd', 'info');
      onClose();
      await onGewijzigd();
    } catch (e) {
      showToast(e.message || 'Verwijderen mislukt', 'error');
    }
  };

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title={groep.titel}
      subtitle={`${groep.aantalBetaald}/${groep.aantal} betaald · ${euro(groep.betaald)} van ${euro(groep.totaal)}${
        groep.vervaldatum ? ` · voor ${datumKort(groep.vervaldatum)}` : ''
      }`}
    >
      <div className="space-y-4">
        <div className="flex gap-2">
          <button
            onClick={herinnerOpen}
            disabled={bezig || !open.length}
            className="flex-1 py-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <span className="material-icons-round text-base">notifications_active</span>
            Herinner {open.length || ''} {open.length === 1 ? 'leider' : 'leiders'}
          </button>
          {!isDrank && (
            <button
              onClick={() => setBewerken(b => !b)}
              className="flex-1 py-2.5 rounded-xl bg-gray-100 dark:bg-gray-800 text-sm font-bold flex items-center justify-center gap-1"
            >
              <span className="material-icons-round text-base">{bewerken ? 'done' : 'edit'}</span>
              {bewerken ? 'Klaar' : 'Aanpassen'}
            </button>
          )}
        </div>

        {isDrank && (
          <p className="text-xs text-gray-500">
            Drankfacturen maakt Drankteam bij het afsluiten van een periode. Bedragen pas je daar aan; hier duid je aan wie
            betaald heeft.
          </p>
        )}

        {bewerken && <BetalingBewerken groep={groep} users={users} onGewijzigd={onGewijzigd} onVerwijder={verwijder} />}

        <div className="divide-y divide-gray-100 dark:divide-gray-800">
          {groep.posten.map(p => (
            <PostRij
              key={p.id}
              post={p}
              onGewijzigd={onGewijzigd}
              extra={bewerken ? <PostAanpassen post={p} onGewijzigd={onGewijzigd} /> : null}
            />
          ))}
        </div>
      </div>
    </BottomSheet>
  );
};

// Bedrag of opmerking van één leider aanpassen, of de leider uit de betaling halen
const PostAanpassen = ({ post, onGewijzigd }) => {
  const pas = async () => {
    const nieuw = window.prompt(`Bedrag voor ${post.naam} (bv. 25 of 12,50)`, String(post.bedrag).replace('.', ','));
    if (nieuw === null) return;
    const bedrag = Number(String(nieuw).replace(',', '.'));
    if (!Number.isFinite(bedrag) || bedrag < 0) return showToast('Ongeldig bedrag', 'error');
    const opmerking = window.prompt('Opmerking (optioneel, bv. "2 truien")', post.opmerking || '');
    try {
      await fin.updatePost(post.id, { bedrag, ...(opmerking !== null ? { opmerking: opmerking.trim() || null } : {}) });
      await onGewijzigd();
    } catch (e) {
      showToast(e.message || 'Aanpassen mislukt', 'error');
    }
  };
  const weg = async () => {
    if (!window.confirm(`${post.naam} uit deze betaling halen?`)) return;
    try {
      await fin.verwijderPost(post.id);
      await onGewijzigd();
    } catch (e) {
      showToast(e.message || 'Verwijderen mislukt', 'error');
    }
  };
  return (
    <span className="flex gap-1">
      <button onClick={pas} title="Bedrag aanpassen" className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
        <span className="material-icons-round text-base">edit</span>
      </button>
      <button onClick={weg} title="Uit de betaling halen" className="w-9 h-9 rounded-full bg-red-50 dark:bg-red-900/20 text-red-600 flex items-center justify-center">
        <span className="material-icons-round text-base">person_remove</span>
      </button>
    </span>
  );
};

// Titel, deadline en leiding toevoegen
const BetalingBewerken = ({ groep, users, onGewijzigd, onVerwijder }) => {
  const [titel, setTitel] = useState(groep.titel);
  const [vervaldatum, setVervaldatum] = useState(groep.vervaldatum || '');
  const [toevoegen, setToevoegen] = useState('');
  const bedragVoorNieuw = groep.posten[0]?.bedrag ?? 0;
  const erin = useMemo(() => new Set(groep.posten.map(p => p.user_id)), [groep.posten]);
  const kandidaten = users.filter(u => u.actief && !erin.has(u.id)).sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl'));

  const bewaar = async () => {
    if (!titel.trim()) return showToast('Geef de betaling een naam', 'error');
    try {
      await fin.updateBetaling(groep.id, { titel: titel.trim(), vervaldatum: vervaldatum || null });
      showToast('Opgeslagen', 'success');
      await onGewijzigd();
    } catch (e) {
      showToast(e.message || 'Opslaan mislukt', 'error');
    }
  };

  const voegToe = async () => {
    if (!toevoegen) return;
    try {
      await fin.voegPostenToe(groep.id, [{ user_id: toevoegen, bedrag: bedragVoorNieuw }]);
      setToevoegen('');
      await onGewijzigd();
    } catch (e) {
      showToast(e.message || 'Toevoegen mislukt', 'error');
    }
  };

  const veld = 'w-full px-3 py-2 rounded-xl bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 text-sm';
  return (
    <div className="space-y-3 p-3 rounded-2xl bg-gray-50 dark:bg-[#0f172a]/60">
      <label className="block text-xs font-bold text-gray-500">
        Naam
        <input value={titel} onChange={e => setTitel(e.target.value)} maxLength={120} className={`${veld} mt-1`} />
      </label>
      <label className="block text-xs font-bold text-gray-500">
        Te betalen voor (optioneel)
        <input type="date" value={vervaldatum} onChange={e => setVervaldatum(e.target.value)} className={`${veld} mt-1`} />
      </label>
      <button onClick={bewaar} className="w-full py-2 rounded-xl bg-inkt text-white dark:bg-white dark:text-inkt text-sm font-bold">
        Naam en deadline opslaan
      </button>
      {kandidaten.length > 0 && (
        <div className="flex gap-2">
          <select value={toevoegen} onChange={e => setToevoegen(e.target.value)} className={veld}>
            <option value="">Leider toevoegen…</option>
            {kandidaten.map(u => (
              <option key={u.id} value={u.id}>
                {u.naam}
              </option>
            ))}
          </select>
          <button onClick={voegToe} disabled={!toevoegen} className="px-4 rounded-xl bg-blue-600 text-white text-sm font-bold disabled:opacity-40">
            + {euro(bedragVoorNieuw)}
          </button>
        </div>
      )}
      <button onClick={onVerwijder} className="w-full py-2 rounded-xl text-red-600 text-sm font-bold">
        Hele betaling verwijderen
      </button>
    </div>
  );
};
