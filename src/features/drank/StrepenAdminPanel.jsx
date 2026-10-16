import React, { useMemo, useState } from 'react';

import { showToast } from '../../components/Toast';
import { useDrink } from './DrinkContext';
import * as db from '../../lib/supabaseService';
import { euro } from '../../lib/geld';
import { inVasteVolgorde, SPECIAL_DRINKS } from '../../lib/constants';
import { drankStatus, STATUS_TEKST, tijdslotTekst, naarInvoer, vanInvoer } from '../../lib/dranken';

// Dranken beheren (Drankteam), zie migratie 003400:
// - vaste dranken: naam en prijs aanpassen, uit de lijst halen (strepen blijven) of verwijderen als er nooit
//   op gestreept werd;
// - tijdelijke dranken: blijven altijd bewaard (niet te verwijderen), elk met een eigen tijdslot; dezelfde
//   naam mag opnieuw (een nieuwe drank). Gesorteerd op datum, nieuwste eerst.

const veld =
  'w-full px-3 py-2.5 rounded-xl bg-white dark:bg-white/10 text-sm focus:outline-none focus:ring-2 focus:ring-inkt/20 dark:focus:ring-white/30';
const Label = ({ children }) => (
  <label className="text-[10px] font-bold text-gray-500 uppercase ml-1 mb-1 block">{children}</label>
);

const STATUS_KLEUR = {
  gepland: 'bg-white dark:bg-white/10 text-gray-600 dark:text-gray-300',
  open: 'bg-inkt text-white dark:bg-white dark:text-inkt',
  afgelopen: 'bg-white dark:bg-white/10 text-gray-500 dark:text-gray-400',
};

// Standaard tijdslot voor een nieuwe tijdelijke drank: nu tot overmorgen 00:00
const standaardTot = () => {
  const d = new Date();
  d.setDate(d.getDate() + 2);
  d.setHours(0, 0, 0, 0);
  return d;
};

const prijsVan = tekst => parseFloat(String(tekst).replace(',', '.'));

