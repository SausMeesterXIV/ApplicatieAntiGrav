import React, { useState, useMemo, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useAgenda } from '../contexts/AgendaContext';
import { useNavigate } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { hapticSuccess } from '../lib/haptics';
import { SkeletonRow, SkeletonAvatar, SkeletonText } from '../components/Skeleton';
import { BottomSheet } from '../components/Modal';

interface BierpongLeaderboardEntry {
  userId: string;
  gamesPlayed: number;
  wins: number;
  winRatio: number;
}

export const BierpongScreen: React.FC = () => {
  const navigate = useNavigate();
  const { users, currentUser, loading } = useAuth();
  const { bierpongGames, duoBierpongWinners, handleAddBierpongGame } = useAgenda();

  // Weergave states
  const [showAllLeaders, setShowAllLeaders] = useState(false);
  const [sortBy, setSortBy] = useState<'winRatio' | 'gamesPlayed' | 'wins'>('winRatio');
  const [useQuota, setUseQuota] = useState(true); // NIEUW: Minimum Quota State

  // Score modal state
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [scoreSaved, setScoreSaved] = useState(false);
  const [gameMode, setGameMode] = useState<'1v1' | '2v2'>('1v1');
  const [team1, setTeam1] = useState<string[]>([]);
  const [team2, setTeam2] = useState<string[]>([]);
  const [winningTeam, setWinningTeam] = useState<'team1' | 'team2' | null>(null);

  const leaderboard = useMemo(() => {
    const playerStats: { [key: string]: { gamesPlayed: number; wins: number } } = {};
    const getStats = (id: string) => {
      if (!playerStats[id]) playerStats[id] = { gamesPlayed: 0, wins: 0 };
      return playerStats[id];
    };

    const sortedGames = [...bierpongGames].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    sortedGames.forEach(game => {
      const is1v1 = game.playerIds.length === 2;
      const is2v2 = game.playerIds.length === 4;

      if (is1v1) {
        const p1Id = game.playerIds[0]; const p2Id = game.playerIds[1];
        getStats(p1Id).gamesPlayed++; getStats(p2Id).gamesPlayed++;
        if (game.winnerIds.includes(p1Id)) getStats(p1Id).wins++;
        if (game.winnerIds.includes(p2Id)) getStats(p2Id).wins++;
      } else if (is2v2) {
        game.playerIds.forEach((id: string) => {
          const stats = getStats(id);
          stats.gamesPlayed++;
          if (game.winnerIds.includes(id)) stats.wins++;
        });
      }
    });

    const calculatedLeaderboard: BierpongLeaderboardEntry[] = Object.keys(playerStats).map(userId => {
      const stats = playerStats[userId];
      const winRatio = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
      return { userId, gamesPlayed: stats.gamesPlayed, wins: stats.wins, winRatio };
    });

    // Basis sortering (standaard ongefilterd, nodig voor de rangorde berekening)
    calculatedLeaderboard.sort((a, b) => b.winRatio - a.winRatio || b.gamesPlayed - a.gamesPlayed);
    return calculatedLeaderboard;
  }, [bierpongGames]);

  // Originele rangschikking (voor gouden styling ongeacht actieve sortering)
  const originalRankMap = useMemo(() => {
    // We moeten de ranking bepalen mét het quota eroverheen, anders is een speler met 1 game en 100% win de "echte" nummer 1.
    const map: { [userId: string]: number } = {};
    if (leaderboard.length === 0) return map;
    
    const maxGames = Math.max(...leaderboard.map(l => l.gamesPlayed));
    const minGames = Math.ceil(maxGames / 2);
    const eligible = leaderboard.filter(e => e.gamesPlayed >= minGames);
    eligible.sort((a, b) => b.winRatio - a.winRatio || b.gamesPlayed - a.gamesPlayed);
    
    eligible.forEach((entry, i) => { map[entry.userId] = i; });
    return map;
  }, [leaderboard]);

  // Podium voor standaard overzicht (altijd mét quota)
  const podiumLeaders = useMemo(() => {
    if (leaderboard.length === 0) return [];
    const maxGames = Math.max(...leaderboard.map(l => l.gamesPlayed));
    const minGames = Math.ceil(maxGames / 2);
    const eligible = leaderboard.filter(e => e.gamesPlayed >= minGames);
    return [...eligible].sort((a, b) => b.winRatio - a.winRatio || b.gamesPlayed - a.gamesPlayed);
  }, [leaderboard]);

  // Actieve sortering & filtering voor 'Alle Scores'
  const leadersToDisplay = useMemo(() => {
    let list = [...leaderboard];
    
    // Pas het minimum quota toe indien ingeschakeld
    if (useQuota && list.length > 0) {
      const maxGames = Math.max(...list.map(l => l.gamesPlayed));
      const minGames = Math.ceil(maxGames / 2);
      list = list.filter(e => e.gamesPlayed >= minGames);
    }

    if (sortBy === 'winRatio') return list.sort((a, b) => b.winRatio - a.winRatio || b.gamesPlayed - a.gamesPlayed);
    if (sortBy === 'gamesPlayed') return list.sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.winRatio - a.winRatio);
    if (sortBy === 'wins') return list.sort((a, b) => b.wins - a.wins || b.gamesPlayed - a.gamesPlayed);
    return list;
  }, [leaderboard, sortBy, useQuota]);

  const getUser = (userId: string) => users.find((u: any) => u.id === userId);
  const getUserName = (userId: string) => {
    const u = getUser(userId);
    return u?.nickname || u?.name || u?.naam || 'Onbekend';
  };
  const getUserAvatar = (userId: string) => getUser(userId)?.avatar;
  const isDuoWinner = (userId: string) => duoBierpongWinners.includes(userId);

  const getMedalStyle = (index: number | undefined) => {
    if (index === 0) return { bg: 'bg-gradient-to-r from-yellow-400 to-amber-500', text: 'text-yellow-900', icon: '👑' };
    if (index === 1) return { bg: 'bg-gradient-to-r from-gray-300 to-slate-400', text: 'text-gray-800', icon: '🥈' };
    if (index === 2) return { bg: 'bg-gradient-to-r from-orange-400 to-amber-600', text: 'text-orange-900', icon: '🥉' };
    return null;
  };

  // ============================================================================
  // 1. NIEUWE WEERGAVE: VOLLEDIG LEADERBOARD (ALLE SCORES)
  // ============================================================================
  if (showAllLeaders) {
    return (
      <div className="flex flex-col h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white transition-colors duration-200">
        <header className="px-4 pb-3 pt-[calc(1rem+env(safe-area-inset-top,0px))] sticky top-0 bg-gray-50 dark:bg-[#0f172a] z-20 shadow-sm border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <button onClick={() => setShowAllLeaders(false)} className="p-2 -ml-2 rounded-full hover:bg-gray-200 dark:hover:bg-gray-800 text-gray-500 dark:text-gray-400 transition-colors">
                <span className="material-icons-round text-2xl">arrow_back</span>
              </button>
              <h1 className="text-xl font-extrabold tracking-tight">Volledig Leaderboard</h1>
            </div>
            
            {/* Quota Toggle */}
            <label className="flex items-center gap-2 cursor-pointer group active:scale-95 transition-transform" onClick={(e) => e.stopPropagation()}>
              <span className="text-[10px] font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mt-0.5 group-hover:text-gray-700 dark:group-hover:text-gray-200 transition-colors">
                Min. Quota
              </span>
              <div className={`w-9 h-5 rounded-full p-0.5 transition-colors ${useQuota ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'}`}>
                <div className={`bg-white w-4 h-4 rounded-full shadow-sm transform transition-transform ${useQuota ? 'translate-x-4' : 'translate-x-0'}`}></div>
              </div>
              <input type="checkbox" className="hidden" checked={useQuota} onChange={(e) => setUseQuota(e.target.checked)} />
            </label>
          </div>
          
          {/* Intuïtieve Sortering Tabs */}
          <div className="flex bg-gray-200 dark:bg-[#1e293b] p-1 rounded-xl shadow-inner">
            <button 
              onClick={() => setSortBy('winRatio')} 
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${sortBy === 'winRatio' ? 'bg-white dark:bg-gray-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              <span className="material-icons-round text-[16px]">show_chart</span>
              Win %
            </button>
            <button 
              onClick={() => setSortBy('gamesPlayed')} 
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${sortBy === 'gamesPlayed' ? 'bg-white dark:bg-gray-700 shadow-sm text-purple-600 dark:text-purple-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              <span className="material-icons-round text-[16px]">sports_esports</span>
              Gespeeld
            </button>
            <button 
              onClick={() => setSortBy('wins')} 
              className={`flex-1 py-2.5 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${sortBy === 'wins' ? 'bg-white dark:bg-gray-700 shadow-sm text-green-600 dark:text-green-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'}`}
            >
              <span className="material-icons-round text-[16px]">emoji_events</span>
              Wins
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-safe">
          {leadersToDisplay.map((leader, index) => {
            const originalRank = originalRankMap[leader.userId];
            const isGold = originalRank === 0;
            const isDuo = isDuoWinner(leader.userId);

            return (
              <div key={leader.userId} className={`flex items-center justify-between p-3.5 rounded-2xl transition-colors border ${isGold ? 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/10 dark:to-amber-900/10 border-yellow-300 dark:border-yellow-700/50 shadow-md' : 'bg-white dark:bg-[#1e293b] border-gray-100 dark:border-gray-800 shadow-sm'}`}>
                <div className="flex items-center gap-4 min-w-0">
                  
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${isGold ? 'bg-yellow-400 text-yellow-900 shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                    {isGold ? '👑' : index + 1}
                  </div>
                  
                  <div className={`w-12 h-12 rounded-full overflow-hidden shrink-0 relative ${isGold ? 'border-[3px] border-yellow-400 shadow-lg' : isDuo ? 'border-[3px] border-purple-500 shadow-md' : 'border border-gray-200 dark:border-gray-700'}`}>
                    {getUserAvatar(leader.userId) ? (
                      <img src={getUserAvatar(leader.userId)} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 font-bold text-sm">
                        {getUserName(leader.userId).charAt(0)}
                      </div>
                    )}
                  </div>

                  <div className="min-w-0">
                    <p className={`font-extrabold text-base truncate ${isGold ? 'text-yellow-700 dark:text-yellow-400' : isDuo ? 'text-purple-600 dark:text-purple-400' : 'text-gray-900 dark:text-white'}`}>
                      {isDuo && !isGold && '🏆 '}
                      {getUserName(leader.userId)}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 font-medium mt-0.5">
                      <span className="text-green-600 dark:text-green-500 font-bold">{leader.wins}W</span>
                      <span className="mx-1">-</span>
                      <span className="text-red-500 dark:text-red-400 font-bold">{leader.gamesPlayed - leader.wins}L</span>
                    </p>
                  </div>
                </div>

                <div className="text-right shrink-0 ml-4">
                  <div className={`text-xl font-black ${sortBy === 'winRatio' ? 'text-blue-600 dark:text-blue-400' : sortBy === 'gamesPlayed' ? 'text-purple-600 dark:text-purple-400' : 'text-green-600 dark:text-green-400'}`}>
                    {sortBy === 'winRatio' ? `${leader.winRatio}%` : sortBy === 'gamesPlayed' ? leader.gamesPlayed : leader.wins}
                  </div>
                  <div className="text-[10px] text-gray-400 uppercase tracking-wider font-bold">
                    {sortBy === 'winRatio' ? 'Win %' : sortBy === 'gamesPlayed' ? 'Gespeeld' : 'Gewonnen'}
                  </div>
                </div>
              </div>
            );
          })}
          {leadersToDisplay.length === 0 && (
            <p className="text-center text-sm text-gray-500 dark:text-gray-400 py-8">Geen spelers gevonden. Probeer het quota uit te schakelen.</p>
          )}
        </main>
      </div>
    );
  }

  // ============================================================================
  // 2. STANDAARD OVERZICHT SCHERM
  // ============================================================================
  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      <header className="px-4 pb-4 pt-[calc(1rem+env(safe-area-inset-top,0px))] flex items-center gap-4 sticky top-0 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <ChevronBack onClick={() => navigate(-1)} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold leading-tight tracking-tight">🏓 Bierpong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Dashboard</p>
        </div>
        <button
          onClick={() => { setShowScoreModal(true); setSelectedPlayers([(currentUser?.id || '')]); setSelectedWinnerIds([]); setPlayerSearch(''); setScoreSaved(false); setGameMode('1v1'); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-sm shadow-sm transition-colors"
        >
          <span className="material-icons-round text-lg">add</span>
          Score
        </button>
      </header>

      <main className="flex-1 px-4 pb-nav-safe overflow-y-auto space-y-6 pt-2">
        {loading ? (
          <div className="flex items-center justify-center p-12"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div></div>
        ) : (
          <>
            {/* ===== TOP 3 PODIUM ===== */}
            {podiumLeaders.length >= 3 && (
              <section className="relative">
                <div className="flex items-end justify-center gap-3 pt-4 pb-2">
                  {/* ZILVER */}
                  {(() => {
                    const leader = podiumLeaders[1];
                    return (
                      <div className="flex flex-col items-center w-24">
                        <div className="relative mb-2">
                          <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-gray-300 dark:border-gray-500 shadow-lg bg-gray-200">
                            {getUserAvatar(leader.userId) ? <img src={getUserAvatar(leader.userId)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-xl">{getUserName(leader.userId).charAt(0)}</div>}
                          </div>
                          <span className="absolute -top-1 -right-1 text-lg">🥈</span>
                        </div>
                        <p className="text-xs font-bold text-gray-600 dark:text-gray-300 text-center truncate w-full">{getUserName(leader.userId)}</p>
                        <div className="w-full h-16 bg-gradient-to-t from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-t-lg mt-1 flex items-center justify-center"><span className="text-2xl font-black text-gray-400">2</span></div>
                      </div>
                    );
                  })()}

                  {/* GOUD */}
                  {(() => {
                    const leader = podiumLeaders[0];
                    return (
                      <div className="flex flex-col items-center w-28 -mt-4">
                        <div className="relative mb-2">
                          <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-yellow-400 shadow-xl shadow-yellow-400/30 bg-yellow-100 ring-4 ring-yellow-400/20">
                            {getUserAvatar(leader.userId) ? <img src={getUserAvatar(leader.userId)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-yellow-600 font-bold text-2xl">{getUserName(leader.userId).charAt(0)}</div>}
                          </div>
                          <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">👑</span>
                        </div>
                        <p className="text-sm font-black text-yellow-600 dark:text-yellow-400 text-center truncate w-full">{getUserName(leader.userId)}</p>
                        <div className="w-full h-24 bg-gradient-to-t from-yellow-400 to-yellow-300 dark:from-yellow-600 dark:to-yellow-500 rounded-t-lg mt-1 flex items-center justify-center shadow-lg shadow-yellow-400/20"><span className="text-3xl font-black text-yellow-800 dark:text-yellow-900">1</span></div>
                      </div>
                    );
                  })()}

                  {/* BRONS */}
                  {(() => {
                    const leader = podiumLeaders[2];
                    return (
                      <div className="flex flex-col items-center w-24">
                        <div className="relative mb-2">
                          <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-orange-400 dark:border-orange-500 shadow-lg bg-orange-100">
                            {getUserAvatar(leader.userId) ? <img src={getUserAvatar(leader.userId)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-orange-500 font-bold text-xl">{getUserName(leader.userId).charAt(0)}</div>}
                          </div>
                          <span className="absolute -top-1 -right-1 text-lg">🥉</span>
                        </div>
                        <p className="text-xs font-bold text-orange-600 dark:text-orange-400 text-center truncate w-full">{getUserName(leader.userId)}</p>
                        <div className="w-full h-12 bg-gradient-to-t from-orange-300 to-orange-200 dark:from-orange-700 dark:to-orange-600 rounded-t-lg mt-1 flex items-center justify-center"><span className="text-2xl font-black text-orange-500 dark:text-orange-300">3</span></div>
                      </div>
                    );
                  })()}
                </div>
                <p className="text-[10px] text-center text-gray-400 dark:text-gray-500 mt-1">Min. {Math.ceil((leaderboard[0]?.gamesPlayed || 0) / 2)} potjes nodig om op het podium te staan</p>
              </section>
            )}

            {/* ===== LEADERBOARD PREVIEW (TOP 3) ===== */}
            <section>
              <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden mb-4">
                {podiumLeaders.slice(0, 3).map((leader, index) => {
                  const originalRank = originalRankMap[leader.userId] ?? index;
                  const medal = getMedalStyle(originalRank);
                  const isGold = originalRank === 0;
                  const isDuo = isDuoWinner(leader.userId);

                  return (
                    <div key={leader.userId} className={`flex items-center justify-between p-4 ${index !== 2 ? 'border-b border-gray-100 dark:border-gray-800' : ''} ${isGold ? 'bg-yellow-50/50 dark:bg-yellow-900/5' : ''}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${medal ? `${medal.bg} ${medal.text}` : 'bg-gray-100 text-gray-500'}`}>
                          {medal ? medal.icon : index + 1}
                        </div>
                        <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 ${isGold ? 'border-[2px] border-yellow-400' : isDuo ? 'border-[2px] border-purple-500' : ''}`}>
                          {getUserAvatar(leader.userId) ? <img src={getUserAvatar(leader.userId)} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full bg-blue-100 flex items-center justify-center font-bold">{getUserName(leader.userId).charAt(0)}</div>}
                        </div>
                        <div>
                          <p className={`font-extrabold text-sm ${isGold ? 'text-yellow-600 dark:text-yellow-400' : 'text-gray-900 dark:text-white'}`}>{getUserName(leader.userId)}</p>
                          <p className="text-xs text-gray-400">{leader.gamesPlayed} gespeeld</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className={`text-lg font-black ${isGold ? 'text-yellow-500' : 'text-blue-600 dark:text-blue-400'}`}>{leader.winRatio}%</div>
                        <div className="text-[10px] text-gray-400 uppercase font-bold">Win ratio</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ===== BIERPONGTOERNOOI KAMPIOENEN (DUO) ===== */}
            {duoBierpongWinners.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="material-icons-round text-base text-yellow-500">workspace_premium</span>
                  Toernooi Kampioenen
                </h2>
                <div className="bg-gradient-to-r from-amber-50/80 to-yellow-50/80 dark:from-yellow-900/10 dark:to-amber-900/10 rounded-2xl p-4 shadow-sm border border-yellow-300/60 dark:border-yellow-700/50 relative overflow-hidden">
                  
                  {/* Decoratieve kroon watermerk op de achtergrond */}
                  <span className="material-icons-round absolute -right-4 -top-4 text-[80px] text-yellow-500/10 dark:text-yellow-500/5 rotate-12 pointer-events-none">workspace_premium</span>

                  <div className="relative z-10 flex justify-between items-center">
                    <div className="flex flex-col flex-1 pr-2">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="material-icons-round text-yellow-600 dark:text-yellow-500 text-sm">emoji_events</span>
                        <h2 className="text-[10px] font-black uppercase tracking-[0.2em] text-yellow-700 dark:text-yellow-500">Team to beat</h2>
                      </div>
                      <p className="text-lg sm:text-xl font-black text-gray-900 dark:text-white leading-tight mb-0.5 truncate">
                        {duoBierpongWinners.map(id => getUserName(id).split(' ')[0]).join(' & ')}
                      </p>
                      <p className="text-xs text-yellow-700/80 dark:text-yellow-500/70 font-bold">Huidige Kampioenen 🍻</p>
                    </div>

                    <div className="flex -space-x-3 shrink-0">
                      {duoBierpongWinners.slice(0, 2).map((id, index) => (
                        <div key={id} className={`w-12 h-12 rounded-full border-2 border-white dark:border-[#1e2330] shadow-sm relative z-${20 - index * 10} flex items-center justify-center overflow-hidden bg-gray-100 dark:bg-gray-800`}>
                          {getUserAvatar(id) ? (
                            <img src={getUserAvatar(id)} className="w-full h-full object-cover" alt="Champ" />
                          ) : (
                            <span className="text-gray-500 font-bold text-sm">{getUserName(id).charAt(0)}</span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* BIG BUTTON TO OPEN FULL LEADERBOARD */}
            <button 
              onClick={() => setShowAllLeaders(true)}
              className="w-full bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 p-4 rounded-2xl border border-blue-100 dark:border-blue-800/50 flex items-center gap-4 cursor-pointer active:scale-[0.98] transition-all group"
            >
              <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center text-white shrink-0 shadow-md group-hover:scale-105 transition-transform">
                <span className="material-icons-round text-2xl">format_list_numbered</span>
              </div>
              <div className="flex-1 text-left">
                <h3 className="font-extrabold text-blue-900 dark:text-blue-100 text-base">Alle Scores Bekijken</h3>
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">Zoek en sorteer {leaderboard.length} spelers</p>
              </div>
              <span className="material-icons-round text-blue-400 group-hover:translate-x-1 transition-transform">arrow_forward_ios</span>
            </button>



            {/* ===== MATCH HISTORIEK ===== */}
            {bierpongGames.length > 0 && (
              <section>
                <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="material-icons-round text-base text-blue-500">history</span>
                  Recente Matches
                </h2>
                <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
                  {[...bierpongGames].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 10).map((game, i) => {
                    const is1v1 = game.playerIds.length === 2;
                    if (!is1v1) return null; 
                    const p1 = game.playerIds[0]; const p2 = game.playerIds[1];
                    const winner = game.winnerIds[0]; const loser = p1 === winner ? p2 : p1;
                    return (
                      <div key={game.id || i} className="p-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-green-500 bg-green-50 shrink-0">
                            {getUserAvatar(winner) ? <img src={getUserAvatar(winner)} alt="Win" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-green-700 font-bold text-xs">{getUserName(winner).charAt(0)}</div>}
                          </div>
                          <div className="text-xs font-black text-gray-400">VS</div>
                          <div className="w-8 h-8 rounded-full overflow-hidden border border-red-300 bg-red-50 opacity-80 shrink-0">
                            {getUserAvatar(loser) ? <img src={getUserAvatar(loser)} alt="Lose" className="w-full h-full object-cover grayscale" /> : <div className="w-full h-full flex items-center justify-center text-red-700 font-bold text-xs grayscale">{getUserName(loser).charAt(0)}</div>}
                          </div>
                        </div>
                        <div className="text-right flex-1 ml-3 min-w-0">
                          <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                            <span className="text-green-600 dark:text-green-400">{getUserName(winner)}</span>
                            <span className="text-gray-400 mx-1">vs</span>
                            <span>{getUserName(loser)}</span>
                          </p>
                          <p className="text-[10px] text-gray-400 mt-0.5">{new Date(game.timestamp).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {/* SCORE MODAL BLIJFT IDENTIEK, START HIERONDER */}
      {(() => {
        const allSelected = gameMode === '1v1' ? selectedPlayers.length === 2 : (team1.length === 2 && team2.length === 2);
        const hasWinner = gameMode === '1v1' ? selectedWinnerIds.length > 0 : !!winningTeam;
        const needsMorePlayers = gameMode === '1v1'
          ? 2 - selectedPlayers.length
          : (team1.length < 2 ? 2 - team1.length : 2 - team2.length);
        const currentlyFillingTeam = gameMode === '2v2' && team1.length < 2 ? 1 : 2;

        const statusText = scoreSaved ? 'Opgeslagen!' : hasWinner ? 'Klaar om op te slaan'
          : allSelected ? 'Kies het winnende team'
            : gameMode === '1v1' ? `Selecteer nog ${needsMorePlayers} speler${needsMorePlayers > 1 ? 's' : ''}`
              : `Selecteer nog ${needsMorePlayers} speler${needsMorePlayers > 1 ? 's' : ''} voor Team ${currentlyFillingTeam}`;

        const filteredUsers = users
          .filter(u => !selectedPlayers.includes(u.id) && !team1.includes(u.id) && !team2.includes(u.id))
          .filter(u => {
            if (!playerSearch) return true;
            return (u.nickname || u.name || u.naam || '').toLowerCase().includes(playerSearch.toLowerCase());
          });

        const renderPlayerChip = (pid: string, removable: boolean, onRemove?: () => void) => {
          const u = getUser(pid);
          const isMe = pid === (currentUser?.id || '');
          return (
            <div key={pid} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-gray-100 dark:bg-gray-800">
              <div className="w-7 h-7 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
                {u?.avatar ? (
                  <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {getUserName(pid).charAt(0)}
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate flex-1">
                {getUserName(pid)} {isMe && <span className="text-gray-400 font-normal ml-1">(jij)</span>}
              </span>
              {removable && !isMe && onRemove && (
                <button onClick={onRemove} className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors">
                  <span className="material-icons-round text-gray-400 hover:text-red-500" style={{ fontSize: '12px' }}>close</span>
                </button>
              )}
            </div>
          );
        };

        return (
          <BottomSheet
            isOpen={showScoreModal}
            onClose={() => setShowScoreModal(false)}
            title="Score Invullen"
          >
            <div className="space-y-5">
                <p className="text-xs text-gray-400 -mt-2">{statusText}</p>

                {/* Game Mode Toggle */}
                {!scoreSaved && (
                  <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                    <button
                      onClick={() => { setGameMode('1v1'); setSelectedPlayers([(currentUser?.id || '')]); setSelectedWinnerIds([]); setTeam1([]); setTeam2([]); setWinningTeam(null); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${gameMode === '1v1' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}
                    >
                      1 vs 1
                    </button>
                    <button
                      onClick={() => { setGameMode('2v2'); setSelectedPlayers([]); setSelectedWinnerIds([]); setTeam1([(currentUser?.id || '')]); setTeam2([]); setWinningTeam(null); }}
                      className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all ${gameMode === '2v2' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}
                    >
                      2 vs 2
                    </button>
                  </div>
                )}

                {/* ===== 1v1 MODE ===== */}
                {gameMode === '1v1' && !scoreSaved && (
                  <>
                    {/* Selected players - click to select winner */}
                    {selectedPlayers.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                          {selectedWinnerIds.length > 0 ? '🏆 Tik om winnaar te wijzigen' : '👆 Tik op de winnaar'}
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          {selectedPlayers.map(pid => {
                            const u = getUser(pid);
                            const isMe = pid === (currentUser?.id || '');
                            const isWinner = selectedWinnerIds.includes(pid);
                            return (
                              <div
                                key={pid}
                                onClick={() => setSelectedWinnerIds([pid])}
                                className={`flex items-center gap-2.5 py-2 px-3 rounded-xl cursor-pointer transition-all border-2 ${isWinner ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-gray-50 dark:bg-gray-800 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                              >
                                <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
                                  {u?.avatar ? (
                                    <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs">
                                      {getUserName(pid).charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0 flex-1">
                                  <p className="text-[11px] font-bold text-gray-700 dark:text-gray-200 truncate">
                                    {getUserName(pid)} {isMe && <span className="text-gray-400 font-normal">(jij)</span>}
                                  </p>
                                  {isWinner && <span className="text-[9px] text-green-600 dark:text-green-400 font-bold uppercase">Winnaar</span>}
                                </div>
                                {!isMe && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setSelectedPlayers(prev => prev.filter(p => p !== pid)); if (selectedWinnerIds.includes(pid)) setSelectedWinnerIds([]); }}
                                    className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0"
                                  >
                                    <span className="material-icons-round text-gray-400 text-xs">close</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Search for 1v1 */}
                    {selectedPlayers.length < 2 && (
                      <div className="space-y-3">
                        <div className="relative">
                          <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                          <input type="text" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} placeholder="Zoek tegenstander..."
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {filteredUsers.map(u => (
                            <button key={u.id} onClick={() => { setSelectedPlayers(prev => [...prev, u.id]); setPlayerSearch(''); }}
                              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700">
                                {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : (
                                  <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs">{(u.nickname || u.name || u.naam || '?').charAt(0)}</div>
                                )}
                              </div>
                              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{u.nickname || u.name || u.naam}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* ===== 2v2 MODE ===== */}
                {gameMode === '2v2' && !scoreSaved && (
                  <div className="space-y-4">
                    {/* Team selection */}
                    <div className="grid grid-cols-2 gap-3">
                      {/* Team 1 */}
                      <div
                        onClick={() => team1.length === 2 && team2.length === 2 && setWinningTeam('team1')}
                        className={`rounded-xl p-3 transition-all cursor-pointer border-2 ${winningTeam === 'team1' ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-blue-50 dark:bg-blue-900/10 border-blue-200 dark:border-blue-800'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Team 1</span>
                          {winningTeam === 'team1' && <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">Winnaar</span>}
                        </div>
                        <div className="space-y-1.5">
                          {team1.map(pid => renderPlayerChip(pid, true, () => { if (pid !== (currentUser?.id || '')) { setTeam1(prev => prev.filter(p => p !== pid)); setWinningTeam(null); } }))}
                          {team1.length < 2 && (
                            <div className="py-1.5 text-center rounded-lg border border-dashed border-blue-300 dark:border-blue-700">
                              <span className="text-[10px] text-blue-400 font-bold uppercase">+ Speler</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Team 2 */}
                      <div
                        onClick={() => team1.length === 2 && team2.length === 2 && setWinningTeam('team2')}
                        className={`rounded-xl p-3 transition-all cursor-pointer border-2 ${winningTeam === 'team2' ? 'bg-green-50 dark:bg-green-900/20 border-green-500' : 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Team 2</span>
                          {winningTeam === 'team2' && <span className="text-[10px] font-bold text-green-600 dark:text-green-400 uppercase">Winnaar</span>}
                        </div>
                        <div className="space-y-1.5">
                          {team2.map(pid => renderPlayerChip(pid, true, () => { setTeam2(prev => prev.filter(p => p !== pid)); setWinningTeam(null); }))}
                          {team2.length < 2 && (
                            <div className="py-1.5 text-center rounded-lg border border-dashed border-red-300 dark:border-red-700">
                              <span className="text-[10px] text-red-400 font-bold uppercase">+ Speler</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Search for 2v2 */}
                    {(team1.length < 2 || team2.length < 2) && (
                      <div className="space-y-3">
                        <div className="relative">
                          <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                          <input type="text" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                            placeholder={team1.length < 2 ? 'Teamgenoot zoeken...' : 'Tegenstander zoeken...'}
                            className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 outline-none" autoFocus />
                        </div>
                        <div className="space-y-1 max-h-40 overflow-y-auto">
                          {filteredUsers.map(u => (
                            <button key={u.id} onClick={() => {
                              if (team1.length < 2) setTeam1(prev => [...prev, u.id]);
                              else setTeam2(prev => [...prev, u.id]);
                              setPlayerSearch('');
                            }} className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                              <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700">
                                {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : (
                                  <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs">{(u.nickname || u.name || u.naam || '?').charAt(0)}</div>
                                )}
                              </div>
                              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{u.nickname || u.name || u.naam}</span>
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Success message */}
                {scoreSaved && (
                  <div className="text-center py-6">
                    <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
                      <span className="material-icons-round text-green-600 dark:text-green-400 text-3xl">check</span>
                    </div>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">Score opgeslagen!</p>
                    <p className="text-sm text-gray-400 mt-1">Leaderboard is bijgewerkt</p>
                  </div>
                )}

                {/* Save Button */}
                {allSelected && hasWinner && !scoreSaved && (
                  <button
                    onClick={() => {
                      if (gameMode === '1v1') {
                        handleAddBierpongGame(selectedPlayers, selectedWinnerIds);
                      } else {
                        const winners = winningTeam === 'team1' ? team1 : team2;
                        const allPlayersDuo = [...team1, ...team2];
                        handleAddBierpongGame(allPlayersDuo, winners);
                      }
                      hapticSuccess();
                      setScoreSaved(true);
                      setTimeout(() => setShowScoreModal(false), 1200);
                    }}
                    className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-500/20 active:scale-[0.98] transition-all"
                  >
                    <span className="material-icons-round">save</span>
                    Score Opslaan
                  </button>
                )}
            </div>
          </BottomSheet>
        );
      })()}
    </div>
  );
};
