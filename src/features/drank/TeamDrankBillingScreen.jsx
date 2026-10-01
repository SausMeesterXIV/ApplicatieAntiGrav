import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDrink } from './DrinkContext';
import * as db from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';
import { Modal } from '../../components/Modal';
import { ChevronBack } from '../../components/ChevronBack';
import { formatIban } from '../../lib/epc';
import { euro } from '../../lib/geld';

// Drankteam: overzicht van de open periode, correcties, rekeninggegevens en de periode afsluiten.
// De bedragen komen uit periode_overzicht() in de database: exact wat op de factuur komt.
export const TeamDrankBillingScreen = () => {
  const navigate = useNavigate();
  const { activePeriod, refreshDrinksData } = useDrink();

  const [rijen, setRijen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [bevestig, setBevestig] = useState(false);
  const [bezig, setBezig] = useState(false);

  const [correctie, setCorrectie] = useState(null); // { userId, naam }
  const [correctieBedrag, setCorrectieBedrag] = useState('');
  const [correctieNotitie, setCorrectieNotitie] = useState('');

  const [betaal, setBetaal] = useState({ naam: '', iban: '', bic: '' });
  const [betaalOpen, setBetaalOpen] = useState(false);

  // Echte kost van de periode (bv. factuur van de brouwer): verdeeld over alle strepen. Leeg = aantal x prijs.
  const [echteKostTekst, setEchteKostTekst] = useState('');
  const echteKost = (() => {
    const n = parseFloat(String(echteKostTekst).replace(',', '.'));
    return Number.isFinite(n) && n > 0 ? n : null;
  })();

  const laadOverzicht = async () => {
    setLaden(true);
    try {
      setRijen(await db.fetchPeriodeOverzicht(activePeriod?.id || null, echteKost));
    } catch (e) {
      console.error(e);
      showToast('Overzicht laden mislukt (is de drank-migratie uitgevoerd?)', 'error');
    } finally {
      setLaden(false);
    }
  };

  useEffect(() => {
    db.fetchBetaalgegevens()
      .then(setBetaal)
      .catch(() => {});
  }, []);

  // Opnieuw berekenen bij een andere periode of echte kost (kort wachten tot het typen stopt)
  useEffect(() => {
    const t = setTimeout(laadOverzicht, 400);
    return () => clearTimeout(t);
  }, [activePeriod?.id, echteKost]);

  const gesorteerd = useMemo(() => [...rijen].sort((a, b) => b.totaal - a.totaal), [rijen]);
  const totaal = rijen.reduce((s, r) => s + r.totaal, 0);
  const totaalStrepen = rijen.reduce((s, r) => s + r.strepen, 0);

  const voegCorrectieToe = async () => {
    const bedrag = parseFloat(String(correctieBedrag).replace(',', '.'));
    if (isNaN(bedrag) || !activePeriod) return showToast('Ongeldig bedrag', 'warning');
    try {
      await db.addBillingCorrection(
        correctie.userId,
        activePeriod.id,
        bedrag,
        correctieNotitie || undefined,
        correctie.naam,
      );
      showToast(`Correctie van ${euro(bedrag)} toegevoegd`, 'success');
      setCorrectie(null);
      setCorrectieBedrag('');
      setCorrectieNotitie('');
      laadOverzicht();
    } catch (e) {
      showToast('Correctie toevoegen mislukt', 'error');
    }
  };

  const bewaarBetaalgegevens = async () => {
    try {
      await db.saveBetaalgegevens(betaal);
      showToast('Rekeninggegevens opgeslagen', 'success');
      setBetaalOpen(false);
    } catch (e) {
      showToast('Opslaan mislukt', 'error');
    }
  };

  const sluitAf = async () => {
    if (!bevestig) return setBevestig(true);
    setBezig(true);
    try {
      const res = await db.sluitPeriodeAf(activePeriod?.id || null, echteKost);
      showToast(`Periode afgesloten: ${res?.aantal_facturen ?? 0} facturen gemaakt`, 'success');
      await refreshDrinksData();
      navigate(`/strepen/facturatie/archief/${res?.closed_period_id || ''}`);
    } catch (e) {
      showToast('Afsluiten mislukt: ' + (e.message || 'onbekende fout'), 'error');
    } finally {
      setBezig(false);
      setBevestig(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-3">
          <ChevronBack onClick={() => navigate(-1)} />
          <div className="flex-1">
            <h1 className="text-xl font-bold">Periode afsluiten</h1>
            <p className="text-xs text-gray-500">{activePeriod?.naam || 'Geen open periode'}</p>
          </div>
          <button
            onClick={() => navigate('/strepen/facturatie/periodes')}
            className="p-2 rounded-full text-blue-600 hover:bg-gray-200 dark:hover:bg-white/10"
            title="Periodebeheer"
          >
            <span className="material-icons-round">event_note</span>
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-4">
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500">Te factureren</p>
            <p className="text-2xl font-black">{euro(totaal)}</p>
          </div>
          <div className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500">Strepen</p>
            <p className="text-2xl font-black">{totaalStrepen}</p>
          </div>
        </section>

        <section className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 space-y-2">
          <label className="block">
            <span className="font-semibold">Echte kost van deze periode</span>
            <span className="block text-xs text-gray-500 mb-2">
              Bv. de factuur van de brouwer. Die wordt verdeeld over alle {totaalStrepen} strepen. Leeg laten = de
              schatting (aantal strepen × prijs van de drank).
            </span>
            <input
              inputMode="decimal"
              placeholder="€0,00"
              value={echteKostTekst}
              onChange={e => setEchteKostTekst(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
            />
          </label>
          <p className="text-xs text-blue-700 dark:text-blue-300">
            {echteKost && totaalStrepen > 0
              ? `Prijs per streep: ${euro(echteKost / totaalStrepen)}. De bedragen hieronder zijn wat op de facturen komt.`
              : 'De bedragen hieronder zijn de schatting (aantal × prijs).'}
          </p>
        </section>

        <button
          onClick={() => setBetaalOpen(true)}
          className="w-full text-left bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-3"
        >
          <span className="material-icons-round text-blue-600">account_balance</span>
          <div className="flex-1">
            <p className="font-semibold">Rekening voor betalingen</p>
            <p className="text-xs text-gray-500">
              {betaal.iban
                ? `${betaal.naam} · ${formatIban(betaal.iban)}`
                : 'Nog niet ingesteld: nodig voor de betaal-QR'}
            </p>
          </div>
          <span className="material-icons-round text-gray-300">edit</span>
        </button>

        <section className="space-y-2">
          {laden && <p className="text-center text-sm text-gray-500 py-6">Laden…</p>}
          {!laden && gesorteerd.length === 0 && (
            <p className="text-center text-sm text-gray-500 py-6">Nog niets te factureren in deze periode.</p>
          )}
          {gesorteerd.map(r => (
            <div
              key={r.user_id}
              className="bg-white dark:bg-[#1e2330] p-3 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-3"
            >
              <div className="flex-1 min-w-0">
                <p className="font-semibold truncate">{r.naam}</p>
                <p className="text-xs text-gray-500">
                  {r.strepen} strepen · drank {euro(r.drank_bedrag)}
                  {r.friet_bedrag ? ` · friet ${euro(r.friet_bedrag)}` : ''}
                  {r.correctie_bedrag ? ` · correctie ${euro(r.correctie_bedrag)}` : ''}
                </p>
              </div>
              <p className="font-bold">{euro(r.totaal)}</p>
              <button
                onClick={() => setCorrectie({ userId: r.user_id, naam: r.naam })}
                className="p-2 rounded-full text-gray-400 hover:text-blue-600"
                title="Correctie"
              >
                <span className="material-icons-round text-lg">tune</span>
              </button>
            </div>
          ))}
        </section>

        <button
          onClick={sluitAf}
          disabled={bezig || !activePeriod}
          className={`w-full py-3 rounded-xl font-bold disabled:opacity-50 ${
            bevestig
              ? 'bg-red-600 text-white animate-pulse'
              : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300'
          }`}
        >
          {bezig
            ? 'Bezig…'
            : bevestig
              ? `Zeker? Er worden ${gesorteerd.filter(r => r.totaal !== 0 || r.strepen > 0).length} facturen gemaakt`
              : 'Periode afsluiten en facturen maken'}
        </button>
      </main>

      <Modal isOpen={!!correctie} onClose={() => setCorrectie(null)} title="Correctie" subtitle={correctie?.naam}>
        <div className="space-y-3">
          <input
            inputMode="decimal"
            placeholder="Bedrag, bv. -2,50 of 5"
            value={correctieBedrag}
            onChange={e => setCorrectieBedrag(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          />
          <input
            placeholder="Notitie (optioneel)"
            value={correctieNotitie}
            onChange={e => setCorrectieNotitie(e.target.value)}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          />
          <button onClick={voegCorrectieToe} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold">
            Toevoegen
          </button>
        </div>
      </Modal>

      <Modal isOpen={betaalOpen} onClose={() => setBetaalOpen(false)} title="Rekening voor betalingen">
        <div className="space-y-3">
          <input
            placeholder="Naam begunstigde, bv. KSA Aalter"
            value={betaal.naam}
            onChange={e => setBetaal({ ...betaal, naam: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700"
          />
          <input
            placeholder="IBAN, bv. BE12 3456 7890 1234"
            value={betaal.iban}
            onChange={e => setBetaal({ ...betaal, iban: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono"
          />
          <input
            placeholder="BIC (optioneel)"
            value={betaal.bic}
            onChange={e => setBetaal({ ...betaal, bic: e.target.value })}
            className="w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 font-mono"
          />
          <button onClick={bewaarBetaalgegevens} className="w-full py-3 rounded-xl bg-blue-600 text-white font-bold">
            Opslaan
          </button>
        </div>
      </Modal>
    </div>
  );
};
