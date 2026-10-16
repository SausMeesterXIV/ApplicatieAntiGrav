import React from 'react';

// Gegroepeerde lijst in de stijl van Instellingen (design-update): een kopje en daaronder rijen in één kaart.

export const Groep = ({ titel, children }) => (
  <section className="space-y-2">
    {titel && (
      <h2 className="px-2 text-xs font-bold uppercase tracking-[0.08em] text-gray-500 dark:text-gray-400">{titel}</h2>
    )}
    <div className="rounded-2xl bg-kaart-event dark:bg-kaart-event-d overflow-hidden divide-y divide-white dark:divide-white/5">
      {children}
    </div>
  </section>
);

export const Rij = ({ icoon, label, sub, waarde, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className="w-full flex items-center gap-3 px-5 py-4 text-left active:bg-black/5 dark:active:bg-white/5"
  >
    {icoon && <span className="material-icons-round text-xl text-gray-500 dark:text-gray-400">{icoon}</span>}
    <span className="flex-1 min-w-0">
      <span className="block font-semibold text-base truncate">{label}</span>
      {sub && <span className="block text-sm text-gray-500 dark:text-gray-400 truncate">{sub}</span>}
    </span>
    <span className="flex items-center gap-1 min-w-0 text-gray-500 dark:text-gray-400">
      {waarde && <span className="truncate text-sm">{waarde}</span>}
      <span className="material-icons-round text-xl">chevron_right</span>
    </span>
  </button>
);
