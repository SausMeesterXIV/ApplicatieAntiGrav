import React, { useState, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { QuoteItem, User } from '../types';
import { AppContextType } from '../App';

interface QuotesScreenProps {
  enableManagement?: boolean; // New prop to toggle delete functionality
}

export const QuotesScreen: React.FC<QuotesScreenProps> = ({
  enableManagement = false,
}) => {
  const navigate = useNavigate();
  const {
    quotes,
    handleVoteQuote: onVote,
    handleAddQuote: onAddQuote,
    handleDeleteQuote: onDeleteQuote,
    currentUser,
    users
  } = useOutletContext<AppContextType>();
  const [isAdding, setIsAdding] = useState(false);
  const [newQuoteText, setNewQuoteText] = useState('');

  // Ref for the quote textarea to auto-focus
  const quoteInputRef = useRef<HTMLTextAreaElement>(null);

  // New: Search-based selection state
  const [authorSearch, setAuthorSearch] = useState('');
  const [selectedAuthor, setSelectedAuthor] = useState<{ id: string, name: string } | null>(null);

  // Filter users for search
  const filteredAuthors = (users || []).filter(u =>
    (u?.nickname || u?.name || u?.naam || '').toLowerCase().includes(authorSearch.toLowerCase())
  );

  // View State: 'current' (Recent) or 'archive' (Top Quotes > 4 weeks)
  const [viewMode, setViewMode] = useState<'current' | 'archive'>('current');

  // Logic: User must have role AND management must be enabled via navigation source
  const canDelete = enableManagement && ((currentUser?.roles || []).includes('Sfeerbeheer') || currentUser?.rol === 'admin');

  const handleAdd = () => {
    if (!newQuoteText || !selectedAuthor) return;
    // Pass empty string for context since it's removed from UI
    onAddQuote(newQuoteText, "", selectedAuthor.id);

    setIsAdding(false);
    setNewQuoteText('');
    setAuthorSearch('');
    setSelectedAuthor(null);
  };

  const handleDelete = (id: string) => {
    if (window.confirm('Ben je zeker dat je dit citaat wilt verwijderen?')) {
      onDeleteQuote?.(id);
    }
  };

  const handleSelectAuthor = (u: User) => {
    setSelectedAuthor({ id: u.id, name: u.nickname || u.naam });
    setAuthorSearch('');

    // Auto-focus the textarea immediately after selection for smooth UX
    // Increased timeout to ensure DOM update is complete and mobile keyboard responds
    setTimeout(() => {
      if (quoteInputRef.current) {
        quoteInputRef.current.focus();
      }
    }, 150);
  };

  // Filter Logic
  const today = new Date();
  const fourWeeksAgo = new Date();
  fourWeeksAgo.setDate(today.getDate() - 28);

  const sixMonthsAgo = new Date();
  sixMonthsAgo.setMonth(today.getMonth() - 6);

  // 1. Current List: Newer than 4 weeks
  const currentQuotes = (quotes || []).filter(q => q && q.date && new Date(q.date) >= fourWeeksAgo);

  // 2. Archive List: Older than 4 weeks AND Newer than 6 months AND "Top Quote"
  const archiveQuotes = quotes.filter(q => {
    const qDate = new Date(q.date);
    const netScore = (q.likes?.length || 0) - (q.dislikes?.length || 0);
    // Archive shows older quotes with a positive score
    return qDate < fourWeeksAgo && qDate >= sixMonthsAgo && netScore > 0;
  });

  let displayedQuotes: QuoteItem[] = [];

  if (viewMode === 'current') {
    if (currentQuotes.length > 0) {
      // 1. Identify Top Quote (Highest Net Score)
      // Sort by Score DESC. Tie-breaker: Date DESC (Newest wins tie)
      const sortedByScore = [...currentQuotes].sort((a, b) => {
        const scoreA = (a.likes?.length || 0) - (a.dislikes?.length || 0);
        const scoreB = (b.likes?.length || 0) - (b.dislikes?.length || 0);
        if (scoreA !== scoreB) return scoreB - scoreA;
        return new Date(b.date).getTime() - new Date(a.date).getTime();
      });

      const topQuote = sortedByScore[0];

      // 2. The rest are strictly sorted by Date DESC (Newest first) for maximum traction
      const rest = currentQuotes
        .filter(q => q.id !== topQuote.id)
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      // 3. Combine: Winner first, then chronological list
      displayedQuotes = [topQuote, ...rest];
    }
  } else {
    // Archive View: Sort by Net Score (Best of All Time)
    displayedQuotes = archiveQuotes.sort((a, b) =>
      ((b.likes?.length || 0) - (b.dislikes?.length || 0)) -
      ((a.likes?.length || 0) - (a.dislikes?.length || 0))
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 flex flex-col gap-4 sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-40 transition-colors border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center gap-4">
          <ChevronBack onClick={() => navigate(-1)} />
          <div>
            <h1 className="text-xl font-bold leading-tight">Quoteboek</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {canDelete ? 'Beheermodus' : 'Stem op de Quote van de Week!'}
            </p>
          </div>
        </div>

        {/* Toggle / Filter */}
        <div className="flex bg-white dark:bg-[#1e293b] p-1 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setViewMode('current')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${viewMode === 'current' ? 'bg-pink-100 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            Actueel
          </button>
          <button
            onClick={() => setViewMode('archive')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${viewMode === 'archive' ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 shadow-sm' : 'text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
          >
            <span className="material-icons-round text-sm">emoji_events</span>
            Hall of Fame
          </button>
        </div>
      </header>

      <main className="flex-1 px-4 py-6 overflow-y-auto pb-24 space-y-4">

        {displayedQuotes.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-400">
            <span className="material-icons-round text-5xl mb-3 opacity-20">format_quote</span>
            <p>Geen citaten gevonden in deze lijst.</p>
          </div>
        ) : (
          displayedQuotes.map((quote, index) => {
            const author = users.find(u => u.id === quote.authorId);
            const netScore = (quote.likes?.length || 0) - (quote.dislikes?.length || 0);

            // #1 Winner Styling (Only for current view)
            const isWinner = viewMode === 'current' && index === 0 && netScore > 0;
            // Top Archive Styling
            const isLegend = viewMode === 'archive' && index < 3;

            // Current User Vote State
            const hasLiked = (quote.likes || []).includes(currentUser.id);
            const hasDisliked = (quote.dislikes || []).includes(currentUser.id);

            return (
              <div key={quote.id} className={`bg-white dark:bg-[#1e293b] rounded-2xl p-5 shadow-sm border relative transition-all 
                    ${isWinner ? 'border-yellow-400 ring-2 ring-yellow-400/20 shadow-yellow-200/50' :
                  isLegend ? 'border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10' :
                    'border-gray-200 dark:border-gray-800'}`}>

                {isWinner && (
                  <div className="absolute -top-3 right-4 bg-yellow-400 text-white text-[10px] font-bold px-2 py-1 rounded-full shadow-sm flex items-center gap-1 z-10">
                    <span className="material-icons-round text-sm">emoji_events</span> #1
                  </div>
                )}

                {/* Admin Delete Button (Conditionally Rendered) */}
                {canDelete && (
                  <button
                    onClick={(e) => { e.stopPropagation(); handleDelete(quote.id); }}
                    className="absolute top-2 right-2 p-1.5 rounded-full bg-gray-50 dark:bg-gray-700/50 text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors z-10"
                  >
                    <span className="material-icons-round text-lg">delete_outline</span>
                  </button>
                )}

                <span className="absolute top-4 left-4 text-6xl font-serif text-gray-100 dark:text-gray-700 leading-none select-none">“</span>

                <div className="relative z-10 pt-2">
                  <p className="text-lg font-medium text-gray-800 dark:text-white italic mb-4 leading-relaxed">
                    {quote.text}
                  </p>

                  <div className="flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-4">
                    <div className="flex items-center gap-3">
                      <img
                        src={author?.avatar || 'https://i.pravatar.cc/150'}
                        alt="Author"
                        className="w-10 h-10 rounded-full object-cover border border-gray-200 dark:border-gray-700"
                      />
                      <div>
                        {/* Use Nickname if available */}
                        <p className="text-sm font-bold text-gray-900 dark:text-white">{author?.nickname || author?.naam || quote.authorName}</p>
                      </div>
                    </div>

                    {/* Voting Controls */}
                    {viewMode === 'current' ? (
                      <div className="flex items-center bg-gray-100 dark:bg-gray-800 rounded-lg p-1">
                        {/* Like Button */}
                        <button
                          onClick={() => onVote(quote.id, 'like')}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-md transition-all active:scale-95 ${hasLiked
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 shadow-sm'
                            : 'hover:bg-white dark:hover:bg-gray-700 text-gray-500 hover:text-green-600'
                            }`}
                        >
                          <span className="material-icons-round text-base">thumb_up</span>
                          <span className="text-xs font-bold">{quote.likes?.length || 0}</span>
                        </button>

                        <div className="w-px h-4 bg-gray-300 dark:bg-gray-600 mx-1"></div>

                        {/* Dislike Button */}
                        <button
                          onClick={() => onVote(quote.id, 'dislike')}
                          className={`flex items-center gap-1 px-2 py-1.5 rounded-md transition-all active:scale-95 ${hasDisliked
                            ? 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 shadow-sm'
                            : 'hover:bg-white dark:hover:bg-gray-700 text-gray-500 hover:text-red-500'
                            }`}
                        >
                          <span className="text-xs font-bold">{quote.dislikes?.length || 0}</span>
                          <span className="material-icons-round text-base">thumb_down</span>
                        </button>
                      </div>
                    ) : (
                      // Archive View: Static Score
                      <div className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">
                        <span className="material-icons-round text-sm">star</span>
                        <span className="text-xs font-bold">{netScore} ptn</span>
                      </div>
                    )}
                  </div>
                  {/* Display Date here clearly */}
                  <p className="text-[10px] text-gray-400 mt-2 text-right font-medium">
                    {new Date(quote.date).toLocaleDateString('nl-BE')}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </main>

      {/* FAB to Add Quote (Only in Current View) */}
      {viewMode === 'current' && (
        <button
          onClick={() => setIsAdding(true)}
          className="fixed bottom-32 right-6 w-14 h-14 bg-pink-600 text-white rounded-full shadow-lg flex items-center justify-center hover:scale-105 active:scale-95 transition-all z-20"
        >
          <span className="material-icons-round text-3xl">add</span>
        </button>
      )}

      {/* Add Modal - Now with Header/Body/Footer structure */}
      {isAdding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm pointer-events-auto" onClick={() => setIsAdding(false)}></div>

          {/* Modal Card - Flex Column */}
          <div className="bg-white dark:bg-[#1e293b] w-full max-w-lg rounded-3xl pointer-events-auto animate-in fade-in zoom-in-95 duration-200 shadow-2xl flex flex-col max-h-[85vh] relative z-10">

            {/* Header */}
            <div className="p-6 pb-2 shrink-0">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Nieuwe Quote Toevoegen</h2>
            </div>

            {/* Scrollable Body */}
            <div className="px-6 py-2 overflow-y-auto flex-1 custom-scrollbar space-y-4">
              <div>
                <div className="flex justify-between items-baseline mb-1">
                  <label className="text-xs font-bold text-gray-500 uppercase block">
                    Wie zei het?
                    {selectedAuthor && (
                      <span className="text-pink-600 dark:text-pink-400 text-sm font-bold ml-2">
                        {selectedAuthor.name}
                      </span>
                    )}
                  </label>
                  {selectedAuthor && (
                    <button
                      onClick={() => setSelectedAuthor(null)}
                      className="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
                    >
                      Wijzig
                    </button>
                  )}
                </div>

                {/* Search / Select Author Input - Only show if NO author selected */}
                {!selectedAuthor && (
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Zoek leiding (bijv. Tibo)..."
                      value={authorSearch}
                      onChange={(e) => setAuthorSearch(e.target.value)}
                      className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 pl-10 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500"
                      autoFocus
                    />
                    <span className="material-icons-round absolute left-3 top-3 text-gray-400">search</span>

                    {/* Results - Now in-flow (relative) to avoid clipping and expand the form */}
                    {authorSearch && (
                      <div className="mt-2 bg-white dark:bg-[#1e293b] border border-gray-200 dark:border-gray-700 rounded-xl shadow-inner max-h-48 overflow-y-auto">
                        {filteredAuthors.length > 0 ? (
                          filteredAuthors.map(u => (
                            <div
                              key={u.id}
                              onClick={() => handleSelectAuthor(u)}
                              className="p-3 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer flex items-center gap-3 border-b last:border-0 border-gray-100 dark:border-gray-800"
                            >
                              <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 overflow-hidden shrink-0">
                                <img src={u.avatar} alt={u.naam} className="w-full h-full object-cover" />
                              </div>
                              <div>
                                <span className="font-bold text-sm block text-gray-900 dark:text-white">{u.nickname || u.naam}</span>
                                {u.nickname && <span className="text-[10px] text-gray-500 block">{u.naam}</span>}
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-4 text-sm text-gray-500 text-center">Geen resultaten gevonden</div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 uppercase block mb-1">De Quote</label>
                <textarea
                  ref={quoteInputRef}
                  value={newQuoteText}
                  onChange={(e) => setNewQuoteText(e.target.value)}
                  placeholder='"..."'
                  rows={3}
                  className="w-full bg-gray-50 dark:bg-[#0f172a] border border-gray-200 dark:border-gray-700 rounded-xl px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-pink-500 resize-none"
                />
              </div>
            </div>

            {/* Footer - Fixed at bottom of card */}
            <div className="p-6 pt-2 shrink-0">
              <button
                onClick={handleAdd}
                disabled={!newQuoteText || !selectedAuthor}
                className="w-full bg-pink-600 disabled:bg-gray-300 dark:disabled:bg-gray-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-pink-500/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2"
              >
                <span className="material-icons-round">send</span>
                Quote
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};