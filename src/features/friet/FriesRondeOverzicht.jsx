import React, { useMemo } from 'react';
import { euro } from '../../lib/geld';

// Totalen per item (wat je aan de frituur bestelt)
export function totalenPerItem(orders) {
  const map = new Map();
  orders.forEach(o =>
    (o.items || []).forEach(item => {
      const key = item.id || item.name;
      const qty = item.quantity || 1;
      const prev = map.get(key) || { naam: item.name || 'Onbekend', aantal: 0, bedrag: 0 };
      prev.aantal += qty;
      prev.bedrag += (item.price || 0) * qty;
      map.set(key, prev);
    }),
  );
  return [...map.values()].sort((a, b) => a.naam.localeCompare(b.naam));
}

export const PerItem = ({ orders }) => {
  const items = useMemo(() => totalenPerItem(orders), [orders]);
  return (
    <div className="bg-white dark:bg-[#1e293b] rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
      {items.length === 0 && <p className="p-4 text-center text-sm text-gray-500">Geen items.</p>}
      {items.map(i => (
        <div key={i.naam} className="p-3 flex items-center gap-3">
          <span className="w-8 text-center font-bold text-blue-600">{i.aantal}×</span>
          <span className="flex-1">{i.naam}</span>
          <span className="text-sm text-gray-500">{euro(i.bedrag)}</span>
        </div>
      ))}
    </div>
  );
};

// Per persoon: wie bestelde wat, en hoeveel komt op de drankfactuur
export const PerPersoon = ({ orders }) => {
  const personen = useMemo(() => {
    const map = new Map();
    orders.forEach(o => {
      const p = map.get(o.userId) || { naam: o.userName || 'Onbekend', items: [], totaal: 0 };
      p.items.push(...(o.items || []));
      p.totaal += o.totalPrice || 0;
      map.set(o.userId, p);
    });
    return [...map.values()].sort((a, b) => a.naam.localeCompare(b.naam));
  }, [orders]);

  return (
    <div className="space-y-2">
      {personen.length === 0 && <p className="p-4 text-center text-sm text-gray-500">Nog geen bestellingen.</p>}
      {personen.map(p => (
        <div
          key={p.naam}
          className="bg-white dark:bg-[#1e293b] p-3 rounded-xl border border-gray-200 dark:border-gray-800"
        >
          <div className="flex justify-between font-bold">
            <span>{p.naam}</span>
            <span>{euro(p.totaal)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            {p.items.map(i => `${i.quantity || 1}× ${i.name}`).join(', ') || 'Geen items'}
          </p>
        </div>
      ))}
    </div>
  );
};
