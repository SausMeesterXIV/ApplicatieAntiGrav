import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const BottomNav: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Extract the first part of the path to determine active tab
  const activeTab = location.pathname.split('/')[1] || 'home';
  const navItems = [
    { id: 'home', icon: 'home', label: 'Start' },
    { id: 'strepen', icon: 'local_bar', label: 'Strepen' },
    { id: 'notifications', icon: 'notifications', label: 'Meldingen', badge: true },
    { id: 'agenda', icon: 'event', label: 'Agenda' },
    { id: 'settings', icon: 'settings', label: 'Instellingen' },
  ];

  return (
    <nav className="fixed bottom-0 w-full bg-surface-light dark:bg-surface-dark border-t border-gray-200 dark:border-gray-800 pb-safe pt-2 px-4 z-50">
      <div className="flex justify-between items-center pb-4">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => navigate(`/${item.id === 'home' ? '' : item.id}`)}
            className={`flex flex-col items-center gap-1 p-2 transition-colors duration-200 relative group ${activeTab === item.id
                ? 'text-primary dark:text-blue-400'
                : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300'
              }`}
          >
            <div className="relative">
              <span className="material-icons-round text-2xl">{item.icon}</span>
              {item.badge && activeTab !== 'notifications' && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-blue-500 rounded-full border-2 border-surface-light dark:border-surface-dark"></span>
              )}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};