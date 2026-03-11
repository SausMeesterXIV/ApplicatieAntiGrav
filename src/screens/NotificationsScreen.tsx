import React, { useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { Notification } from '../types';
import { AppContextType } from '../App';
import { SkeletonRow } from '../components/Skeleton';

export const NotificationsScreen: React.FC = () => {
  const navigate = useNavigate();
  const { notifications, handleMarkNotificationAsRead: onMarkAsRead, loading } = useOutletContext<AppContextType>();
  const [filter, setFilter] = useState<'Alles' | 'Nudges' | 'Officieel'>('Alles');

  const filteredData = filter === 'Alles'
    ? notifications
    : filter === 'Nudges'
      ? notifications.filter(n => n.type === 'nudge')
      : notifications.filter(n => n.type === 'official' || n.type === 'agenda' || n.type === 'order');

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-6 flex items-center gap-2 sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-10 transition-colors">
        <ChevronBack onClick={() => navigate(-1)} />
        <h1 className="text-3xl font-bold tracking-tight">Meldingen</h1>
      </header>

      {/* Tabs */}
      <div className="px-6 pb-4">
        <div className="flex bg-white dark:bg-[#1e293b] p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 transition-colors">
          {['Alles', 'Nudges', 'Officieel'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f as any)}
              className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${filter === f
                ? 'bg-gray-100 dark:bg-[#334155] text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <main className="flex-1 overflow-y-auto px-4 pb-nav-safe space-y-6">
        {loading ? (
          <div className="space-y-4 pt-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : (
          <>
            {/* Today Section */}
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Vandaag</h2>
              <div className="space-y-3">
                {filteredData.filter(n => !n.time.includes('Gisteren') && !n.time.includes('u geleden')).map(notification => (
                  <NotificationCard
                    key={notification.id}
                    data={notification}
                    onClick={() => onMarkAsRead(notification.id)}
                  />
                ))}
                {/* Include 'Zonet' and recent hours here too */}
                {filteredData.filter(n => n.time === 'Zonet' || n.time.includes('u geleden')).map(notification => (
                  <NotificationCard
                    key={notification.id}
                    data={notification}
                    onClick={() => onMarkAsRead(notification.id)}
                  />
                ))}

                {filteredData.filter(n => !n.time.includes('Gisteren')).length === 0 && (
                  <p className="text-gray-500 text-sm px-2 italic">Geen meldingen vandaag.</p>
                )}
              </div>
            </div>

            {/* Yesterday/Older Section */}
            <div>
              <h2 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-3 px-2">Gisteren</h2>
              <div className="space-y-3">
                {filteredData.filter(n => n.time.includes('Gisteren')).map(notification => (
                  <NotificationCard
                    key={notification.id}
                    data={notification}
                    onClick={() => onMarkAsRead(notification.id)}
                  />
                ))}
              </div>
            </div>
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
      onClick={onClick}
      className={`p-4 rounded-2xl border transition-all cursor-pointer active:scale-[0.99] ${data.isRead ? 'bg-white dark:bg-[#1e293b]/50 border-gray-100 dark:border-gray-800' : 'bg-white dark:bg-[#1e293b] border-blue-200 dark:border-blue-900/50 shadow-sm dark:shadow-md ring-1 ring-blue-50 dark:ring-blue-900/20'}`}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className="relative shrink-0">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${data.color}`}>
            <span className="material-icons-round text-2xl">{data.icon}</span>
          </div>
          {!data.isRead && (
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-blue-500 rounded-full border-2 border-white dark:border-[#1e293b] shadow-sm animate-pulse"></span>
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