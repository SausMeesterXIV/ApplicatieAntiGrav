import React, { useState, useMemo } from 'react';
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
  const { bierpongGames, users } = useOutletContext<AppContextType>();
  const [showAllLeaders, setShowAllLeaders] = useState(false);

  const leaderboard = useMemo(() => {
    const playerStats: { [key: string]: { gamesPlayed: number; wins: number } } = {};

    bierpongGames.forEach(game => {
      game.playerIds.forEach(playerId => {
        if (!playerStats[playerId]) {
          playerStats[playerId] = { gamesPlayed: 0, wins: 0 };
        }
        playerStats[playerId].gamesPlayed++;
      });
      if (playerStats[game.winnerId]) {
        playerStats[game.winnerId].wins++;
      }
    });

    const calculatedLeaderboard: BierpongLeaderboardEntry[] = Object.keys(playerStats).map(userId => {
      const stats = playerStats[userId];
      const winRatio = stats.gamesPlayed > 0 ? (stats.wins / stats.gamesPlayed) : 0;
      return {
        userId,
        gamesPlayed: stats.gamesPlayed,
        wins: stats.wins,
        winRatio,
      };
    });

    // Sort by games played (descending) first
    calculatedLeaderboard.sort((a, b) => b.gamesPlayed - a.gamesPlayed);

    // Take top 10 by games played, then re-sort by win ratio (descending)
    const top10ByGamesPlayed = calculatedLeaderboard.slice(0, 10);
    top10ByGamesPlayed.sort((a, b) => b.winRatio - a.winRatio);

    // Combine top 10 with remaining leaders (sorted by games played)
    const remainingLeaders = calculatedLeaderboard.slice(10).sort((a, b) => b.gamesPlayed - a.gamesPlayed);

    return [...top10ByGamesPlayed, ...remainingLeaders];
  }, [bierpongGames]);

  const leadersToDisplay = showAllLeaders ? leaderboard : leaderboard.slice(0, 10);

  const getUserName = (userId: string) => users.find(u => u.id === userId)?.nickname || users.find(u => u.id === userId)?.name || 'Onbekend';

  return (
    <div className="flex flex-col min-h-screen bg-gray-50 dark:bg-[#0f172a] text-gray-900 dark:text-white font-sans transition-colors duration-200">
      <header className="px-4 py-4 flex items-center gap-4 sticky top-0 bg-gray-50/80 dark:bg-[#0f172a]/80 backdrop-blur-md z-10 transition-colors border-b border-gray-200/50 dark:border-gray-800/50">
        <ChevronBack onClick={() => navigate(-1)} />
        <div>
          <h1 className="text-2xl font-bold leading-tight tracking-tight">Bierpong</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Top {showAllLeaders ? leaderboard.length : 10} Leiding</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-24 overflow-y-auto space-y-6">
        <section>
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-3">Stand</h2>
          <div className="bg-white dark:bg-[#1e293b] rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {leadersToDisplay.map((leader, index) => (
              <div key={leader.userId} className="flex items-center justify-between p-4">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-lg text-gray-700 dark:text-gray-200 w-6 text-center">{index + 1}.</span>
                  <p className="font-semibold text-gray-900 dark:text-white text-base">{getUserName(leader.userId)}</p>
                </div>
                <div className="flex flex-col items-end">
                  <span className="font-bold text-primary dark:text-blue-400 text-lg">{(leader.winRatio * 100).toFixed(0)}%</span>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{leader.gamesPlayed} gespeeld</span>
                </div>
              </div>
            ))}
          </div>
          {!showAllLeaders && leaderboard.length > 10 && (
            <button
              onClick={() => setShowAllLeaders(true)}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-xl transition-colors"
            >
              Alles bekijken
            </button>
          )}
        </section>
      </main>
    </div>
  );
};
