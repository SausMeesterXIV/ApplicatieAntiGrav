import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import QRCode from 'react-qr-code';
import { useAuth } from '../auth/AuthContext';
import { useDrink } from './DrinkContext';
import { useFries } from '../friet/FriesContext';
import * as db from '../../lib/supabaseService';
import { epcPayload, formatIban } from '../../lib/epc';
import { showToast } from '../../components/Toast';
import { ChevronBack } from '../../components/ChevronBack';

const euro = n => `€${Number(n || 0).toFixed(2).replace('.', ',')}`;

// Gewone leiding: eigen verbruik in de open periode, eigen facturen en betalen via overschrijving/EPC-QR.
export const MyInvoiceScreen = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { streaks, activePeriod, balances } = useDrink();
  const { friesOrders } = useFries();

  const [overzicht, setOverzicht] = useState(null); // eigen rij uit periode_overzicht
  const [facturen, setFacturen] = useState([]);
  const [betaal, setBetaal] = useState({ naam: '', iban: '', bic: '' });
  const [openFactuur, setOpenFactuur] = useState(null);

  useEffect(() => {
    if (!currentUser) return;
    db.fetchPeriodeOverzicht()
      .then(rows => setOverzicht(rows.find(r => r.user_id === currentUser.id) || null))
      .catch(() => setOverzicht(null));
    db.fetchFacturen(currentUser.id)
      .then(setFacturen)
      .catch(() => {});
    db.fetchBetaalgegevens().then(setBetaal).catch(() => {});
  }, [currentUser?.id, activePeriod?.id]);

  // Nog niet gefactureerd verbruik, per drank
  const perDrank = useMemo(() => {
    const groep = {};
    streaks
      .filter(s => s.userId === currentUser?.id && !s.factuurId)
      .forEach(s => {
        groep[s.drinkName] = (groep[s.drinkName] || 0) + s.amount;
      });
    return Object.entries(groep).sort((a, b) => b[1] - a[1]);
  }, [streaks, currentUser?.id]);

  const frietOpen = friesOrders.filter(o => o.userId === currentUser?.id && !o.factuurId);

  const totaal = overzicht?.totaal ?? balances[currentUser?.id] ?? 0;
  // Een factuur van € 0 (of minder, bv. na een correctie) hoeft niet betaald te worden: geen QR-code
  const teBetalen = f => f.status !== 'betaald' && Number(f.totaal_bedrag) > 0;
  const onbetaald = facturen.filter(teBetalen);

  const kopieer = async tekst => {
    try {
      await navigator.clipboard.writeText(tekst);
      showToast('Gekopieerd', 'success');
    } catch {
      showToast('Kopiëren lukt niet op dit toestel', 'warning');
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50/95 dark:bg-[#0f172a]/95 backdrop-blur-sm z-10 border-b border-gray-200 dark:border-gray-800 flex items-center gap-3">
        <ChevronBack onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold">Mijn rekening</h1>
      </header>

      <main className="flex-1 px-4 py-4 pb-nav-safe space-y-6">
        {/* Openstaande facturen eerst: daar moet iets gebeuren */}
        {onbetaald.length > 0 && (
          <section className="space-y-2">
            <h2 className="text-sm font-bold text-red-600 uppercase tracking-wider px-1">Te betalen</h2>
            {onbetaald.map(f => (
              <div key={f.id} className="bg-white dark:bg-[#1e2330] rounded-2xl border border-red-200 dark:border-red-900/40">
                <button
                  onClick={() => setOpenFactuur(openFactuur === f.id ? null : f.id)}
                  className="w-full p-4 flex items-center gap-3 text-left"
                >
                  <div className="flex-1">
                    <p className="font-bold">{f.periode}</p>
                    <p className="text-xs text-gray-500">Factuur {f.nummer}</p>
                  </div>
                  <p className="text-xl font-black">{euro(f.totaal_bedrag)}</p>
                  <span className="material-icons-round text-gray-400">
                    {openFactuur === f.id ? 'expand_less' : 'expand_more'}
                  </span>
                </button>

                {openFactuur === f.id && (
                  <div className="px-4 pb-4 space-y-3">
                    {betaal.iban ? (
                      <>
                        <div className="bg-white p-3 rounded-xl mx-auto w-fit">
                          <QRCode
                            value={epcPayload({
                              naam: betaal.naam,
                              iban: betaal.iban,
                              bic: betaal.bic,
                              bedrag: f.totaal_bedrag,
                              mededeling: f.mededeling,
                            })}
                            size={184}
                          />
                        </div>
                        <p className="text-xs text-center text-gray-500">
                          Scan met je bank-app of Payconiq. Er gaat geen geld via deze app.
                        </p>
                        <dl className="text-sm space-y-2">
                          {/* [label, weergave, te kopiëren tekst] — bedrag zonder €-teken, zoals bank-apps het verwachten */}
                          {[
                            ['Begunstigde', betaal.naam, null],
                            ['Rekening', formatIban(betaal.iban), formatIban(betaal.iban)],
                            ['Bedrag', euro(f.totaal_bedrag), Number(f.totaal_bedrag).toFixed(2).replace('.', ',')],
                            ['Mededeling', f.mededeling, f.mededeling],
                          ].map(([k, v, kopie]) => (
                            <div key={k} className="flex items-center justify-between gap-2">
                              <dt className="text-gray-500">{k}</dt>
                              <dd className="font-semibold font-mono text-right flex items-center gap-1">
                                {v}
                                {kopie && (
                                  <button onClick={() => kopieer(kopie)} className="text-blue-600" title="Kopieer">
                                    <span className="material-icons-round text-base">content_copy</span>
                                  </button>
                                )}
                              </dd>
                            </div>
                          ))}
                        </dl>
                      </>
                    ) : (
                      <p className="text-sm text-gray-500">
                        Drankteam heeft nog geen rekeningnummer ingesteld. Mededeling: {f.mededeling}
                      </p>
                    )}
                    <p className="text-xs text-gray-500">Drankteam zet je factuur op betaald zodra de betaling binnen is.</p>
                  </div>
                )}
              </div>
            ))}
          </section>
        )}

        {/* Lopende periode */}
        <section className="bg-white dark:bg-[#1e2330] rounded-3xl p-6 border border-gray-200 dark:border-gray-800 text-center">
          <p className="text-xs font-bold tracking-widest uppercase text-gray-500">Lopende periode</p>
          <p className="text-4xl font-black text-blue-600 dark:text-blue-500 my-2">{euro(totaal)}</p>
          <p className="text-xs text-gray-500">{activePeriod?.naam || 'Geen open periode'}</p>
          {overzicht?.strepen > 0 && (
            <p className="text-xs text-gray-500 mt-2">
              Schatting: jouw strepen × de prijs van de drank. Bij het afsluiten verdeelt Drankteam de echte kost over
              alle strepen, dus het bedrag op je factuur kan nog wat verschillen.
            </p>
          )}
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2 px-1">Verbruik</h2>
          <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {perDrank.length === 0 && frietOpen.length === 0 && (
              <p className="p-4 text-center text-sm text-gray-500">Nog niets gestreept in deze periode.</p>
            )}
            {perDrank.map(([naam, aantal]) => (
              <div key={naam} className="p-4 flex justify-between">
                <span>{naam}</span>
                <span className="font-semibold">{aantal}×</span>
              </div>
            ))}
            {frietOpen.map(o => (
              <div key={o.id} className="p-4 flex justify-between">
                <span>🍟 Friet {new Date(o.date).toLocaleDateString('nl-BE')}</span>
                <span className="font-semibold">{euro(o.totalPrice)}</span>
              </div>
            ))}
            {overzicht && (
              <div className="p-4 space-y-1 text-sm">
                <div className="flex justify-between text-gray-500">
                  <span>Drank</span>
                  <span>{euro(overzicht.drank_bedrag)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span>Friet</span>
                  <span>{euro(overzicht.friet_bedrag)}</span>
                </div>
                {overzicht.correctie_bedrag !== 0 && (
                  <div className="flex justify-between text-gray-500">
                    <span>Correcties</span>
                    <span>{euro(overzicht.correctie_bedrag)}</span>
                  </div>
                )}
              </div>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold mb-2 px-1">Mijn facturen</h2>
          <div className="bg-white dark:bg-[#1e2330] rounded-2xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {facturen.length === 0 && <p className="p-4 text-center text-sm text-gray-500">Nog geen facturen.</p>}
            {facturen.map(f => (
              <div key={f.id} className="p-4 flex items-center gap-3">
                <div className="flex-1">
                  <p className="font-semibold">{f.periode}</p>
                  <p className="text-xs text-gray-500">
                    {f.status === 'betaald'
                      ? `Betaald${f.betaald_op ? ` op ${new Date(f.betaald_op).toLocaleDateString('nl-BE')}` : ''}`
                      : teBetalen(f)
                        ? 'Nog niet betaald'
                        : 'Niets te betalen'}
                  </p>
                </div>
                <span className="font-bold">{euro(f.totaal_bedrag)}</span>
                <span
                  className={`material-icons-round ${teBetalen(f) ? 'text-red-500' : 'text-green-500'}`}
                >
                  {teBetalen(f) ? 'schedule' : 'check_circle'}
                </span>
              </div>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};
