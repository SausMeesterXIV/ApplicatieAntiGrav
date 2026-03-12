import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAgenda } from '../contexts/AgendaContext';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { SkeletonEvent } from '../components/Skeleton';

export const AgendaScreen: React.FC = () => {
  const navigate = useNavigate();
    const { loading } = useAuth();
  const { notifications, handleMarkNotificationAsRead, events } = useAgenda();

  const [currentDate, setCurrentDate] = useState(new Date());
  const [showNewEvents, setShowNewEvents] = useState(false);

  // Filter for Agenda notifications
  const newEvents = notifications.filter(n => n.type === 'agenda' && !n.isRead);

  // Calendar Logic
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = ["Januari", "Februari", "Maart", "April", "Mei", "Juni", "Juli", "Augustus", "September", "Oktober", "November", "December"];
  const dayNames = ['Ma', 'Di', 'Wo', 'Do', 'Vr', 'Za', 'Zo'];

  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => {
    const day = new Date(year, month, 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust to make Monday 0
  };

  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);

  const calendarDays = [];
  // Empty slots for start of month
  for (let i = 0; i < firstDay; i++) {
    calendarDays.push(null);
  }
  // Actual days
  for (let i = 1; i <= daysInMonth; i++) {
    calendarDays.push(i);
  }

  const changeMonth = (delta: number) => {
    const newDate = new Date(currentDate.setMonth(currentDate.getMonth() + delta));
    setCurrentDate(new Date(newDate));
  };

  const isToday = (day: number) => {
    const today = new Date();
    return day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  };

  const hasEvent = (day: number) => {
    return events.some(e => {
      const d = new Date(e.date);
      return d.getDate() === day && d.getMonth() === month && d.getFullYear() === year;
    });
  };

  const handleNewEventClick = (id: string) => {
    handleMarkNotificationAsRead(id);
  };

  // Filter events for current month display (calendar)
  const eventsThisMonth = events.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === month && d.getFullYear() === year;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // All upcoming events from today onwards (across all months)
  const allUpcomingEvents = events.filter(e => {
    const d = new Date(e.date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return d >= today;
  }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 flex items-center justify-between shrink-0 bg-gray-50 dark:bg-[#0f172a] z-10 transition-colors relative">
        <div className="flex items-center gap-2">
          <ChevronBack onClick={() => navigate(-1)} />
          <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-white">Agenda</h1>
        </div>

        {/* Nieuwe Events Button */}
        <div className="relative">
          <button
            onClick={() => setShowNewEvents(!showNewEvents)}
            className={`flex items-center gap-2 px-3 py-2 rounded-full border transition-all shadow-sm ${showNewEvents
              ? 'bg-blue-100 dark:bg-blue-900/30 border-blue-200 dark:border-blue-800 text-blue-700 dark:text-blue-300'
              : 'bg-white dark:bg-[#1e2330] border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
          >
            <div className="relative">
              <span className="material-icons-round text-xl">event_available</span>
              {newEvents.length > 0 && (
                <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-blue-600 rounded-full border-2 border-white dark:border-[#1e2330]"></span>
              )}
            </div>
            <span className="text-xs font-bold uppercase tracking-wide hidden sm:block">Nieuwe Events</span>
          </button>

          {/* Dropdown / Popover */}
          {showNewEvents && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowNewEvents(false)}></div>
              <div className="absolute top-full right-0 mt-2 w-72 bg-white dark:bg-[#1e2330] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-700 z-20 overflow-hidden animate-in slide-in-from-top-2 fade-in duration-200">
                <div className="p-3 border-b border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-[#0f172a]/50 flex justify-between items-center">
                  <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Ongelezen Events</span>
                  <span className="bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-1.5 py-0.5 rounded-md">{newEvents.length}</span>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {newEvents.length === 0 ? (
                    <div className="p-6 text-center text-gray-400 text-sm italic">
                      Geen nieuwe updates.
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-100 dark:divide-gray-800">
                      {newEvents.map(event => (
                        <div
                          key={event.id}
                          onClick={() => handleNewEventClick(event.id)}
                          className="p-3 hover:bg-blue-50 dark:hover:bg-blue-900/10 cursor-pointer transition-colors flex gap-3 items-start"
                        >
                          <div className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0"></div>
                          <div>
                            <h4 className="text-sm font-bold text-gray-900 dark:text-white leading-tight mb-0.5">{event.title || 'Nieuw Event'}</h4>
                            <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2">{event.content}</p>
                            <span className="text-[10px] text-gray-400 mt-1 block">{event.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </header>

      {/* Calendar Grid */}
      <div className="px-4 pb-4 shrink-0">
        <div className="bg-white dark:bg-[#1e2330] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-4 transition-colors">
          <div className="flex items-center justify-between mb-4">
            <button onClick={() => changeMonth(-1)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              <span className="material-icons-round text-xl">chevron_left</span>
            </button>
            <span className="text-lg font-semibold text-gray-900 dark:text-white capitalize">{monthNames[month]} {year}</span>
            <button onClick={() => changeMonth(1)} className="p-1 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500">
              <span className="material-icons-round text-xl">chevron_right</span>
            </button>
          </div>

          <div className="grid grid-cols-7 text-center mb-2">
            {dayNames.map(d => (
              <div key={d} className="text-xs font-medium text-gray-400 uppercase">{d}</div>
            ))}
          </div>

          <div className="grid grid-cols-7 text-center gap-y-1">
            {calendarDays.map((day, index) => {
              if (day === null) return <div key={`empty-${index}`}></div>;

              const isCurrentDay = isToday(day);
              const isEventDay = hasEvent(day);

              return (
                <button
                  key={day}
                  className={`h-9 w-9 mx-auto flex flex-col items-center justify-center rounded-lg transition-colors relative text-sm
                    ${isCurrentDay
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30 font-bold'
                      : isEventDay
                        ? 'text-blue-600 dark:text-blue-400 font-bold ring-2 ring-blue-500 dark:ring-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20'
                        : 'text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-100 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  {day}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="px-6 pb-2 shrink-0 overflow-x-auto no-scrollbar">
        <div className="flex gap-3">
          <button className="px-4 py-1.5 rounded-full bg-blue-600 text-white text-sm font-medium shadow-sm whitespace-nowrap">Alle events</button>
          <button className="px-4 py-1.5 rounded-full bg-white dark:bg-[#1e2330] border border-gray-100 dark:border-gray-800 text-gray-600 dark:text-gray-300 text-sm font-medium whitespace-nowrap">Mijn taken</button>
        </div>
      </div>

      {/* Event List */}
      <div className="px-4 pb-nav-safe pt-2 space-y-4">
        {loading ? (
          <div className="space-y-4">
            <SkeletonEvent />
            <SkeletonEvent />
            <SkeletonEvent />
          </div>
        ) : allUpcomingEvents.length > 0 ? (
          allUpcomingEvents.map(event => {
            const d = new Date(event.date);
            const dateStr = d.toLocaleDateString('nl-BE', { weekday: 'long', day: 'numeric', month: 'short' });

            return (
              <div key={event.id}>
                <h3 className="px-2 text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">{dateStr}</h3>
                <div className="bg-white dark:bg-[#1e2330] rounded-xl p-4 shadow-sm border border-gray-100 dark:border-gray-800 flex flex-col gap-3 relative overflow-hidden group transition-colors">
                  <div className={`absolute top-0 left-0 w-1 h-full ${event.type === 'vergadering' ? 'bg-gray-300 dark:bg-gray-600' : 'bg-blue-600'}`}></div>
                  <div className="flex justify-between items-start">
                    <div>
                      <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold mb-1 uppercase tracking-wide ${event.type === 'vergadering' ? 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300' : 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400'}`}>
                        {event.type || 'Event'}
                      </span>
                      <h4 className="text-lg font-bold text-gray-900 dark:text-white leading-tight">{event.title}</h4>
                      {event.description && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{event.description}</p>}
                    </div>
                    <div className="text-right">
                      <span className={`block text-xl font-semibold ${event.type === 'vergadering' ? 'text-gray-900 dark:text-white' : 'text-blue-600 dark:text-blue-400'}`}>{event.startTime}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm text-gray-600 dark:text-gray-300">
                    <span className="material-icons-round text-gray-400 text-base">location_on</span>
                    <span>{event.location}</span>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-10 text-gray-400">
            <span className="material-icons-round text-4xl mb-2 opacity-50">event_busy</span>
            <p>Geen komende evenementen.</p>
          </div>
        )}
      </div>
    </div>
  );
};