import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Notification } from '../types';

interface BottomNavProps {
  notifications?: Notification[];
}

export const BottomNav: React.FC<BottomNavProps> = ({ notifications = [] }) => {
  const navigate = useNavigate();
  const location = useLocation();

  const activeTab = location.pathname.split('/')[1] || 'home';
  const navItems = [
    { id: 'home', icon: 'home', label: 'Start' },
    { id: 'strepen', icon: 'local_bar', label: 'Strepen' },
    { id: 'notificaties', icon: 'notifications', label: 'Meldingen', badge: true },
    { id: 'agenda', icon: 'event', label: 'Agenda' },
    { id: 'settings', icon: 'settings', label: 'Instellingen' },
  ];

  const hasUnread = notifications.some(n => !n.isRead);

  return (
    <nav
      className="w-full border-t border-gray-200 dark:border-gray-800 shadow-[0_-2px_10px_rgba(0,0,0,0.05)] pt-2 px-4 transition-colors duration-200 bg-white dark:bg-[#0f172a]"
      style={{ 
        /* Fix: Gebruik env() met een fallback van 12px voor de bufferzone onderaan */
        paddingBottom: 'calc(env(safe-area-inset-bottom, 12px) + 8px)' 
      }}
    >
      <div className="flex justify-between items-center">
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
              {item.badge && hasUnread && activeTab !== 'notificaties' && (
                <span className="absolute top-0 right-0 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-900"></span>
              )}
            </div>
            <span className="text-[10px] font-medium">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};