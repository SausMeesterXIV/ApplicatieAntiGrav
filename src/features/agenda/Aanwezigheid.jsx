import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { useAgenda } from './AgendaContext';

const OPTIES = [
  { status: 'komt', label: 'Komt', icon: 'check_circle', actief: 'bg-green-600 text-white border-green-600' },
  { status: 'misschien', label: 'Misschien', icon: 'help', actief: 'bg-amber-500 text-white border-amber-500' },
  { status: 'komt_niet', label: 'Komt niet', icon: 'cancel', actief: 'bg-red-600 text-white border-red-600' },
];

// Aanwezigheid voor één agenda-item: eigen keuze + wie er komt
export const Aanwezigheid = ({ eventId }) => {
  const { currentUser, users } = useAuth();
  const { aanwezigheden, handleSetAanwezigheid } = useAgenda();
  const [open, setOpen] = useState(false);

  const voorEvent = aanwezigheden.filter(a => a.event_id === eventId);
  const mijnStatus = voorEvent.find(a => a.user_id === currentUser?.id)?.status;
  const naam = id => {
    const u = users.find(x => x.id === id);
    return u?.nickname || u?.naam || 'Onbekend';
  };

  return (
    <div className="pt-3 border-t border-gray-100 dark:border-gray-800">
      <div className="grid grid-cols-3 gap-2">
        {OPTIES.map(o => {
          const aantal = voorEvent.filter(a => a.status === o.status).length;
          return (
            <button
              key={o.status}
              onClick={() => handleSetAanwezigheid(eventId, o.status)}
              className={`py-2 rounded-xl border text-xs font-bold flex items-center justify-center gap-1 transition-colors ${
                mijnStatus === o.status
                  ? o.actief
                  : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300'
              }`}
            >
              <span className="material-icons-round text-sm">{o.icon}</span>
              {o.label}
              {aantal > 0 && <span className="opacity-80">({aantal})</span>}
            </button>
          );
        })}
      </div>

      {voorEvent.length > 0 && (
        <button onClick={() => setOpen(!open)} className="mt-2 text-xs font-semibold text-blue-600 dark:text-blue-400">
          {open ? 'Verberg wie er komt' : 'Toon wie er komt'}
        </button>
      )}

      {open && (
        <div className="mt-2 space-y-1 text-xs text-gray-600 dark:text-gray-400">
          {OPTIES.map(o => {
            const namen = voorEvent.filter(a => a.status === o.status).map(a => naam(a.user_id));
            if (namen.length === 0) return null;
            return (
              <p key={o.status}>
                <span className="font-bold">{o.label}:</span> {namen.sort().join(', ')}
              </p>
            );
          })}
        </div>
      )}
    </div>
  );
};
