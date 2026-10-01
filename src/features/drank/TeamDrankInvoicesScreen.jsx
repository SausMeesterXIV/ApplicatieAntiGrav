import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { useDrink } from './DrinkContext';
import * as db from '../../lib/supabaseService';
import { showToast } from '../../components/Toast';
import { ChevronBack } from '../../components/ChevronBack';
import { UittrekselInlezen } from './UittrekselInlezen';
import { euro } from '../../lib/geld';

// Drankteam: facturen per afgesloten periode, betaald zetten, Excel-export.
export const TeamDrankInvoicesScreen = () => {
  const navigate = useNavigate();
  const { periodId: routePeriodId } = useParams();
  const { billingPeriods } = useDrink();

  const afgesloten = useMemo(() => billingPeriods.filter(p => p.is_closed), [billingPeriods]);
  const [periodId, setPeriodId] = useState(routePeriodId || '');
  const [facturen, setFacturen] = useState([]);
  const [laden, setLaden] = useState(true);
  const [filter, setFilter] = useState('open');

  useEffect(() => {
    if (!periodId && afgesloten.length > 0) setPeriodId(afgesloten[0].id);
  }, [afgesloten, periodId]);

  useEffect(() => {
    setLaden(true);
    db.fetchFacturen()
      .then(setFacturen)
      .catch(() => showToast('Facturen laden mislukt', 'error'))
      .finally(() => setLaden(false));
  }, []);

  const periode = billingPeriods.find(p => p.id === periodId);
  const vanPeriode = facturen.filter(f => f.period_id === periodId);
  const zichtbaar = vanPeriode
    .filter(f => filter === 'alle' || (filter === 'open' ? f.status !== 'betaald' : f.status === 'betaald'))
    .sort((a, b) => (a.user_naam || '').localeCompare(b.user_naam || ''));

  const totaal = vanPeriode.reduce((s, f) => s + f.totaal_bedrag, 0);
  const open = vanPeriode.filter(f => f.status !== 'betaald').reduce((s, f) => s + f.totaal_bedrag, 0);

  const wisselStatus = async factuur => {
    const nieuw = factuur.status === 'betaald' ? 'onbetaald' : 'betaald';
    setFacturen(prev => prev.map(f => (f.id === factuur.id ? { ...f, status: nieuw } : f)));
    try {
      await db.updateFactuurStatus(factuur.id, nieuw);
    } catch (e) {
      setFacturen(prev => prev.map(f => (f.id === factuur.id ? factuur : f)));
      showToast('Status aanpassen mislukt', 'error');
    }
  };

  // Uit het bankuittreksel: over alle periodes heen op betaald zetten
  const zetBetaald = async ids => {
    const resultaten = await Promise.allSettled(ids.map(id => db.updateFactuurStatus(id, 'betaald')));
    const gelukt = ids.filter((_, i) => resultaten[i].status === 'fulfilled');
    setFacturen(prev => prev.map(f => (gelukt.includes(f.id) ? { ...f, status: 'betaald' } : f)));
    if (gelukt.length < ids.length) throw new Error('Niet alle facturen aangepast');
  };

  const exporteer = () => {
    const rijen = [
      ['Naam', 'Nummer', 'Strepen', 'Drank', 'Friet', 'Correctie', 'Totaal', 'Mededeling', 'Status', 'Betaald op'],
      ...vanPeriode
        .sort((a, b) => (a.user_naam || '').localeCompare(b.user_naam || ''))
        .map(f => [
          f.user_naam || f.profiles?.naam || '',
          f.nummer,
          f.aantal_strepen,
          f.drank_bedrag,
          f.friet_bedrag,
          f.correctie_bedrag,
          f.totaal_bedrag,
          f.mededeling || '',
          f.status,
          f.betaald_op ? new Date(f.betaald_op).toLocaleDateString('nl-BE') : '',
        ]),
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rijen), 'Facturen');
    XLSX.writeFile(wb, `KSA_Facturen_${(periode?.naam || 'periode').replace(/[^\w-]+/g, '_')}.xlsx`);
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800 space-y-3">
        <div className="flex items-center gap-3">
          <ChevronBack onClick={() => navigate(-1)} />
          <h1 className="text-xl font-bold flex-1">Facturen</h1>
          <button
            onClick={() => navigate('/strepen/facturatie/nieuw')}
            className="text-xs font-bold px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 dark:bg-blue-600/20 dark:text-blue-400"
          >
            Periode afsluiten
          </button>
        </div>
        <select
          value={periodId}
          onChange={e => setPeriodId(e.target.value)}
          className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#1e2330] border border-gray-200 dark:border-gray-700"
        >
          {afgesloten.length === 0 && <option value="">Nog geen afgesloten periodes</option>}
          {afgesloten.map(p => (
            <option key={p.id} value={p.id}>
              {p.naam}
            </option>
          ))}
        </select>
        <div className="flex gap-2">
          {[
            ['open', 'Open'],
            ['betaald', 'Betaald'],
            ['alle', 'Alle'],
          ].map(([k, l]) => (
            <button
              key={k}
              onClick={() => setFilter(k)}
              className={`flex-1 py-1.5 rounded-lg text-sm font-semibold ${
                filter === k ? 'bg-blue-600 text-white' : 'bg-white dark:bg-[#1e2330] text-gray-600 dark:text-gray-300'
              }`}
            >
              {l}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-3">
        <section className="grid grid-cols-2 gap-3">
          <div className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500">Totaal periode</p>
            <p className="text-xl font-black">{euro(totaal)}</p>
          </div>
          <div className="bg-white dark:bg-[#1e2330] p-4 rounded-2xl border border-gray-100 dark:border-gray-800">
            <p className="text-xs text-gray-500">Nog open</p>
            <p className="text-xl font-black text-red-600">{euro(open)}</p>
          </div>
        </section>

        <button
          onClick={exporteer}
          disabled={vanPeriode.length === 0}
          className="w-full py-2.5 rounded-xl bg-green-600 text-white font-bold flex items-center justify-center gap-2 disabled:opacity-50"
        >
          <span className="material-icons-round">download</span> Exporteer naar Excel
        </button>

        {!laden && <UittrekselInlezen facturen={facturen} onBetaald={zetBetaald} />}

        {laden && <p className="text-center text-sm text-gray-500 py-6">Laden…</p>}
        {!laden && zichtbaar.length === 0 && <p className="text-center text-sm text-gray-500 py-6">Geen facturen.</p>}

        {zichtbaar.map(f => (
          <div
            key={f.id}
            className="bg-white dark:bg-[#1e2330] p-3 rounded-2xl border border-gray-100 dark:border-gray-800 flex items-center gap-3"
          >
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{f.user_naam || f.profiles?.naam}</p>
              <p className="text-xs text-gray-500 font-mono">{f.mededeling}</p>
            </div>
            <p className="font-bold">{euro(f.totaal_bedrag)}</p>
            <button
              onClick={() => wisselStatus(f)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                f.status === 'betaald'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400'
              }`}
            >
              {f.status === 'betaald' ? 'Betaald' : 'Open'}
            </button>
          </div>
        ))}
      </main>
    </div>
  );
};
