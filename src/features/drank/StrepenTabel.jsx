import React, { useMemo } from 'react';
import { inVasteVolgorde } from '../../lib/constants';
import { euro } from '../../lib/geld';

// Team Drank → Strepen per leider: alle strepen van de open periode in één tabel (leider × drank), zoals de
// Drankrekening in de Google Sheet. Kolommen: vaste dranken in de lijst plus elke drank waarop gestreept werd.
// Tik op een leider om strepen bij te zetten of te verwijderen.
export const StrepenTabel = ({ leiding, strepen, dranken, onKies }) => {
  const kolommen = useMemo(() => {
    const gestreept = new Set(strepen.map(s => String(s.drinkId)));
    const uitLijst = inVasteVolgorde(dranken.filter(d => (!d.isTemporary && !d.uitLijst) || gestreept.has(String(d.id))));
    const bekend = new Set(uitLijst.map(d => String(d.id)));
    // Strepen op een drank die niet (meer) in de lijst van de app zit
    const los = [];
    for (const s of strepen) {
      if (!bekend.has(String(s.drinkId))) {
        bekend.add(String(s.drinkId));
        los.push({ id: s.drinkId, name: s.drinkLabel || s.drinkName });
      }
    }
    return [...uitLijst, ...los].map(d => ({ id: String(d.id), naam: d.name, tijdelijk: d.isTemporary }));
  }, [strepen, dranken]);

  // aantal[leider][drank] en bedrag per leider
  const { aantal, bedrag, perDrank } = useMemo(() => {
    const a = {};
    const b = {};
    const p = {};
    for (const s of strepen) {
      const rij = (a[s.userId] ||= {});
      rij[String(s.drinkId)] = (rij[String(s.drinkId)] || 0) + s.amount;
      b[s.userId] = (b[s.userId] || 0) + s.price * s.amount;
      p[String(s.drinkId)] = (p[String(s.drinkId)] || 0) + s.amount;
    }
    return { aantal: a, bedrag: b, perDrank: p };
  }, [strepen]);

  const totaal = Object.values(perDrank).reduce((x, y) => x + y, 0);
  const totaalBedrag = Object.values(bedrag).reduce((x, y) => x + y, 0);
  const cel = 'px-2 py-2.5 text-center tabular-nums';
  const vast = 'sticky left-0 z-10 bg-kaart-event dark:bg-[#1b2232]';

  return (
    <div className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-x-auto">
      <table className="min-w-full text-sm border-collapse">
        <thead>
          <tr className="text-xs font-bold text-gray-500 dark:text-gray-400 border-b border-white dark:border-white/5">
            <th className={`${vast} text-left px-4 py-2.5`}>Leider</th>
            {kolommen.map(k => (
              <th key={k.id} className={`${cel} whitespace-nowrap font-bold`} title={k.naam}>
                {k.naam}
                {k.tijdelijk && <span className="block text-[10px] font-semibold opacity-70">tijdelijk</span>}
              </th>
            ))}
            <th className={`${cel} text-inkt dark:text-white`}>Totaal</th>
            <th className={`${cel} pr-4 text-right`}>Bedrag</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-white dark:divide-white/5">
          {leiding.map(u => {
            const rij = aantal[u.id] || {};
            const som = Object.values(rij).reduce((x, y) => x + y, 0);
            return (
              <tr key={u.id} onClick={() => onKies(u.id)} className="cursor-pointer active:bg-black/5 dark:active:bg-white/5 hover:bg-black/[0.03] dark:hover:bg-white/[0.03]">
                <td className={`${vast} px-4 py-2.5 font-semibold whitespace-nowrap max-w-[9rem] truncate`}>{u.naam}</td>
                {kolommen.map(k => (
                  <td key={k.id} className={`${cel} ${rij[k.id] ? 'font-semibold' : 'text-gray-300 dark:text-gray-600'}`}>
                    {rij[k.id] || '·'}
                  </td>
                ))}
                <td className={`${cel} font-extrabold`}>{som || '·'}</td>
                <td className={`${cel} pr-4 text-right whitespace-nowrap text-gray-500 dark:text-gray-400`}>{som ? euro(bedrag[u.id] || 0) : ''}</td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-white dark:border-white/10 font-extrabold">
            <td className={`${vast} px-4 py-2.5`}>Totaal</td>
            {kolommen.map(k => (
              <td key={k.id} className={cel}>
                {perDrank[k.id] || 0}
              </td>
            ))}
            <td className={cel}>{totaal}</td>
            <td className={`${cel} pr-4 text-right whitespace-nowrap`}>{euro(totaalBedrag)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
};
