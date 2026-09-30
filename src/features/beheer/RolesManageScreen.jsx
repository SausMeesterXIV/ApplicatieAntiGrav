import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import * as db from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';
import { BottomSheet } from '../../components/Modal';
import { UserAvatar } from '../../components/UserAvatar';
import { ChevronBack } from '../../components/ChevronBack';
import { RECHTEN } from '../../lib/roleUtils';

// Enkel hoofdleiding komt hier (RoleRoute in App.jsx); de database dwingt hetzelfde af via RLS.
export const RolesManageScreen = () => {
  const navigate = useNavigate();
  const { users, currentUser, groepen, werkgroepen, rollenGemigreerd, refreshRoles } = useAuth();
  const [tab, setTab] = useState('leiding');

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3 mb-3">
          <ChevronBack onClick={() => navigate(-1)} />
          <h1 className="text-xl font-bold">Rollen & beheer</h1>
        </div>
        <div className="flex gap-2">
          {[
            ['leiding', 'Leiding'],
            ['werkgroepen', 'Werkgroepen'],
          ].map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition-colors ${
                tab === key ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#1e2330] text-gray-600 dark:text-gray-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-3">
        {!rollenGemigreerd && (
          <div className="p-4 rounded-2xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 text-sm text-amber-800 dark:text-amber-200">
            De nieuwe rollentabellen bestaan nog niet. Voer eerst de migratie
            <code className="mx-1 font-mono text-xs">20261001000100_rollen_en_rechten.sql</code>
            uit in de Supabase SQL Editor.
          </div>
        )}

        {rollenGemigreerd && tab === 'leiding' && (
          <LeidingTab users={users} currentUser={currentUser} groepen={groepen} werkgroepen={werkgroepen} onSaved={refreshRoles} />
        )}
        {rollenGemigreerd && tab === 'werkgroepen' && (
          <WerkgroepenTab users={users} werkgroepen={werkgroepen} onSaved={refreshRoles} />
        )}
      </main>
    </div>
  );
};

// ---------------------------------------------------------------------------

const Chip = ({ actief, onClick, children, disabled }) => (
  <button
    type="button"
    disabled={disabled}
    onClick={onClick}
    className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-colors disabled:opacity-50 ${
      actief
        ? 'bg-blue-600 border-blue-600 text-white'
        : 'bg-white dark:bg-[#1e2330] border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
    }`}
  >
    {children}
  </button>
);

const Schakelaar = ({ label, uitleg, aan, onChange, disabled }) => (
  <label className={`flex items-center justify-between gap-4 py-2 ${disabled ? 'opacity-50' : ''}`}>
    <span>
      <span className="block font-semibold">{label}</span>
      {uitleg && <span className="block text-xs text-gray-500 dark:text-gray-400">{uitleg}</span>}
    </span>
    <input
      type="checkbox"
      className="w-5 h-5 accent-blue-600"
      checked={aan}
      disabled={disabled}
      onChange={e => onChange(e.target.checked)}
    />
  </label>
);

const toggle = (lijst, waarde) => (lijst.includes(waarde) ? lijst.filter(x => x !== waarde) : [...lijst, waarde]);

// ---------------------------------------------------------------------------

const LeidingTab = ({ users, currentUser, groepen, werkgroepen, onSaved }) => {
  const [zoek, setZoek] = useState('');
  const [toonInactief, setToonInactief] = useState(false);
  const [geselecteerd, setGeselecteerd] = useState(null);

  const lijst = useMemo(
    () =>
      users
        .filter(u => toonInactief || u.actief)
        .filter(u => (u.naam || '').toLowerCase().includes(zoek.toLowerCase()))
        .sort((a, b) => (a.naam || '').localeCompare(b.naam || '')),
    [users, zoek, toonInactief]
  );

  return (
    <>
      <input
        type="search"
        placeholder="Zoek leiding…"
        value={zoek}
        onChange={e => setZoek(e.target.value)}
        className="w-full px-4 py-3 rounded-xl bg-white dark:bg-[#1e2330] border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 px-1">
        <input type="checkbox" checked={toonInactief} onChange={e => setToonInactief(e.target.checked)} />
        Toon ook inactieve accounts
      </label>

      <div className="space-y-2">
        {lijst.map(u => (
          <button
            key={u.id}
            onClick={() => setGeselecteerd(u)}
            className="w-full text-left bg-white dark:bg-[#1e2330] p-3 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-3 active:scale-[0.99] transition-transform"
          >
            <UserAvatar user={u} size="md" />
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">
                {u.naam}
                {!u.actief && <span className="ml-2 text-xs font-bold text-red-500">inactief</span>}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                {u.roles.length ? u.roles.join(' · ') : 'Nog geen groep of werkgroep'}
              </p>
            </div>
            <span className="material-icons-round text-gray-300">chevron_right</span>
          </button>
        ))}
        {lijst.length === 0 && <p className="text-center text-sm text-gray-500 py-8">Geen leiding gevonden</p>}
      </div>

      {geselecteerd && (
        <LeiderBewerken
          key={geselecteerd.id}
          leider={geselecteerd}
          isZelf={geselecteerd.id === currentUser?.id}
          groepen={groepen}
          werkgroepen={werkgroepen}
          onClose={() => setGeselecteerd(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
};

const LeiderBewerken = ({ leider, isZelf, groepen, werkgroepen, onClose, onSaved }) => {
  const [groepIds, setGroepIds] = useState(leider.groepIds);
  const [werkgroepIds, setWerkgroepIds] = useState(leider.werkgroepIds);
  const [hoofdleiding, setHoofdleiding] = useState(leider.isHoofdleiding);
  const [actief, setActief] = useState(leider.actief);
  const [bezig, setBezig] = useState(false);

  const opslaan = async () => {
    setBezig(true);
    try {
      await db.setProfielGroepen(leider.id, groepIds);
      await db.setProfielWerkgroepen(leider.id, werkgroepIds);
      if (hoofdleiding !== leider.isHoofdleiding) await db.setHoofdleiding(leider.id, hoofdleiding);
      if (actief !== leider.actief) await db.setProfielActief(leider.id, actief);
      await onSaved();
      showToast(`${leider.naam} bijgewerkt`, 'success');
      onClose();
    } catch (e) {
      console.error(e);
      showToast('Opslaan mislukt: ' + (e.message || 'onbekende fout'), 'error');
    } finally {
      setBezig(false);
    }
  };

  return (
    <BottomSheet isOpen onClose={onClose} title={leider.naam} subtitle={leider.email}>
      <div className="space-y-5 pb-4">
        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Groep</h3>
          <div className="flex flex-wrap gap-2">
            {groepen.map(g => (
              <Chip key={g.id} actief={groepIds.includes(g.id)} onClick={() => setGroepIds(toggle(groepIds, g.id))}>
                {g.naam}
              </Chip>
            ))}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2">Werkgroepen</h3>
          {werkgroepen.length === 0 ? (
            <p className="text-sm text-gray-500">Nog geen werkgroepen. Maak ze aan in het tabblad Werkgroepen.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {werkgroepen.map(w => (
                <Chip
                  key={w.id}
                  actief={werkgroepIds.includes(w.id)}
                  onClick={() => setWerkgroepIds(toggle(werkgroepIds, w.id))}
                >
                  {w.naam}
                </Chip>
              ))}
            </div>
          )}
        </section>

        <section className="divide-y divide-gray-100 dark:divide-gray-800">
          <Schakelaar
            label="Hoofdleiding"
            uitleg={isZelf ? 'Je kan jezelf geen hoofdleiding afnemen.' : 'Hoofdleiding is admin en heeft alle rechten.'}
            aan={hoofdleiding}
            onChange={setHoofdleiding}
            disabled={isZelf}
          />
          <Schakelaar
            label="Actief account"
            uitleg={isZelf ? 'Je kan je eigen account niet deactiveren.' : 'Inactieve accounts kunnen niet meer inloggen.'}
            aan={actief}
            onChange={setActief}
            disabled={isZelf}
          />
        </section>

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

// ---------------------------------------------------------------------------

const WerkgroepenTab = ({ users, werkgroepen, onSaved }) => {
  const [bewerk, setBewerk] = useState(null); // null | 'nieuw' | werkgroep

  const aantalLeden = id => users.filter(u => u.werkgroepIds.includes(id)).length;

  return (
    <>
      <button
        onClick={() => setBewerk('nieuw')}
        className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold flex items-center justify-center gap-2"
      >
        <span className="material-icons-round">add</span> Nieuwe werkgroep
      </button>

      <div className="space-y-2">
        {werkgroepen.map(w => (
          <button
            key={w.id}
            onClick={() => setBewerk(w)}
            className="w-full text-left bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800"
          >
            <div className="flex items-center justify-between">
              <p className="font-bold">{w.naam}</p>
              <span className="text-xs text-gray-500">{aantalLeden(w.id)} leden</span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {w.rechten?.length ? w.rechten.map(r => RECHTEN[r] || r).join(' · ') : 'Geen extra rechten'}
            </p>
          </button>
        ))}
        {werkgroepen.length === 0 && (
          <p className="text-center text-sm text-gray-500 py-8">
            Nog geen werkgroepen. Maak er bv. een Drankteam (recht: drank) of Sfeerbeheer (recht: agenda) aan.
          </p>
        )}
      </div>

      {bewerk && (
        <WerkgroepBewerken
          key={bewerk === 'nieuw' ? 'nieuw' : bewerk.id}
          werkgroep={bewerk === 'nieuw' ? null : bewerk}
          leden={bewerk === 'nieuw' ? 0 : aantalLeden(bewerk.id)}
          onClose={() => setBewerk(null)}
          onSaved={onSaved}
        />
      )}
    </>
  );
};

const WerkgroepBewerken = ({ werkgroep, leden, onClose, onSaved }) => {
  const [naam, setNaam] = useState(werkgroep?.naam || '');
  const [rechten, setRechten] = useState(werkgroep?.rechten || []);
  const [bevestigVerwijderen, setBevestigVerwijderen] = useState(false);
  const [bezig, setBezig] = useState(false);

  const opslaan = async () => {
    if (!naam.trim()) return showToast('Geef de werkgroep een naam', 'warning');
    setBezig(true);
    try {
      await db.saveWerkgroep({ id: werkgroep?.id, naam, rechten });
      await onSaved();
      showToast('Werkgroep opgeslagen', 'success');
      onClose();
    } catch (e) {
      showToast(e.code === '23505' ? 'Er bestaat al een werkgroep met die naam' : 'Opslaan mislukt', 'error');
    } finally {
      setBezig(false);
    }
  };

  const verwijderen = async () => {
    if (!bevestigVerwijderen) return setBevestigVerwijderen(true);
    setBezig(true);
    try {
      await db.deleteWerkgroep(werkgroep.id);
      await onSaved();
      showToast('Werkgroep verwijderd', 'info');
      onClose();
    } catch (e) {
      showToast('Verwijderen mislukt', 'error');
    } finally {
      setBezig(false);
    }
  };

  return (
    <BottomSheet isOpen onClose={onClose} title={werkgroep ? 'Werkgroep bewerken' : 'Nieuwe werkgroep'}>
      <div className="space-y-5 pb-4">
        <input
          type="text"
          placeholder="Naam, bv. Drankteam"
          value={naam}
          onChange={e => setNaam(e.target.value)}
          className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />

        <section className="divide-y divide-gray-100 dark:divide-gray-800">
          <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wider pb-2">Rechten</h3>
          {Object.entries(RECHTEN).map(([key, label]) => (
            <Schakelaar
              key={key}
              label={label}
              aan={rechten.includes(key)}
              onChange={() => setRechten(toggle(rechten, key))}
            />
          ))}
        </section>

        <button
          onClick={opslaan}
          disabled={bezig}
          className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold disabled:opacity-60"
        >
          Opslaan
        </button>

        {werkgroep && (
          <button
            onClick={verwijderen}
            disabled={bezig}
            className={`w-full py-3 rounded-xl font-bold ${
              bevestigVerwijderen ? 'bg-red-600 text-white' : 'bg-red-50 text-red-600 dark:bg-red-900/20'
            }`}
          >
            {bevestigVerwijderen ? `Zeker? ${leden} leden verliezen deze werkgroep` : 'Werkgroep verwijderen'}
          </button>
        )}
      </div>
    </BottomSheet>
  );
};
