import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAgenda } from '../contexts/AgendaContext';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { Event, CountdownItem } from '../types';
import { showToast } from '../components/Toast';

export const AgendaManageScreen: React.FC = () => {
  const navigate = useNavigate();
    const { availableRoles } = useAuth();
  const { handleAddNotification: onAddNotification, events, handleSaveEvent: onSaveEvent, handleDeleteEvent: onDeleteEvent, countdowns, handleSaveCountdowns: onSaveCountdowns } = useAgenda();

  // Countdown State (2 Slots fixed ID '1' and '2')
  const [cd1Active, setCd1Active] = useState(false);
  const [cd1Title, setCd1Title] = useState('');
  const [cd1Date, setCd1Date] = useState('');

  const [cd2Active, setCd2Active] = useState(false);
  const [cd2Title, setCd2Title] = useState('');
  const [cd2Date, setCd2Date] = useState('');

  // Helper to safely format date to YYYY-MM-DD local time without timezone shifts
  const toLocalISOString = (dateInput: Date | string) => {
    if (!dateInput) return '';
    const d = new Date(dateInput);
    if (isNaN(d.getTime())) return '';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Initialize state based on current active countdowns using specific IDs
  useEffect(() => {
    // Reset defaults first
    setCd1Active(false); setCd1Title(''); setCd1Date('');
    setCd2Active(false); setCd2Title(''); setCd2Date('');

    // Load ID '1'
    const c1 = countdowns.find(c => c.id === '1');
    if (c1) {
      setCd1Active(true);
      setCd1Title(c1.title);
      setCd1Date(toLocalISOString(c1.targetDate));
    }

    // Load ID '2'
    const c2 = countdowns.find(c => c.id === '2');
    if (c2) {
      setCd2Active(true);
      setCd2Title(c2.title);
      setCd2Date(toLocalISOString(c2.targetDate));
    }
  }, [countdowns]);

  // Event Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [dateStr, setDateStr] = useState('');
  const [timeStr, setTimeStr] = useState('');
  const [location, setLocation] = useState('De Sjelter');
  const [description, setDescription] = useState('');
  const [selectedRole, setSelectedRole] = useState('');

  // Handle Edit Click - Populate form
  const handleEditClick = (event: Event) => {
    setEditingId(event.id);
    setTitle(event.title);
    setLocation(event.location);
    setTimeStr(event.startTime);
    setDescription(event.description || '');

    // Format Date object to YYYY-MM-DD for input using local time
    setDateStr(toLocalISOString(event.date));

    // Scroll to form
    const formElement = document.getElementById('event-form');
    if (formElement) formElement.scrollIntoView({ behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    resetForm();
  };

  const resetForm = () => {
    setTitle('');
    setDateStr('');
    setTimeStr('');
    setLocation('De Sjelter');
    setDescription('');
    setSelectedRole('');
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Ben je zeker dat je dit evenement wilt verwijderen?')) {
      onDeleteEvent(id);
    }
  };

  const handleSave = () => {
    if (!title || !dateStr) return;

    // Parse the date input properly
    const [year, month, day] = dateStr.split('-').map(Number);
    // Create Date object (Month is 0-indexed)
    const eventDate = new Date(year, month - 1, day);
    if (timeStr) {
      const [hours, minutes] = timeStr.split(':').map(Number);
      eventDate.setHours(hours, minutes);
    }

    const eventPayload: Event = {
      id: editingId || '', // Empty string triggers INSERT in service
      title,
      date: eventDate,
      location: location || 'TBD',
      startTime: timeStr || '00:00',
      description,
      type: 'event', // You could add a type selector
      responsible: selectedRole
    };

    onSaveEvent(eventPayload);

    if (editingId) {
      // Trigger Notification for UPDATE
      onAddNotification({
        type: 'agenda',
        sender: 'Agenda Update',
        role: 'AGENDA',
        title: 'Event Bijgewerkt',
        content: `Het event '${title}' is bijgewerkt met nieuwe informatie.`,
        time: 'Zonet',
        isRead: false,
        action: 'Bekijken',
        icon: 'edit_calendar',
        color: 'bg-blue-100 dark:bg-blue-600/20 text-blue-600 dark:text-blue-500'
      });
      setEditingId(null);
    } else {
      // Trigger Notification for NEW
      onAddNotification({
        type: 'agenda',
        sender: 'Nieuw Event',
        role: 'AGENDA',
        title: title,
        content: description || 'Er is een nieuw evenement toegevoegd aan de agenda.',
        time: 'Zonet',
        isRead: false,
        action: 'Bekijken',
        icon: 'event',
        color: 'bg-green-100 dark:bg-green-600/20 text-green-600 dark:text-green-500'
      });
    }

    resetForm();
  };

  const handleSaveCountdown = () => {
    const newCountdowns: CountdownItem[] = [];

    // Parse Date safely from input string YYYY-MM-DD to Local Date
    const parseDate = (dStr: string) => {
      if (!dStr) return new Date();
      const [y, m, d] = dStr.split('-').map(Number);
      return new Date(y, m - 1, d);
    };

    if (cd1Active && cd1Title && cd1Date) {
      newCountdowns.push({
        id: '1',
        title: cd1Title,
        targetDate: parseDate(cd1Date)
      });
    }

    if (cd2Active && cd2Title && cd2Date) {
      newCountdowns.push({
        id: '2',
        title: cd2Title,
        targetDate: parseDate(cd2Date)
      });
    }

    onSaveCountdowns(newCountdowns);

    // Provide visual feedback and go back
    showToast('Aftelklokken bijgewerkt!', 'success');
    navigate(-1);
  };

  // Sort events by date for display
  const sortedEvents = [...events].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 flex items-center gap-4 bg-gray-50/90 dark:bg-gray-900/90 backdrop-blur-sm z-10 transition-colors sticky top-0 border-b border-gray-100 dark:border-gray-800">
        <ChevronBack onClick={() => navigate(-1)} />
        <h1 className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">Agenda & Aftelklok</h1>
      </header>

      <main className="flex-1 px-4 space-y-8 overflow-y-auto pb-32">

        {/* Upcoming List */}
        <section>
          <div className="flex justify-between items-end mb-4 px-1">
            <h2 className="text-sm font-bold text-blue-600 dark:text-blue-500 uppercase tracking-wide flex items-center gap-2">
              <span className="material-icons-round text-base">event_note</span>
              Komende Evenementen
            </h2>
            <span className="text-xs text-gray-500">Team Sfeerbeheer</span>
          </div>

          <div className="space-y-3">
            {sortedEvents.length === 0 ? (
              <div className="text-center py-8 bg-white dark:bg-gray-800 rounded-xl border border-dashed border-gray-200 dark:border-gray-700">
                <p className="text-gray-400 text-sm">Nog geen evenementen gepland.</p>
              </div>
            ) : (
              sortedEvents.map((event) => {
                const d = new Date(event.date);
                const day = d.getDate();
                const month = d.toLocaleString('default', { month: 'short' }).toUpperCase().replace('.', '');

                return (
                  <div key={event.id} className={`bg-white dark:bg-gray-800/50 rounded-xl p-3 border flex items-center justify-between shadow-sm transition-all ${editingId === event.id ? 'border-blue-500 ring-1 ring-blue-500 bg-blue-50/50 dark:bg-blue-900/10' : 'border-gray-200 dark:border-gray-700/50'}`}>
                    <div className="flex items-center gap-4">
                      <div className="bg-blue-50 dark:bg-[#1e293b] rounded-lg h-12 w-12 flex flex-col items-center justify-center shrink-0 border border-blue-100 dark:border-blue-900/30">
                        <span className="text-[10px] font-bold uppercase text-blue-600 dark:text-blue-400 leading-none mb-0.5">{month}</span>
                        <span className="text-lg font-bold text-gray-900 dark:text-blue-100 leading-none">{day}</span>
                      </div>
                      <div>
                        <h3 className="font-semibold text-gray-900 dark:text-white text-base line-clamp-1">{event.title}</h3>
                        <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 text-xs mt-0.5">
                          <span className="flex items-center gap-1">
                            <span className="material-icons-round text-[10px]">schedule</span> {event.startTime}
                          </span>
                          <span className="w-1 h-1 rounded-full bg-gray-400 dark:bg-gray-600"></span>
                          <span className="truncate max-w-[100px]">{event.location}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 shrink-0">
                      <button
                        onClick={() => handleEditClick(event)}
                        className="h-9 w-9 rounded-full bg-gray-100 dark:bg-gray-700/50 hover:bg-blue-100 dark:hover:bg-blue-900/40 flex items-center justify-center text-gray-500 dark:text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      >
                        <span className="material-icons-round text-lg">edit</span>
                      </button>
                      <button
                        onClick={() => handleDelete(event.id)}
                        className="h-9 w-9 rounded-full bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 flex items-center justify-center text-red-500 dark:text-red-400 transition-colors"
                      >
                        <span className="material-icons-round text-lg">delete</span>
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* Add / Edit Form */}
        <section id="event-form">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <div className={`w-1 h-6 rounded-full ${editingId ? 'bg-orange-500' : 'bg-blue-600 dark:bg-blue-500'}`}></div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                {editingId ? 'Event Bewerken' : 'Nieuw Event Toevoegen'}
              </h2>
            </div>
            {editingId && (
              <button
                onClick={handleCancelEdit}
                className="text-xs font-bold text-red-500 hover:underline px-2 py-1"
              >
                Annuleren
              </button>
            )}
          </div>

          <div className="space-y-4">
            {/* Title */}
            <div>
              <input
                type="text"
                placeholder="Titel van activiteit"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all shadow-sm"
              />
            </div>

            {/* Date & Time Row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="relative">
                <input
                  type="date"
                  value={dateStr}
                  onChange={(e) => setDateStr(e.target.value)}
                  className="w-full bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm"
                />
              </div>
              <div className="relative">
                <input
                  type="time"
                  value={timeStr}
                  onChange={(e) => setTimeStr(e.target.value)}
                  className="w-full bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm"
                />
              </div>
            </div>

            {/* Location */}
            <div className="relative">
              <input
                type="text"
                placeholder="Locatie"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                onFocus={(e) => e.target.select()}
                className="w-full bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm"
              />
              <span className="material-icons-round absolute right-3 top-3.5 text-gray-400 text-lg">place</span>
            </div>

            {/* Description (New) */}
            <div>
              <textarea
                rows={3}
                placeholder="Omschrijving, link of korte boodschap (Optioneel)"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 shadow-sm resize-none"
              />
            </div>

            {/* Organizer Role Select */}
            <div className="relative">
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="w-full bg-white dark:bg-[#1f2937] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 appearance-none shadow-sm"
              >
                <option value="" disabled>Organisator</option>
                {availableRoles.map(role => (
                  <option key={role.id} value={role.label}>
                    {role.label}
                  </option>
                ))}
              </select>
              <span className="material-icons-round absolute right-3 top-3.5 text-gray-400 text-lg pointer-events-none">expand_more</span>
            </div>

            {/* Submit Button */}
            <button
              onClick={handleSave}
              className={`w-full text-white font-bold py-4 rounded-xl shadow-lg flex items-center justify-center gap-2 mt-2 transition-all active:scale-[0.98] ${editingId
                ? 'bg-orange-600 hover:bg-orange-500 shadow-orange-500/20'
                : 'bg-blue-600 hover:bg-blue-500 shadow-blue-500/20'
                }`}
            >
              <span className="material-icons-round text-xl">{editingId ? 'edit' : 'save'}</span>
              {editingId ? 'Wijzigingen Opslaan' : 'Opslaan'}
            </button>
          </div>
        </section>

        <hr className="border-gray-200 dark:border-gray-800" />

        {/* COUNTDOWN CONFIGURATION - Refined Layout */}
        <section className="bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-900/20 dark:to-blue-900/10 border border-indigo-100 dark:border-indigo-900/30 p-6 rounded-2xl shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 bg-indigo-100 dark:bg-indigo-900/40 rounded-xl text-indigo-600 dark:text-indigo-400">
              <span className="material-icons-round text-xl">timer</span>
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">Aftelklokken</h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">Beheer de klokken op het startscherm</p>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {/* Countdown 1 */}
            <div className={`bg-white dark:bg-[#1f2937] p-5 rounded-xl border transition-all ${cd1Active ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm' : 'border-gray-200 dark:border-gray-700 opacity-90'}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-xs uppercase text-gray-400 tracking-wider">Klok 1</span>
                <div
                  onClick={() => setCd1Active(!cd1Active)}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${cd1Active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${cd1Active ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </div>

              <div className={`space-y-4 transition-all ${cd1Active ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Naam Event</label>
                  <input
                    type="text"
                    placeholder="bv. Groot Kamp"
                    value={cd1Title}
                    onChange={(e) => setCd1Title(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Datum</label>
                  <input
                    type="date"
                    value={cd1Date}
                    onChange={(e) => setCd1Date(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>

            {/* Countdown 2 */}
            <div className={`bg-white dark:bg-[#1f2937] p-5 rounded-xl border transition-all ${cd2Active ? 'border-indigo-500 ring-1 ring-indigo-500/20 shadow-sm' : 'border-gray-200 dark:border-gray-700 opacity-90'}`}>
              <div className="flex items-center justify-between mb-4">
                <span className="font-bold text-xs uppercase text-gray-400 tracking-wider">Klok 2</span>
                <div
                  onClick={() => setCd2Active(!cd2Active)}
                  className={`w-11 h-6 rounded-full relative cursor-pointer transition-colors ${cd2Active ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}
                >
                  <div className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform ${cd2Active ? 'translate-x-5' : 'translate-x-0'}`}></div>
                </div>
              </div>

              <div className={`space-y-4 transition-all ${cd2Active ? 'opacity-100' : 'opacity-40 pointer-events-none grayscale'}`}>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Naam Event</label>
                  <input
                    type="text"
                    placeholder="bv. Klein Kamp"
                    value={cd2Title}
                    onChange={(e) => setCd2Title(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase block mb-1.5">Datum</label>
                  <input
                    type="date"
                    value={cd2Date}
                    onChange={(e) => setCd2Date(e.target.value)}
                    className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 focus:border-indigo-500 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="md:col-span-2 mt-2">
              <button
                onClick={handleSaveCountdown}
                className="w-full bg-green-600 hover:bg-green-500 text-white font-bold py-4 rounded-xl shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 group"
              >
                <span className="material-icons-round group-hover:scale-110 transition-transform">check_circle</span>
                Instellingen Opslaan
              </button>
              <p className="text-center text-[10px] text-gray-400 mt-2">
                Wijzigingen zijn direct zichtbaar op het startscherm.
              </p>
            </div>
          </div>
        </section>

      </main>
    </div>
  );
};