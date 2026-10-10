import React, { useMemo, useState } from 'react';
import { BottomSheet } from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { useAuth } from '../auth/AuthContext';
import { euro } from '../../lib/geld';
import * as fin from '../../lib/financien';

// Nieuwe andere betaling (t-shirt, trui, activiteit, …): één bedrag voor een selectie leiding,
// per leider aan te passen (bv. iemand met 2 truien). Iedereen krijgt een eigen mededeling en QR-code.
const leesBedrag = w => {
  const n = Number(String(w ?? '').replace(/\s|€/g, '').replace(',', '.'));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : null;
};

export const NieuweBetalingSheet = ({ currentUser, onClose, onGemaakt }) => {
  const { users, groepen, werkgroepen } = useAuth();
  const [titel, setTitel] = useState('');
  const [omschrijving, setOmschrijving] = useState('');
  const [bedrag, setBedrag] = useState('');
  const [vervaldatum, setVervaldatum] = useState('');
  const [doel, setDoel] = useState('alle');
  const [doelId, setDoelId] = useState('');
  const [personen, setPersonen] = useState([]);
  const [afwijkend, setAfwijkend] = useState({}); // user_id -> bedrag (tekst)
  const [melden, setMelden] = useState(true);
  const [bezig, setBezig] = useState(false);

  const standaard = leesBedrag(bedrag);
  const ontvangers = useMemo(
    () =>
      fin
        .kiesOntvangers(users, { doel, doelId, personen })
        .sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl')),
    [users, doel, doelId, personen],
  );
  const bedragVoor = u => (afwijkend[u.id] !== undefined ? leesBedrag(afwijkend[u.id]) : standaard);
  const totaal = ontvangers.reduce((t, u) => t + (bedragVoor(u) ?? 0), 0);
  const alleLeiding = users.filter(u => u.actief).sort((a, b) => (a.naam || '').localeCompare(b.naam || '', 'nl'));

  const maak = async () => {
    if (!titel.trim()) return showToast('Geef de betaling een naam (bv. "Trui 2026")', 'error');
    if (standaard === null || bedrag === '') return showToast('Vul een geldig bedrag in', 'error');
    if (!ontvangers.length) return showToast('Kies minstens één leider', 'error');
    const fout = ontvangers.find(u => bedragVoor(u) === null);
    if (fout) return showToast(`Ongeldig bedrag bij ${fout.naam}`, 'error');

    setBezig(true);
    try {
      const posten = ontvangers.map(u => ({ user_id: u.id, bedrag: bedragVoor(u) }));
      await fin.maakBetaling({
        titel,
        omschrijving,
        vervaldatum,
        standaardBedrag: standaard,
        posten,
        aangemaaktDoor: currentUser.id,
      });
      if (melden) {
        const perLeider = posten
          .filter(p => p.bedrag > 0)
          .map(p => ({ ...p, titel: titel.trim(), status: 'onbetaald' }));
        await fin.herinner(currentUser, perLeider, `"${titel.trim()}"`).catch(() => {});
      }
      showToast('Betaling aangemaakt', 'success');
      await onGemaakt();
    } catch (e) {
      showToast(e.message || 'Aanmaken mislukt', 'error');
    } finally {
      setBezig(false);
    }
  };

  const veld = 'w-full px-3 py-2.5 rounded-xl bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 text-sm mt-1';
  const keuze = (id, label) => (
    <button
      key={id}
      onClick={() => {
        setDoel(id);
        setDoelId('');
      }}
      className={`px-3 py-1.5 rounded-full text-xs font-bold ${
        doel === id ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300'
      }`}
    >
      {label}
    </button>
  );

  return (
    <BottomSheet isOpen onClose={onClose} title="Nieuwe betaling" subtitle="Bv. t-shirt, trui of activiteit">
      <div className="space-y-4">
        <label className="block text-xs font-bold text-gray-500">
          Naam
          <input value={titel} onChange={e => setTitel(e.target.value)} maxLength={120} placeholder="Trui 2026" className={veld} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-bold text-gray-500">
            Bedrag per leider
            <input value={bedrag} onChange={e => setBedrag(e.target.value)} inputMode="decimal" placeholder="25,00" className={veld} />
          </label>
          <label className="block text-xs font-bold text-gray-500">
            Te betalen voor
            <input type="date" value={vervaldatum} onChange={e => setVervaldatum(e.target.value)} className={veld} />
          </label>
        </div>
        <label className="block text-xs font-bold text-gray-500">
          Uitleg (optioneel)
          <input value={omschrijving} onChange={e => setOmschrijving(e.target.value)} placeholder="Maat doorgeven aan Financiën" className={veld} />
        </label>

        <div>
          <p className="text-xs font-bold text-gray-500 mb-2">Voor wie?</p>
          <div className="flex flex-wrap gap-2">
            {keuze('alle', 'Alle leiding')}
            {keuze('groep', 'Groep')}
            {keuze('werkgroep', 'Werkgroep')}
            {keuze('personen', 'Kiezen')}
          </div>
          {doel === 'groep' && (
            <select value={doelId} onChange={e => setDoelId(e.target.value)} className={veld}>
              <option value="">Kies een groep…</option>
              {groepen.map(g => (
                <option key={g.id} value={g.id}>
                  {g.naam}
                </option>
              ))}
            </select>
          )}
          {doel === 'werkgroep' && (
            <select value={doelId} onChange={e => setDoelId(e.target.value)} className={veld}>
              <option value="">Kies een werkgroep…</option>
              {werkgroepen.map(w => (
                <option key={w.id} value={w.id}>
                  {w.naam}
                </option>
              ))}
            </select>
          )}
          {doel === 'personen' && (
            <div className="mt-2 max-h-48 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
              {alleLeiding.map(u => (
                <label key={u.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    className="w-5 h-5"
                    checked={personen.includes(u.id)}
                    onChange={() => setPersonen(p => (p.includes(u.id) ? p.filter(x => x !== u.id) : [...p, u.id]))}
                  />
                  {u.naam}
                </label>
              ))}
            </div>
          )}
        </div>

        {ontvangers.length > 0 && (
          <div>
            <p className="text-xs font-bold text-gray-500 mb-1">
              {ontvangers.length} {ontvangers.length === 1 ? 'leider' : 'leiders'} · totaal {euro(totaal)}
            </p>
            <p className="text-xs text-gray-500 mb-2">Ander bedrag voor iemand (bv. 2 truien)? Pas het hieronder aan.</p>
            <div className="max-h-56 overflow-y-auto rounded-xl border border-gray-200 dark:border-gray-700 divide-y divide-gray-100 dark:divide-gray-800">
              {ontvangers.map(u => (
                <div key={u.id} className="flex items-center gap-3 px-3 py-1.5 text-sm">
                  <span className="flex-1 truncate">{u.naam}</span>
                  <input
                    value={afwijkend[u.id] ?? (standaard !== null && bedrag !== '' ? String(standaard).replace('.', ',') : '')}
                    onChange={e => setAfwijkend(a => ({ ...a, [u.id]: e.target.value }))}
                    inputMode="decimal"
                    aria-label={`Bedrag voor ${u.naam}`}
                    className="w-24 px-2 py-1.5 rounded-lg bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 text-right"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        <label className="flex items-center gap-3 text-sm">
          <input type="checkbox" className="w-5 h-5" checked={melden} onChange={e => setMelden(e.target.checked)} />
          Stuur iedereen meteen een melding met het bedrag
        </label>

        <button
          onClick={maak}
          disabled={bezig}
          className="w-full py-3 rounded-xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold disabled:opacity-50"
        >
          {bezig ? 'Bezig…' : 'Betaling aanmaken'}
        </button>
      </div>
    </BottomSheet>
  );
};
