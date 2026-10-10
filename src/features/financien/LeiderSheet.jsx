import React, { useState } from 'react';
import { BottomSheet } from '../../components/Modal';
import { showToast } from '../../components/Toast';
import { euro } from '../../lib/geld';
import * as fin from '../../lib/financien';
import { PostRij } from './PostRij';

// Alles van één leider: openstaand, betaald, lopende drankperiode; herinnering sturen.
export const LeiderSheet = ({ leider, currentUser, onClose, onGewijzigd }) => {
  const [toonBetaald, setToonBetaald] = useState(false);
  const [bezig, setBezig] = useState(false);
  const open = leider.posten.filter(fin.isOpen);
  const rest = leider.posten.filter(p => !fin.isOpen(p));
  const sorteer = lijst => [...lijst].sort((a, b) => String(b.aangemaakt_op).localeCompare(String(a.aangemaakt_op)));

  const herinnerLeider = async () => {
    if (!open.length) return;
    if (!window.confirm(`${leider.naam} een herinnering sturen voor ${euro(leider.open)}?`)) return;
    setBezig(true);
    try {
      await fin.herinner(currentUser, open);
      showToast('Herinnering verstuurd', 'success');
    } catch (e) {
      showToast(e.message || 'Versturen mislukt', 'error');
    } finally {
      setBezig(false);
    }
  };

  return (
    <BottomSheet
      isOpen
      onClose={onClose}
      title={leider.naam}
      subtitle={leider.open > 0 ? `Nog ${euro(leider.open)} te betalen` : 'Niets openstaand'}
    >
      <div className="space-y-4">
        {leider.schatting > 0 && (
          <div className="p-3 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-sm">
            <p className="font-bold text-blue-700 dark:text-blue-300">Lopende drankperiode: ~{euro(leider.schatting)}</p>
            <p className="text-xs text-blue-700/80 dark:text-blue-300/80">
              Schatting: komt op een drankfactuur zodra Drankteam de periode afsluit.
            </p>
          </div>
        )}

        {open.length > 0 && (
          <button
            onClick={herinnerLeider}
            disabled={bezig}
            className="w-full py-2.5 rounded-xl bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-400 text-sm font-bold flex items-center justify-center gap-1 disabled:opacity-40"
          >
            <span className="material-icons-round text-base">notifications_active</span> Herinnering sturen
          </button>
        )}

        <section>
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Openstaand</h3>
          <div className="divide-y divide-gray-100 dark:divide-gray-800">
            {open.length === 0 && <p className="py-3 text-sm text-gray-500">Niets openstaand.</p>}
            {sorteer(open).map(p => (
              <PostRij key={`${p.soort}-${p.id}`} post={p} toon="titel" onGewijzigd={onGewijzigd} />
            ))}
          </div>
        </section>

        {rest.length > 0 && (
          <section>
            <button onClick={() => setToonBetaald(t => !t)} className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1">
              Betaald en afgehandeld ({rest.length})
              <span className="material-icons-round text-base">{toonBetaald ? 'expand_less' : 'expand_more'}</span>
            </button>
            {toonBetaald && (
              <div className="divide-y divide-gray-100 dark:divide-gray-800">
                {sorteer(rest).map(p => (
                  <PostRij key={`${p.soort}-${p.id}`} post={p} toon="titel" onGewijzigd={onGewijzigd} />
                ))}
              </div>
            )}
          </section>
        )}
      </div>
    </BottomSheet>
  );
};
