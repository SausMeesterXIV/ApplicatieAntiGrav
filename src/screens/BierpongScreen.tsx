import React, { useState, useMemo, useRef } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { ChevronBack } from '../components/ChevronBack';
import { AppContextType } from '../App';

interface BierpongLeaderboardEntry {
  userId: string;
  gamesPlayed: number;
  wins: number;
  winRatio: number;
}

export const BierpongScreen: React.FC = () => {
  const navigate = useNavigate();
  const {
    bierpongGames,
    users,
    currentUser,
    duoBierpongWinners,
    handleAddBierpongGame,
  } = useOutletContext<AppContextType>();

  const [showAllLeaders, setShowAllLeaders] = useState(false);
  const [sortBy, setSortBy] = useState<'gamesPlayed' | 'winRatio' | 'score'>('gamesPlayed');
  const leaderboardRef = useRef<HTMLElement>(null);

  // Score modal state
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedWinnerIds, setSelectedWinnerIds] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [scoreSaved, setScoreSaved] = useState(false);
  const [gameMode, setGameMode] = useState<'1v1' | '2v2'>('1v1');
  const maxPlayers = gameMode === '1v1' ? 2 : 4;
  const [team1, setTeam1] = useState<string[]>([]);
  const [team2, setTeam2] = useState<string[]>([]);
  const [winningTeam, setWinningTeam] = useState<'team1' | 'team2' | null>(null);

  const scrollToLeaderboard = () => {
    setTimeout(() => {
      leaderboardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const leaderboard = useMemo(() => {
    // 1. Initialize stats
    const playerStats: { [key: string]: { gamesPlayed: number; wins: number } } = {};
    const getStats = (id: string) => {
      if (!playerStats[id]) {
        playerStats[id] = { gamesPlayed: 0, wins: 0 };
      }
      return playerStats[id];
    };

    // 2. Sort games chronologically (oldest first)
    const sortedGames = [...bierpongGames].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    // 3. Calculate stats
    sortedGames.forEach(game => {
      const is1v1 = game.playerIds.length === 2;
      const is2v2 = game.playerIds.length === 4;

      if (is1v1) {
        const p1Id = game.playerIds[0];
        const p2Id = game.playerIds[1];
        const p1Stats = getStats(p1Id);
        const p2Stats = getStats(p2Id);

        p1Stats.gamesPlayed++;
        p2Stats.gamesPlayed++;

        const p1Won = game.winnerIds.includes(p1Id);
        const p2Won = game.winnerIds.includes(p2Id);

        if (p1Won) p1Stats.wins++;
        if (p2Won) p2Stats.wins++;
      } else if (is2v2) {
        game.playerIds.forEach((id: string) => {
          const stats = getStats(id);
          stats.gamesPlayed++;
          if (game.winnerIds.includes(id)) {
            stats.wins++;
          }
        });
      }
    });

    const calculatedLeaderboard: BierpongLeaderboardEntry[] = Object.keys(playerStats).map(userId => {
      const stats = playerStats[userId];
      const winRatio = stats.gamesPlayed > 0 ? Math.round((stats.wins / stats.gamesPlayed) * 100) : 0;
      return { userId, gamesPlayed: stats.gamesPlayed, wins: stats.wins, winRatio };
    });

    calculatedLeaderboard.sort((a, b) => b.gamesPlayed - a.gamesPlayed || b.winRatio - a.winRatio);

    const top10ByGamesPlayed = calculatedLeaderboard.slice(0, 10);
    top10ByGamesPlayed.sort((a, b) => b.winRatio - a.winRatio || b.gamesPlayed - a.gamesPlayed);

    const remainingLeaders = calculatedLeaderboard.slice(10).sort((a, b) => b.gamesPlayed - a.gamesPlayed);

    return [...top10ByGamesPlayed, ...remainingLeaders];
  }, [bierpongGames]);

  // The original ranking order — used for medals/emojis/gold styling
  const originalRankMap = useMemo(() => {
    const map: { [userId: string]: number } = {};
    leaderboard.forEach((entry, i) => { map[entry.userId] = i; });
    return map;
  }, [leaderboard]);

  const leadersToDisplay = useMemo(() => {
    if (!showAllLeaders) return leaderboard.slice(0, 10);

    let list = [...leaderboard];

    if (sortBy === 'score') {
      const top10GamesPlayed = [...list].sort((a, b) => b.gamesPlayed - a.gamesPlayed).slice(0, 10);
      return top10GamesPlayed.sort((a, b) => b.winRatio - a.winRatio || b.gamesPlayed - a.gamesPlayed);
    }

    return list.sort((a, b) => {
      if (sortBy === 'winRatio') return b.winRatio - a.winRatio || b.gamesPlayed - a.gamesPlayed;
      return b.gamesPlayed - a.gamesPlayed || b.winRatio - a.winRatio;
    });
  }, [leaderboard, showAllLeaders, sortBy]);

  const getUser = (userId: string) => users.find((u: any) => u.id === userId);
  const getUserName = (userId: string) => {
    const u = getUser(userId);
    return u?.nickname || u?.name || u?.naam || 'Onbekend';
  };
  const getUserAvatar = (userId: string) => getUser(userId)?.avatar;

  const isDuoWinner = (userId: string) => duoBierpongWinners.includes(userId);

  const getMedalStyle = (index: number) => {
    if (index === 0) return { bg: 'bg-gradient-to-r from-yellow-400 to-amber-500', text: 'text-yellow-900', icon: '👑', ring: 'ring-yellow-400' };
    if (index === 1) return { bg: 'bg-gradient-to-r from-gray-300 to-slate-400', text: 'text-gray-800', icon: '🥈', ring: 'ring-gray-300' };
    if (index === 2) return { bg: 'bg-gradient-to-r from-orange-400 to-amber-600', text: 'text-orange-900', icon: '🥉', ring: 'ring-orange-400' };
    return null;
  };

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      {/* Header */}
      <header className="px-4 py-4 flex items-center gap-4 sticky top-0 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <ChevronBack onClick={() => navigate(-1)} />
        <div className="flex-1">
          <h1 className="text-2xl font-bold leading-tight tracking-tight">🏓 Bierpong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Leaderboard & Kampioenen</p>
        </div>
        <button
          onClick={() => { setShowScoreModal(true); setSelectedPlayers([currentUser.id]); setSelectedWinnerIds([]); setPlayerSearch(''); setScoreSaved(false); setGameMode('1v1'); }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2.5 px-4 rounded-xl flex items-center gap-2 text-sm shadow-sm transition-colors"
        >
          <span className="material-icons-round text-lg">add</span>
          Score
        </button>
      </header>

      <main className="flex-1 px-4 pb-nav-safe overflow-y-auto space-y-6 pt-2">

        {/* ===== TOP 3 PODIUM ===== */}
        {leaderboard.length >= 3 && (
          <section className="relative">
            <div className="flex items-end justify-center gap-3 pt-4 pb-2">
              {/* #2 - Silver */}
              {(() => {
                const leader = leaderboard[1];
                return (
                  <div className="flex flex-col items-center w-24">
                    <div className="relative mb-2">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-gray-300 dark:border-gray-500 shadow-lg bg-gray-200">
                        {getUserAvatar(leader.userId) ? (
                          <img src={getUserAvatar(leader.userId)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-500 font-bold text-xl">{getUserName(leader.userId).charAt(0)}</div>
                        )}
                      </div>
                      <span className="absolute -top-1 -right-1 text-lg">🥈</span>
                    </div>
                    <p className="text-xs font-bold text-gray-600 dark:text-gray-300 text-center truncate w-full">{getUserName(leader.userId)}</p>
                    <p className="text-[10px] text-gray-400">{leader.gamesPlayed} gespeeld</p>
                    <div className="w-full h-16 bg-gradient-to-t from-gray-200 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-t-lg mt-1 flex items-center justify-center">
                      <span className="text-2xl font-black text-gray-400">2</span>
                    </div>
                  </div>
                );
              })()}

              {/* #1 - Gold */}
              {(() => {
                const leader = leaderboard[0];
                return (
                  <div className="flex flex-col items-center w-28 -mt-4">
                    <div className="relative mb-2">
                      <div className="w-20 h-20 rounded-full overflow-hidden border-4 border-yellow-400 shadow-xl shadow-yellow-400/30 bg-yellow-100 ring-4 ring-yellow-400/20">
                        {getUserAvatar(leader.userId) ? (
                          <img src={getUserAvatar(leader.userId)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-yellow-600 font-bold text-2xl">{getUserName(leader.userId).charAt(0)}</div>
                        )}
                      </div>
                      <span className="absolute -top-3 left-1/2 -translate-x-1/2 text-2xl">👑</span>
                    </div>
                    <p className="text-sm font-black text-yellow-600 dark:text-yellow-400 text-center truncate w-full">{getUserName(leader.userId)}</p>
                    <p className="text-xs text-yellow-500 font-bold">{leader.winRatio}% Win</p>
                    <div className="w-full h-24 bg-gradient-to-t from-yellow-400 to-yellow-300 dark:from-yellow-600 dark:to-yellow-500 rounded-t-lg mt-1 flex items-center justify-center shadow-lg shadow-yellow-400/20">
                      <span className="text-3xl font-black text-yellow-800 dark:text-yellow-900">1</span>
                    </div>
                  </div>
                );
              })()}

              {/* #3 - Bronze */}
              {(() => {
                const leader = leaderboard[2];
                return (
                  <div className="flex flex-col items-center w-24">
                    <div className="relative mb-2">
                      <div className="w-16 h-16 rounded-full overflow-hidden border-3 border-orange-400 dark:border-orange-500 shadow-lg bg-orange-100">
                        {getUserAvatar(leader.userId) ? (
                          <img src={getUserAvatar(leader.userId)} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-orange-500 font-bold text-xl">{getUserName(leader.userId).charAt(0)}</div>
                        )}
                      </div>
                      <span className="absolute -top-1 -right-1 text-lg">🥉</span>
                    </div>
                    <p className="text-xs font-bold text-orange-600 dark:text-orange-400 text-center truncate w-full">{getUserName(leader.userId)}</p>
                    <p className="text-[10px] text-gray-400">{leader.gamesPlayed} gespeeld</p>
                    <div className="w-full h-12 bg-gradient-to-t from-orange-300 to-orange-200 dark:from-orange-700 dark:to-orange-600 rounded-t-lg mt-1 flex items-center justify-center">
                      <span className="text-2xl font-black text-orange-500 dark:text-orange-300">3</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          </section>
        )}

        {/* ===== LEADERBOARD LIST ===== */}
        <section ref={leaderboardRef} style={{ scrollMarginTop: '70px' }}>
          <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
            <span className="material-icons-round text-base">leaderboard</span>
            Top {showAllLeaders ? leaderboard.length : 10}
          </h2>
          <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden">
            {leadersToDisplay.map((leader, index) => {
              // Use ORIGINAL rank for styling, not sorted display index
              const originalRank = originalRankMap[leader.userId] ?? index;
              const medal = getMedalStyle(originalRank);
              const isGold = originalRank === 0;
              const isDuo = isDuoWinner(leader.userId);
              const isUltimateKing = isGold && isDuo;

              return (
                <div
                  key={leader.userId}
                  className={`flex items-center justify-between p-4 transition-colors ${index !== leadersToDisplay.length - 1 ? 'border-b border-gray-100 dark:border-gray-800' : ''} ${isGold ? 'bg-yellow-50/50 dark:bg-yellow-900/5' : ''}`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-black shrink-0 ${medal ? `${medal.bg} ${medal.text}` : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400'}`}>
                      {medal ? medal.icon : index + 1}
                    </div>

                    <div className={`w-10 h-10 rounded-full overflow-hidden shrink-0 ${isUltimateKing ? 'neon-ring ring-offset-2 ring-offset-white dark:ring-offset-[#1e293b]' : isGold ? 'ring-2 ring-yellow-400 ring-offset-2 ring-offset-white dark:ring-offset-[#1e293b]' : isDuo ? 'neon-ring ring-offset-2 ring-offset-white dark:ring-offset-[#1e293b]' : ''}`}>
                      {getUserAvatar(leader.userId) ? (
                        <img src={getUserAvatar(leader.userId)} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold">
                          {getUserName(leader.userId).charAt(0)}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="flex items-center gap-1.5">
                        {isUltimateKing && <><span className="text-sm">👑</span><span className="text-sm">🏆</span></>}
                        {!isUltimateKing && isGold && <span className="text-sm">👑</span>}
                        {!isUltimateKing && isDuo && <span className="text-sm">🏆</span>}
                        <p className={`font-extrabold text-base ${isUltimateKing ? 'text-yellow-600 dark:text-yellow-300' : isGold ? 'text-yellow-600 dark:text-yellow-300' : isDuo ? 'neon-text' : 'text-gray-900 dark:text-white'}`}>
                          {getUserName(leader.userId)}
                        </p>
                      </div>
                      <p className="text-xs text-gray-400">{leader.wins}W / {leader.gamesPlayed - leader.wins}L • {leader.gamesPlayed} gespeeld</p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className={`text-lg font-black ${isGold ? 'text-yellow-500' : 'text-blue-600 dark:text-blue-400'}`}>
                      {leader.winRatio}%
                    </div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-wide font-bold">
                      win ratio
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {showAllLeaders && (
            <div className="grid grid-cols-3 gap-2 mt-3">
              <button
                onClick={() => { setSortBy('winRatio'); scrollToLeaderboard(); }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors ${sortBy === 'winRatio' ? 'bg-green-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
              >
                <span className="material-icons-round text-sm">show_chart</span>
                <span>Win ratio</span>
              </button>
              <button
                onClick={() => { setSortBy('gamesPlayed'); scrollToLeaderboard(); }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors ${sortBy === 'gamesPlayed' ? 'bg-purple-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
              >
                <span className="material-icons-round text-sm">sports_esports</span>
                <span>Gespeeld</span>
              </button>
              <button
                onClick={() => { setSortBy('score'); scrollToLeaderboard(); }}
                className={`py-1.5 px-2 rounded-lg text-xs font-bold flex flex-col sm:flex-row items-center justify-center gap-1 transition-colors ${sortBy === 'score' ? 'bg-orange-600 text-white shadow-sm' : 'bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700'}`}
              >
                <span className="material-icons-round text-sm">workspace_premium</span>
                <span>Score</span>
              </button>
            </div>
          )}

          {!showAllLeaders && leaderboard.length > 0 && (
            <button
              onClick={() => setShowAllLeaders(true)}
              className="mt-4 mb-8 w-full bg-gray-100 dark:bg-[#1e293b] hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-bold py-3 px-4 rounded-xl transition-colors border border-gray-200 dark:border-gray-700 flex items-center justify-center gap-2"
            >
              <span className="material-icons-round text-sm">visibility</span>
              Bekijk alles ({leaderboard.length} spelers)
            </button>
          )}

          {showAllLeaders && (
            <button
              onClick={() => setShowAllLeaders(false)}
              className="mt-3 mb-8 w-full bg-gray-100 dark:bg-[#1e293b] hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400 font-bold py-2.5 px-4 rounded-xl transition-colors border border-gray-200 dark:border-gray-700 text-xs flex items-center justify-center gap-2"
            >
              <span className="material-icons-round text-sm">visibility_off</span>
              Alleen top 10 tonen
            </button>
          )}
        </section>

        {/* ===== BIERPONGTOERNOOI KAMPIOENEN ===== */}
        {duoBierpongWinners.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="material-icons-round text-base text-purple-500">emoji_events</span>
              Bierpongtoernooi Kampioenen
            </h2>
            <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-purple-600 via-purple-700 to-indigo-800 p-5 shadow-xl neon-card">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2"></div>

              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <span className="text-2xl">🏆</span>
                  <div>
                    <h3 className="text-white font-bold text-lg">Huidige Kampioenen</h3>
                    <p className="text-purple-200 text-xs">Bierpongtoernooi</p>
                  </div>
                </div>

                <div className="flex gap-4 justify-center">
                  {duoBierpongWinners.map((winnerId) => {
                    const winnerUser = getUser(winnerId);
                    if (!winnerUser) return null;
                    return (
                      <div key={winnerId} className="flex flex-col items-center bg-white/10 backdrop-blur-sm rounded-xl p-4 flex-1">
                        <div className="relative mb-2">
                          <div className="w-16 h-16 rounded-full overflow-hidden neon-ring shadow-lg">
                            {winnerUser.avatar ? (
                              <img src={winnerUser.avatar} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-purple-300 flex items-center justify-center text-purple-700 font-bold text-xl">
                                {getUserName(winnerId).charAt(0)}
                              </div>
                            )}
                          </div>
                          <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-lg">👑</span>
                        </div>
                        <p className="text-white font-bold text-sm text-center neon-text">{getUserName(winnerId)}</p>
                        <p className="text-purple-200 text-[10px] font-medium">{winnerUser.role || winnerUser.rol}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ===== MATCH HISTORIEK ===== */}
        {bierpongGames.length > 0 && (
          <section>
            <h2 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3 flex items-center gap-2">
              <span className="material-icons-round text-base text-blue-500">history</span>
              Match Historiek
            </h2>
            <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 overflow-hidden divide-y divide-gray-100 dark:divide-gray-800">
              {[...bierpongGames]
                .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
                .slice(0, 10)
                .map((game, i) => {
                  const is1v1 = game.playerIds.length === 2;
                  if (!is1v1) return null; // Simplified history view for 1v1 for now
                  const p1 = game.playerIds[0];
                  const p2 = game.playerIds[1];
                  const winner = game.winnerIds[0];
                  const loser = p1 === winner ? p2 : p1;

                  const winnerUser = getUser(winner);
                  const loserUser = getUser(loser);

                  return (
                    <div key={game.id || i} className="p-3 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-green-500 bg-green-50 shrink-0">
                          {winnerUser?.avatar ? <img src={winnerUser.avatar} alt="Winner" className="w-full h-full object-cover" /> : <div className="w-full h-full flex flex-col items-center justify-center text-green-700 font-bold text-xs">{getUserName(winner).charAt(0)}</div>}
                        </div>
                        <div className="text-xs font-black text-gray-400">VS</div>
                        <div className="w-8 h-8 rounded-full overflow-hidden border border-red-300 bg-red-50 opacity-80 shrink-0">
                          {loserUser?.avatar ? <img src={loserUser.avatar} alt="Loser" className="w-full h-full object-cover grayscale" /> : <div className="w-full h-full flex flex-col items-center justify-center text-red-700 font-bold text-xs grayscale">{getUserName(loser).charAt(0)}</div>}
                        </div>
                      </div>

                      <div className="text-right flex-1 ml-3 min-w-0">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">
                          <span className="text-green-600 dark:text-green-400">{getUserName(winner)}</span>
                          <span className="text-gray-400 mx-1">versloeg</span>
                          <span>{getUserName(loser)}</span>
                        </p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {new Date(game.timestamp).toLocaleDateString('nl-BE', { day: 'numeric', month: 'short' })} • {new Date(game.timestamp).toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  );
                })}
            </div>
            {bierpongGames.length > 10 && (
              <p className="text-center text-xs text-gray-400 mt-3 italic">Laatste 10 matches worden weergegeven.</p>
            )}
          </section>
        )}
      </main>

      {/* ===== SCORE INVULLEN MODAL ===== */}
      {showScoreModal && (() => {
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
          const isMe = pid === currentUser.id;
          return (
            <div key={pid} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg bg-white/60 dark:bg-gray-700/50">
              <div className="w-7 h-7 rounded-full overflow-hidden border border-gray-200 dark:border-gray-600 shrink-0">
                {u?.avatar ? (
                  <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-xs">
                    {getUserName(pid).charAt(0)}
                  </div>
                )}
              </div>
              <span className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">
                {getUserName(pid)} {isMe && <span className="text-gray-400">(jij)</span>}
              </span>
              {removable && !isMe && onRemove && (
                <button onClick={onRemove} className="w-5 h-5 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors ml-auto">
                  <span className="material-icons-round text-gray-400 hover:text-red-500" style={{ fontSize: '12px' }}>close</span>
                </button>
              )}
            </div>
          );
        };

        return (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowScoreModal(false)} />
            <div className="relative bg-white dark:bg-[#1e293b] w-full sm:max-w-md rounded-t-3xl sm:rounded-2xl shadow-2xl max-h-[85vh] flex flex-col overflow-hidden">
              {/* Modal Header */}
              <div className="p-5 border-b border-gray-100 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">🏓 Score Invullen</h2>
                  <p className="text-xs text-gray-400 mt-0.5">{statusText}</p>
                </div>
                <button onClick={() => setShowScoreModal(false)} className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                  <span className="material-icons-round text-gray-500 text-xl">close</span>
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-5 space-y-4">
                {/* Game Mode Toggle */}
                {!scoreSaved && (
                  <div className="flex gap-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
                    <button
                      onClick={() => { setGameMode('1v1'); setSelectedPlayers([currentUser.id]); setSelectedWinnerIds([]); setTeam1([]); setTeam2([]); setWinningTeam(null); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${gameMode === '1v1' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}
                    >
                      1 vs 1
                    </button>
                    <button
                      onClick={() => { setGameMode('2v2'); setSelectedPlayers([]); setSelectedWinnerIds([]); setTeam1([currentUser.id]); setTeam2([]); setWinningTeam(null); }}
                      className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${gameMode === '2v2' ? 'bg-white dark:bg-gray-700 shadow-sm text-gray-900 dark:text-white' : 'text-gray-500'}`}
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
                      <div>
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-2">
                          {selectedWinnerIds.length > 0 ? '🏆 Tik om winnaar te wijzigen' : '👆 Tik op de winnaar'}
                        </p>
                        <div className="flex flex-wrap gap-2 justify-center">
                          {selectedPlayers.map(pid => {
                            const u = getUser(pid);
                            const isMe = pid === currentUser.id;
                            const isWinner = selectedWinnerIds.includes(pid);
                            return (
                              <div
                                key={pid}
                                onClick={() => setSelectedWinnerIds([pid])}
                                className={`flex items-center gap-2.5 py-2 px-3 rounded-xl cursor-pointer transition-all ${isWinner ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500' : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'}`}
                              >
                                <div className="w-9 h-9 rounded-full overflow-hidden border-2 border-gray-200 dark:border-gray-600 shrink-0">
                                  {u?.avatar ? (
                                    <img src={u.avatar} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-sm">
                                      {getUserName(pid).charAt(0)}
                                    </div>
                                  )}
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs font-bold text-gray-700 dark:text-gray-200 truncate">
                                    {getUserName(pid)} {isMe && <span className="text-gray-400">(jij)</span>}
                                  </p>
                                  {isWinner && <span className="text-[10px] text-green-600 dark:text-green-400 font-bold">🏆 Winnaar</span>}
                                </div>
                                {!isMe && (
                                  <button
                                    onClick={e => { e.stopPropagation(); setSelectedPlayers(prev => prev.filter(p => p !== pid)); if (selectedWinnerIds.includes(pid)) setSelectedWinnerIds([]); }}
                                    className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center shrink-0 hover:bg-red-100 transition-colors"
                                  >
                                    <span className="material-icons-round text-gray-400 hover:text-red-500 text-sm">close</span>
                                  </button>
                                )}
                              </div>
                            );
                          })}
                          {selectedPlayers.length < 2 && (
                            <div className="flex items-center gap-2 py-2 px-3 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-600">
                              <span className="material-icons-round text-gray-300 dark:text-gray-600 text-xl">person_add</span>
                              <span className="text-[10px] text-gray-400">Tegenstander</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Search for 1v1 */}
                    {selectedPlayers.length < 2 && (
                      <>
                        <div className="relative">
                          <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">search</span>
                          <input type="text" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)} placeholder="Zoek tegenstander..."
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" autoFocus />
                        </div>
                        <div className="space-y-1 max-h-52 overflow-y-auto">
                          {filteredUsers.map(u => (
                            <button key={u.id} onClick={() => { setSelectedPlayers(prev => [...prev, u.id]); setPlayerSearch(''); }}
                              className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700">
                                {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : (
                                  <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-sm">{(u.nickname || u.name || u.naam || '?').charAt(0)}</div>
                                )}
                              </div>
                              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{u.nickname || u.name || u.naam}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}
                  </>
                )}

                {/* ===== 2v2 MODE ===== */}
                {gameMode === '2v2' && !scoreSaved && (
                  <>
                    {/* Team cards */}
                    <div className="space-y-3">
                      {/* Team 1 */}
                      <div className={`rounded-xl p-3 transition-all ${winningTeam === 'team1' ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500' : 'bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider">Team 1 (jouw team)</span>
                          {winningTeam === 'team1' && <span className="text-xs font-bold text-green-600 dark:text-green-400">🏆 Winnaar</span>}
                        </div>
                        <div className="space-y-1.5">
                          {team1.map(pid => renderPlayerChip(pid, true, () => { if (pid !== currentUser.id) { setTeam1(prev => prev.filter(p => p !== pid)); setWinningTeam(null); } }))}
                          {team1.length < 2 && (
                            <div className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg border border-dashed border-blue-300 dark:border-blue-700">
                              <span className="material-icons-round text-blue-300 dark:text-blue-700 text-lg">person_add</span>
                              <span className="text-[10px] text-blue-400">Teamgenoot</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-center text-xs font-black text-gray-300 dark:text-gray-600">VS</div>

                      {/* Team 2 */}
                      <div className={`rounded-xl p-3 transition-all ${winningTeam === 'team2' ? 'bg-green-50 dark:bg-green-900/20 ring-2 ring-green-500' : 'bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800'}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Team 2</span>
                          {winningTeam === 'team2' && <span className="text-xs font-bold text-green-600 dark:text-green-400">🏆 Winnaar</span>}
                        </div>
                        <div className="space-y-1.5">
                          {team2.map(pid => renderPlayerChip(pid, true, () => { setTeam2(prev => prev.filter(p => p !== pid)); setWinningTeam(null); }))}
                          {team2.length < 2 && Array.from({ length: 2 - team2.length }).map((_, i) => (
                            <div key={`t2-empty-${i}`} className="flex items-center gap-2 py-1.5 px-2.5 rounded-lg border border-dashed border-red-300 dark:border-red-700">
                              <span className="material-icons-round text-red-300 dark:text-red-700 text-lg">person_add</span>
                              <span className="text-[10px] text-red-400">Tegenstander</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Search for 2v2 */}
                    {(team1.length < 2 || team2.length < 2) && (
                      <>
                        <div className="relative">
                          <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xl">search</span>
                          <input type="text" value={playerSearch} onChange={e => setPlayerSearch(e.target.value)}
                            placeholder={team1.length < 2 ? 'Zoek teamgenoot...' : 'Zoek tegenstander...'}
                            className="w-full pl-10 pr-4 py-3 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none" autoFocus />
                        </div>
                        <div className="space-y-1 max-h-44 overflow-y-auto">
                          {filteredUsers.map(u => (
                            <button key={u.id} onClick={() => {
                              if (team1.length < 2) setTeam1(prev => [...prev, u.id]);
                              else setTeam2(prev => [...prev, u.id]);
                              setPlayerSearch('');
                            }} className="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors text-left">
                              <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-gray-200 dark:border-gray-700">
                                {u.avatar ? <img src={u.avatar} alt="" className="w-full h-full object-cover" /> : (
                                  <div className="w-full h-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 font-bold text-sm">{(u.nickname || u.name || u.naam || '?').charAt(0)}</div>
                                )}
                              </div>
                              <span className="text-sm font-bold text-gray-700 dark:text-gray-200">{u.nickname || u.name || u.naam}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Team Winner Selection */}
                    {team1.length === 2 && team2.length === 2 && !winningTeam && (
                      <div>
                        <p className="text-sm font-bold text-gray-500 dark:text-gray-400 mb-3 text-center">Welk team heeft gewonnen?</p>
                        <div className="flex gap-3">
                          <button onClick={() => setWinningTeam('team1')} className="flex-1 py-3 rounded-xl bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-center">
                            <span className="text-sm font-bold text-blue-600 dark:text-blue-400">Team 1</span>
                            <p className="text-[10px] text-gray-400 mt-0.5">Jouw team</p>
                          </button>
                          <button onClick={() => setWinningTeam('team2')} className="flex-1 py-3 rounded-xl bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-700 hover:border-green-500 hover:bg-green-50 dark:hover:bg-green-900/20 transition-all text-center">
                            <span className="text-sm font-bold text-red-600 dark:text-red-400">Team 2</span>
                            <p className="text-[10px] text-gray-400 mt-0.5">Tegenstanders</p>
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Change winning team */}
                    {winningTeam && (
                      <button onClick={() => setWinningTeam(null)} className="w-full text-center text-xs text-gray-400 hover:text-gray-600 transition-colors py-1">
                        Winnend team wijzigen
                      </button>
                    )}
                  </>
                )}

                {/* Success message */}
                {scoreSaved && (
                  <div className="text-center py-4">
                    <span className="text-4xl">✅</span>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400 mt-2">Score opgeslagen!</p>
                    <p className="text-sm text-gray-400 mt-1">Leaderboard is bijgewerkt</p>
                  </div>
                )}
              </div>

              {/* Save Button */}
              {allSelected && hasWinner && !scoreSaved && (
                <div className="p-5 border-t border-gray-100 dark:border-gray-700">
                  <button
                    onClick={() => {
                      if (gameMode === '1v1') {
                        handleAddBierpongGame(selectedPlayers, selectedWinnerIds);
                      } else {
                        // 2v2: save as 1 match with both winners
                        const winners = winningTeam === 'team1' ? team1 : team2;
                        const allPlayersDuo = [...team1, ...team2];
                        handleAddBierpongGame(allPlayersDuo, winners);
                      }
                      setScoreSaved(true);
                      setTimeout(() => setShowScoreModal(false), 1200);
                    }}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-green-500/20 transition-colors"
                  >
                    <span className="material-icons-round text-lg">save</span>
                    Score Opslaan
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
