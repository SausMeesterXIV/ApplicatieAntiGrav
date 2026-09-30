import React from 'react';
import { useNavigate } from 'react-router-dom';

// Horizontaal scrollbare rij bollen (zoals Instagram-stories).
// nieuw: Set met bol-id's die een oranje ring krijgen (er is iets nieuws of iets open).
export const Bollenrij = ({ bollen, nieuw = new Set() }) => {
  const navigate = useNavigate();

  return (
    <nav aria-label="Snel naar" className="-mx-4 overflow-x-auto no-scrollbar">
      <ul className="flex gap-3 px-4 pb-1 pt-1 w-max">
        {bollen.map(b => (
          <li key={b.id}>
            <button
              type="button"
              onClick={() => navigate(b.route)}
              className="flex flex-col items-center gap-1.5 w-[68px] focus:outline-none group"
              aria-label={nieuw.has(b.id) ? `${b.label} (nieuw)` : b.label}
            >
              <span
                className={`rounded-full p-[3px] transition-transform group-active:scale-95 ${
                  nieuw.has(b.id) ? 'bg-nieuw' : 'bg-gray-200 dark:bg-gray-700'
                } group-focus-visible:ring-2 group-focus-visible:ring-blue-500`}
              >
                <span className="block rounded-full p-[2px] bg-gray-50 dark:bg-[#0f172a]">
                  <span
                    className={`flex items-center justify-center w-14 h-14 rounded-full text-[15px] font-extrabold tracking-wide ${b.kleur} ${
                      b.rol ? '' : 'text-inkt dark:text-white'
                    }`}
                  >
                    {b.afk}
                  </span>
                </span>
              </span>
              <span className="text-xs text-gray-700 dark:text-gray-300 truncate max-w-full">{b.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
};