export const StrepenAdminPanel = ({ onDrinkDeleted }) => {
  const { alleDranken, setDrinks, streaks } = useDrink();

  const [isTemporary, setIsTemporary] = useState(false);
  const [naam, setNaam] = useState('');
  const [prijs, setPrijs] = useState('');
  const [van, setVan] = useState(() => naarInvoer(new Date()));
  const [tot, setTot] = useState(() => naarInvoer(standaardTot()));
  const [bezig, setBezig] = useState(false);
  const [bewerk, setBewerk] = useState(null); // { id, naam, prijs, van, tot, isTemporary }

  const strepenPerDrank = useMemo(() => {
    const m = {};
    (streaks || []).forEach(s => (m[s.drinkId] = (m[s.drinkId] || 0) + (s.amount || 1)));
    return m;
  }, [streaks]);

  const vaste = useMemo(() => inVasteVolgorde(alleDranken.filter(d => !d.isTemporary)), [alleDranken]);
  const tijdelijke = useMemo(
    () => alleDranken.filter(d => d.isTemporary).sort((a, b) => (b.geldigVan || 0) - (a.geldigVan || 0)),
    [alleDranken],
  );

  const vervang = nieuw => setDrinks(prev => prev.map(d => (d.id === nieuw.id ? nieuw : d)));

  const toevoegen = async e => {
    e.preventDefault();
    const p = prijsVan(prijs);
    if (!naam.trim() || isNaN(p) || p < 0) return showToast('Vul een naam en een geldige prijs in', 'warning');
    const vanDatum = vanInvoer(van);
    const totDatum = vanInvoer(tot);
    if (isTemporary && (!vanDatum || !totDatum || totDatum <= vanDatum)) {
      return showToast('Het einde van het tijdslot moet na het begin liggen', 'warning');
    }
    setBezig(true);
    try {
      const nieuw = await db.addDrank(naam.trim(), p, isTemporary, vanDatum, totDatum);
      setDrinks(prev => [...prev, nieuw]);
      setNaam('');
      setPrijs('');
      showToast(isTemporary ? `Tijdelijke drank ${nieuw.name} toegevoegd` : `${nieuw.name} toegevoegd`, 'success');
    } catch (err) {
      showToast(
        err.code === '23505' ? 'Er bestaat al een vaste drank met die naam' : err.message || 'Toevoegen mislukt',
        'error',
      );
    } finally {
      setBezig(false);
    }
  };

  const startBewerk = d =>
    setBewerk({
      id: d.id,
      naam: d.name,
      prijs: String(d.price),
      van: naarInvoer(d.geldigVan),
      tot: naarInvoer(d.geldigTot),
      isTemporary: d.isTemporary,
    });

  const bewaar = async () => {
    const p = prijsVan(bewerk.prijs);
    if (!bewerk.naam.trim() || isNaN(p) || p < 0) return showToast('Vul een naam en een geldige prijs in', 'warning');
    let v = null;
    let t = null;
    if (bewerk.isTemporary) {
      v = vanInvoer(bewerk.van);
      t = vanInvoer(bewerk.tot);
      if (!v || !t || t <= v) return showToast('Het einde van het tijdslot moet na het begin liggen', 'warning');
    }
    try {
      await db.updateDrank(bewerk.id, bewerk.naam.trim(), p);
      let nieuw = {
        ...alleDranken.find(d => d.id === bewerk.id),
        name: bewerk.naam.trim(),
        naam: bewerk.naam.trim(),
        price: p,
        prijs: p,
      };
      if (bewerk.isTemporary) nieuw = await db.updateTijdslot(bewerk.id, v, t);
      vervang(nieuw);
      setBewerk(null);
      showToast('Drank bewaard', 'success');
    } catch (err) {
      showToast(err.code === '23505' ? 'Er bestaat al een vaste drank met die naam' : err.message || 'Bewaren mislukt', 'error');
    }
  };

  const wisselLijst = async d => {
    try {
      await db.setUitLijst(d.id, !d.uitLijst);
      vervang({ ...d, uitLijst: !d.uitLijst, uit_lijst: !d.uitLijst });
      showToast(
        d.uitLijst ? `${d.name} staat terug in de lijst` : `${d.name} uit de lijst gehaald (strepen blijven bewaard)`,
        'success',
      );
    } catch (err) {
      showToast(err.message || 'Aanpassen mislukt', 'error');
    }
  };

  const verwijder = async d => {
    if (!window.confirm(`${d.name} verwijderen? Dit kan enkel als er nog nooit op gestreept werd.`)) return;
    try {
      await db.deleteDrank(d.id);
      setDrinks(prev => prev.filter(x => x.id !== d.id));
      onDrinkDeleted?.(d.id);
      showToast('Drank verwijderd', 'success');
    } catch (err) {
      // bv. "Deze drank heeft al strepen. Haal hem uit de lijst in plaats van hem te verwijderen."
      showToast(err.message || 'Verwijderen mislukt', 'error');
    }
  };

  // Als functie (geen eigen component): anders verliest het invulveld de focus bij elke letter
  const bewerkvak = () => (
    <div key={bewerk.id} className="space-y-3 p-3 rounded-xl bg-white dark:bg-white/10">
      <div className="grid grid-cols-3 gap-2">
        <div className="col-span-2">
          <Label>Naam</Label>
          <input
            value={bewerk.naam}
            onChange={e => setBewerk({ ...bewerk, naam: e.target.value })}
            className={`${veld} bg-gray-50`}
          />
        </div>
        <div>
          <Label>Prijs (€)</Label>
          <input
            inputMode="decimal"
            value={bewerk.prijs}
            onChange={e => setBewerk({ ...bewerk, prijs: e.target.value })}
            className={`${veld} bg-gray-50`}
          />
        </div>
      </div>
      {bewerk.isTemporary && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label>Open vanaf</Label>
            <input
              type="datetime-local"
              value={bewerk.van}
              onChange={e => setBewerk({ ...bewerk, van: e.target.value })}
              className={`${veld} bg-gray-50`}
            />
          </div>
          <div>
            <Label>Open tot</Label>
            <input
              type="datetime-local"
              value={bewerk.tot}
              onChange={e => setBewerk({ ...bewerk, tot: e.target.value })}
              className={`${veld} bg-gray-50`}
            />
          </div>
        </div>
      )}
      <p className="text-xs text-gray-500 dark:text-gray-400">
        Een nieuwe prijs geldt enkel voor nieuwe strepen; bestaande strepen houden hun prijs.
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setBewerk(null)}
          className="flex-1 py-2.5 rounded-xl bg-kaart-event dark:bg-kaart-event-d font-bold text-sm"
        >
          Annuleren
        </button>
        <button
          type="button"
          onClick={bewaar}
          className="flex-1 py-2.5 rounded-xl bg-inkt text-white dark:bg-white dark:text-inkt font-bold text-sm"
        >
          Bewaren
        </button>
      </div>
    </div>
  );

  return (
    <section className="pb-4 space-y-4 text-inkt dark:text-white">
      {/* Nieuwe drank */}
      <form onSubmit={toevoegen} className="bg-kaart-event dark:bg-kaart-event-d p-5 rounded-2xl space-y-4">
        <div className="flex justify-between items-center gap-3">
          <h3 className="text-sm font-bold">Nieuwe drank</h3>
          <div className="bg-white dark:bg-white/10 p-1 rounded-full flex text-xs font-bold">
            {[
              [false, 'Vast'],
              [true, 'Tijdelijk'],
            ].map(([waarde, tekst]) => (
              <button
                key={tekst}
                type="button"
                onClick={() => setIsTemporary(waarde)}
                className={`px-3 py-1 rounded-full ${
                  isTemporary === waarde ? 'bg-inkt text-white dark:bg-white dark:text-inkt' : 'text-gray-500'
                }`}
              >
                {tekst}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Label>Naam</Label>
            <input value={naam} onChange={e => setNaam(e.target.value)} placeholder="bv. Cocktail" className={veld} />
          </div>
          <div>
            <Label>Prijs (€)</Label>
            <input
              inputMode="decimal"
              value={prijs}
              onChange={e => setPrijs(e.target.value)}
              placeholder="2,50"
              className={veld}
            />
          </div>
        </div>

        {isTemporary && (
          <>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Open vanaf</Label>
                <input type="datetime-local" value={van} onChange={e => setVan(e.target.value)} className={veld} />
              </div>
              <div>
                <Label>Open tot</Label>
                <input type="datetime-local" value={tot} onChange={e => setTot(e.target.value)} className={veld} />
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Binnen dit tijdslot kan iedereen strepen; daarbuiten enkel Drankteam. De drank blijft altijd bewaard.
              Dezelfde naam opnieuw gebruiken maakt een nieuwe, aparte drank.
            </p>
          </>
        )}

        <button
          type="submit"
          disabled={bezig}
          className="w-full bg-inkt dark:bg-white text-white dark:text-inkt font-bold py-3 rounded-2xl active:scale-[0.99] disabled:opacity-40 flex items-center justify-center gap-2"
        >
          <span className="material-icons-round text-sm">add</span>
          {bezig ? 'Toevoegen…' : isTemporary ? 'Tijdelijke drank toevoegen' : 'Drank toevoegen'}
        </button>
      </form>

      {/* Vaste dranken */}
      <div className="bg-kaart-event dark:bg-kaart-event-d p-5 rounded-2xl">
        <h3 className="text-sm font-bold mb-3">Vaste dranken</h3>
        <div className="space-y-2">
          {vaste.map(d =>
            bewerk?.id === d.id ? (
              bewerkvak()
            ) : (
              <div
                key={d.id}
                className={`flex items-center gap-2 p-3 bg-white dark:bg-white/10 rounded-xl ${d.uitLijst ? 'opacity-60' : ''}`}
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-bold truncate">{d.name}</span>
                  <span className="block text-xs text-gray-500 dark:text-gray-400">
                    {d.uitLijst ? 'Uit de lijst · ' : ''}
                    {strepenPerDrank[d.id] || 0} strepen
                  </span>
                </span>
                <span className="text-sm text-gray-500 dark:text-gray-400 tabular-nums px-1">{euro(d.price)}</span>
                <button
                  type="button"
                  onClick={() => startBewerk(d)}
                  aria-label="Aanpassen"
                  className="p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-lg"
                >
                  <span className="material-icons-round text-sm">edit</span>
                </button>
                <button
                  type="button"
                  onClick={() => wisselLijst(d)}
                  aria-label={d.uitLijst ? 'Terug in de lijst' : 'Uit de lijst halen'}
                  title={d.uitLijst ? 'Terug in de lijst' : 'Uit de lijst halen'}
                  className="p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-lg"
                >
                  <span className="material-icons-round text-sm">{d.uitLijst ? 'visibility' : 'visibility_off'}</span>
                </button>
                {!strepenPerDrank[d.id] && !Object.values(SPECIAL_DRINKS).includes(d.name) && (
                  <button
                    type="button"
                    onClick={() => verwijder(d)}
                    aria-label="Verwijderen"
                    className="p-2 text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/15 rounded-lg"
                  >
                    <span className="material-icons-round text-sm">delete</span>
                  </button>
                )}
              </div>
            ),
          )}
        </div>
      </div>

      {/* Tijdelijke dranken */}
      <div className="bg-kaart-event dark:bg-kaart-event-d p-5 rounded-2xl">
        <h3 className="text-sm font-bold">Tijdelijke dranken</h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Nieuwste eerst. Blijven altijd bewaard.</p>
        {tijdelijke.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-gray-400">Nog geen tijdelijke dranken.</p>
        ) : (
          <div className="space-y-2">
            {tijdelijke.map(d => {
              if (bewerk?.id === d.id) return bewerkvak();
              const status = drankStatus(d);
              return (
                <div key={d.id} className="flex items-center gap-2 p-3 bg-white dark:bg-white/10 rounded-xl">
                  <span className="flex-1 min-w-0">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-bold truncate">{d.name}</span>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_KLEUR[status]}`}>
                        {STATUS_TEKST[status]}
                      </span>
                    </span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400">{tijdslotTekst(d)}</span>
                    <span className="block text-xs text-gray-500 dark:text-gray-400 tabular-nums">
                      {euro(d.price)} · {strepenPerDrank[d.id] || 0} strepen
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={() => startBewerk(d)}
                    aria-label="Aanpassen"
                    className="p-2 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-white/10 rounded-lg"
                  >
                    <span className="material-icons-round text-sm">edit</span>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
