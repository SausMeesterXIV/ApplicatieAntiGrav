import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

// Onderste navigatie (design-update): enkel iconen, actief = donker, oranje stip bij ongelezen meldingen
export const BottomNav = ({ notifications = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname.split('/')[1] || 'home';
  const navItems = [
    { id: 'home', icon: 'home', label: 'Start' },
    { id: 'strepen', icon: 'sports_bar', label: 'Strepen' },
    { id: 'notificaties', icon: 'notifications', label: 'Meldingen', badge: true },
    { id: 'agenda', icon: 'calendar_today', label: 'Agenda' },
    { id: 'settings', icon: 'settings', label: 'Instellingen' },
  ];

  const hasUnread = React.useMemo(() => notifications.some(n => !n.isRead), [notifications]);

  return (
    <nav
      className="w-full border-t border-gray-200 dark:border-gray-800 pt-2 px-4 bg-white dark:bg-[#0f172a]"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 8px), 8px)' }}
      aria-label="Hoofdmenu"
    >
      <div className="flex justify-between items-center">
        {navItems.map(item => {
          const actief = activeTab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(`/${item.id === 'home' ? '' : item.id}`)}
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
