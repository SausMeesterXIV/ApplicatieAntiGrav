import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Hoofdmenu: op gsm een balk onderaan (enkel iconen), op een computer een zijbalk links (met namen).
const NAV_ITEMS = [
  { id: 'home', icon: 'home', label: 'Start' },
  { id: 'strepen', icon: 'sports_bar', label: 'Strepen' },
  { id: 'notificaties', icon: 'notifications', label: 'Meldingen', badge: true },
  { id: 'agenda', icon: 'calendar_today', label: 'Agenda' },
  { id: 'settings', icon: 'settings', label: 'Instellingen' },
];

const useMenu = notifications => {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = location.pathname.split('/')[1] || 'home';
  const hasUnread = React.useMemo(() => notifications.some(n => !n.isRead), [notifications]);
  const ga = item => navigate(`/${item.id === 'home' ? '' : item.id}`);
  return { activeTab, hasUnread, ga };
};

export const BottomNav = ({ notifications = [] }) => {
  const { activeTab, hasUnread, ga } = useMenu(notifications);

  return (
    <nav
      className="w-full border-t border-gray-200 dark:border-gray-800 pt-2 px-4 bg-white dark:bg-[#0f172a]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}
      aria-label="Hoofdmenu"
    >
      <div className="flex justify-between items-center">
        {NAV_ITEMS.map(item => {
          const actief = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => ga(item)}
              aria-label={item.label}
              aria-current={actief ? 'page' : undefined}
              className={`relative flex items-center justify-center w-12 h-12 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                actief ? 'text-inkt dark:text-white' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
            >
              <span className="material-icons-round text-[28px]">{item.icon}</span>
              {item.badge && hasUnread && !actief && (
                <span className="absolute top-2 right-2.5 w-2.5 h-2.5 bg-nieuw rounded-full border-2 border-white dark:border-[#0f172a]" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export const Zijbalk = ({ notifications = [] }) => {
  const { activeTab, hasUnread, ga } = useMenu(notifications);

  return (
    <nav aria-label="Hoofdmenu" className="h-full flex flex-col gap-8 px-4 py-8">
      <button type="button" onClick={() => ga(NAV_ITEMS[0])} className="px-3 text-left">
        <span className="block text-xs font-semibold uppercase tracking-[0.12em] text-gray-500 dark:text-gray-400">
          Leidingsapp
        </span>
        <span className="block text-2xl font-extrabold tracking-tight text-inkt dark:text-white">ksa aalter</span>
      </button>
      <ul className="space-y-1">
        {NAV_ITEMS.map(item => {
          const actief = activeTab === item.id;
          return (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => ga(item)}
                aria-current={actief ? 'page' : undefined}
                className={`w-full flex items-center gap-3 rounded-2xl px-3 py-2.5 text-left font-semibold transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  actief
                    ? 'bg-inkt text-white dark:bg-white dark:text-inkt'
                    : 'text-gray-600 hover:bg-gray-200/70 dark:text-gray-300 dark:hover:bg-white/5'
                }`}
              >
                <span className="material-icons-round text-2xl">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                {item.badge && hasUnread && !actief && (
                  <span className="w-2.5 h-2.5 rounded-full bg-nieuw" aria-label="ongelezen meldingen" />
                )}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
};
