import React, { useState } from 'react';
import { showToast } from '../../components/Toast';
import { euro } from '../../lib/geld';
import * as fin from '../../lib/financien';
import { datumKort } from './datum';

// Eén bedrag van één leider, met een knop betaald/niet betaald.
// toon: 'naam' (in een betaling) of 'titel' (bij een leider)
export const PostRij = ({ post, toon = 'naam', onGewijzigd, extra }) => {
  const [bezig, setBezig] = useState(false);
  const betaald = post.status === 'betaald';
  const niksTeBetalen = !(Number(post.bedrag) > 0);
  const teLaat = fin.isTeLaat(post);

  const wissel = async () => {
    setBezig(true);
    try {
      await fin.zetBetaald(post.soort, post.id, !betaald);
      await onGewijzigd();
    } catch (e) {
      showToast(e.message || 'Aanpassen mislukt', 'error');
    } finally {
      setBezig(false);
    }
  };

  return (
    <div className="py-3 flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <p className="font-semibold truncate">{toon === 'naam' ? post.naam : post.titel}</p>
        <p className="text-xs text-gray-500 truncate">
          {betaald
            ? `Betaald${post.betaald_op ? ` op ${datumKort(post.betaald_op)}` : ''}`
            : niksTeBetalen
              ? 'Niets te betalen'
              : teLaat
                ? `Te laat (voor ${datumKort(post.vervaldatum)})`
                : post.vervaldatum
                  ? `Te betalen voor ${datumKort(post.vervaldatum)}`
                  : 'Nog niet betaald'}
          {post.opmerking ? ` · ${post.opmerking}` : ''}
        </p>
      </div>
      {extra}
      <span className={`font-bold ${teLaat ? 'text-red-600' : ''}`}>{euro(post.bedrag)}</span>
      <button
        onClick={wissel}
        disabled={bezig || niksTeBetalen}
        aria-pressed={betaald}
        title={betaald ? 'Terugzetten naar niet betaald' : 'Op betaald zetten'}
        className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 transition disabled:opacity-40 ${
          betaald ? 'bg-green-500 text-white' : 'bg-gray-100 dark:bg-gray-800 text-gray-400'
        }`}
      >
        <span className="material-icons-round">{betaald ? 'check' : 'radio_button_unchecked'}</span>
      </button>
    </div>
  );
};
