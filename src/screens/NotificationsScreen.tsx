import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAgenda } from '../contexts/AgendaContext';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { Notification } from '../types';
import { SkeletonRow } from '../components/Skeleton';

export const NotificationsScreen: React.FC = () => {
  const navigate = useNavigate();
    const { loading } = useAuth();
  const { notifications, handleMarkNotificationAsRead: onMarkAsRead } = useAgenda();
  const [filter, setFilter] = useState<'Alles' | 'Nudges' | 'Officieel'>('Alles');

  const getCategory = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const d1 = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const d2 = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diff = Math.floor((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));

    if (diff === 0) return 'Vandaag';
    if (diff === 1) return 'Gisteren';
    if (diff < 7) return 'Deze week';
    if (diff < 30) return 'Deze maand';
    return 'Ouder';
  };

  const filteredData = filter === 'Alles'
    ? notifications
    : filter === 'Nudges'
      ? notifications.filter(n => n.type === 'nudge')
      : notifications.filter(n => n.type !== 'nudge');

  const hasUnreadNudges = notifications.some(n => n.type === 'nudge' && !n.isRead);
  const hasUnreadOfficial = notifications.some(n => n.type !== 'nudge' && !n.isRead);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white transition-colors duration-200">
      {/* Header */}
      <header className="px-4 pb-6 pt-[calc(1.5rem+env(safe-area-inset-top,0px))] flex items-center gap-2 sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 transition-colors">
        <ChevronBack onClick={() => navigate(-1)} />
        <h1 className="text-3xl font-bold tracking-tight">Meldingen</h1>
      </header>

      {/* Tabs */}
      <div className="px-6 pb-4">
        <div className="flex bg-white dark:bg-[#1e293b] p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 transition-colors">
          {['Alles', 'Nudges', 'Officieel'].map((f) => {
            const isUnread = f === 'Nudges' ? hasUnreadNudges : f === 'Officieel' ? hasUnreadOfficial : (hasUnreadNudges || hasUnreadOfficial);
            return (
              <button
                key={f}
                onClick={() => setFilter(f as any)}
                className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all flex items-center justify-center gap-1.5 ${filter === f
                  ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm'
                  : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                  }`}
              >
                <span>{f}</span>
                {isUnread && (
                  <span className="w-2 h-2 bg-red-500 rounded-full shadow-sm shadow-red-500/50"></span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      <main className="flex-1 overflow-y-auto px-4 pb-nav-safe space-y-8">
        {loading ? (
          <div className="space-y-4 pt-2">
            {Array.from({ length: 6 }).map((_, i) => <SkeletonRow key={i} />)}
          </div>
        ) : (
          <>
            {['Vandaag', 'Gisteren', 'Deze week', 'Deze maand', 'Ouder'].map((category) => {
              const categoryData = filteredData.filter(n => getCategory(n.datum) === category);
              if (categoryData.length === 0) return null;

              return (
                <div key={category} className="space-y-4">
                  <div className="flex items-center gap-3 px-2">
                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                      {category}
                    </span>
                    <div className="h-[1px] w-full bg-gray-200 dark:bg-gray-800/60"></div>
                  </div>
                  <div className="space-y-3">
                    {categoryData.map(notification => (
                      <NotificationCard
                        key={notification.id}
                        data={notification}
                        onClick={() => onMarkAsRead(notification.id)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

            {filteredData.length === 0 && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <span className="material-icons-round text-5xl text-gray-300 dark:text-gray-700 mb-2">notifications_off</span>
                <p className="text-gray-500 text-sm italic">Geen meldingen gevonden.</p>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

const NotificationCard: React.FC<{ data: Notification, onClick: () => void }> = ({ data, onClick }) => {
  const navigate = useNavigate();

  // Parse action: supports "LABEL|URL" format for navigable buttons
  const parseAction = (action: string) => {
    if (action.includes('|')) {
      const [label, url] = action.split('|');
      return { label: label.trim(), url: url.trim() };
    }
    return { label: action, url: '' };
  };

  const actionInfo = data.action ? parseAction(data.action) : null;

  const handleActionClick = (e: React.MouseEvent) => {
    e.stopPropagation(); // Don't trigger the card's onClick (mark as read)
    if (actionInfo?.url) {
      navigate(actionInfo.url);
    }
  };

  return (
    <div
      onClick={(e) => {
        e.preventDefault();
        if (!data.isRead) {
          onClick();
        }
      }}
      className={`p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${data.isRead ? 'bg-white dark:bg-[#1e293b]/50 border-gray-100 dark:border-gray-800' : 'bg-white dark:bg-[#1e293b] border-blue-200 dark:border-blue-900/50 shadow-sm dark:shadow-md ring-1 ring-blue-50 dark:ring-blue-900/20'}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="relative shrink-0">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${data.color}`}>
            <span className="material-icons-round text-2xl">{data.icon}</span>
          </div>
          {!data.isRead && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-[#1e293b] shadow-sm animate-pulse"></span>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex justify-between items-start mb-1">
            <div className="flex items-center gap-2">
              <h3 className={`font-bold text-sm ${data.isRead ? 'text-gray-500 dark:text-gray-400' : 'text-gray-900 dark:text-white'}`}>
                {data.sender}
              </h3>
              {data.role && (
                <span className="bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-600/30">
                  {data.role}
                </span>
              )}
            </div>

          </div>

          {data.title && <p className="text-gray-900 dark:text-white text-sm font-medium mb-1">{data.title}</p>}

          <p className={`text-sm leading-relaxed ${data.type === 'nudge' ? 'italic text-gray-500 dark:text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
            {data.content}
          </p>

          <div className="flex justify-between items-center mt-3">
            <span className="text-xs text-gray-500 dark:text-gray-600 font-medium">{data.time}</span>
            {actionInfo && (
              <button
                onClick={handleActionClick}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:text-blue-500 border border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg transition-colors active:scale-[0.97]"
              >
                {actionInfo.label}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};