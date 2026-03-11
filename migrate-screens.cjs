const fs = require('fs');
const glob = require('glob');

const mapping = {
  // Auth
  currentUser: 'useAuth',
  setCurrentUser: 'useAuth',
  users: 'useAuth',
  setUsers: 'useAuth',
  availableRoles: 'useAuth',
  setAvailableRoles: 'useAuth',
  handleSaveRoles: 'useAuth',

  // Drink
  drinks: 'useDrink',
  setDrinks: 'useDrink',
  streaks: 'useDrink',
  setStreaks: 'useDrink',
  balance: 'useDrink',
  setBalance: 'useDrink',
  activePeriod: 'useDrink',
  setActivePeriod: 'useDrink',
  billingPeriods: 'useDrink',
  setBillingPeriods: 'useDrink',
  stockItems: 'useDrink',
  setStockItems: 'useDrink',
  gsheetId: 'useDrink',
  setGsheetId: 'useDrink',
  gsheetSharingEmail: 'useDrink',
  setGsheetSharingEmail: 'useDrink',
  syncToGoogleSheets: 'useDrink',
  handleAddCost: 'useDrink',
  handleDeleteStreak: 'useDrink',
  handleQuickStreep: 'useDrink',

  // Fries
  fryItems: 'useFries',
  setFryItems: 'useFries',
  friesOrders: 'useFries',
  setFriesOrders: 'useFries',
  friesSessionStatus: 'useFries',
  setFriesSessionStatus: 'useFries',
  friesPickupTime: 'useFries',
  setFriesPickupTime: 'useFries',
  frituurSessieId: 'useFries',
  handlePlaceFryOrder: 'useFries',
  handleRemoveFryOrder: 'useFries',
  handleArchiveFriesSession: 'useFries',
  handleCompleteFriesPayment: 'useFries',
  handleAddFryItem: 'useFries',
  handleUpdateFryItem: 'useFries',
  handleDeleteFryItem: 'useFries',

  // Agenda
  countdowns: 'useAgenda',
  setCountdowns: 'useAgenda',
  handleSaveCountdowns: 'useAgenda',
  events: 'useAgenda',
  setEvents: 'useAgenda',
  handleSaveEvent: 'useAgenda',
  handleDeleteEvent: 'useAgenda',
  bierpongGames: 'useAgenda',
  setBierpongGames: 'useAgenda',
  handleAddBierpongGame: 'useAgenda',
  duoBierpongWinners: 'useAgenda',
  setDuoBierpongWinners: 'useAgenda',
  quotes: 'useAgenda',
  setQuotes: 'useAgenda',
  handleVoteQuote: 'useAgenda',
  handleAddQuote: 'useAgenda',
  handleDeleteQuote: 'useAgenda',
  notifications: 'useAgenda',
  setNotifications: 'useAgenda',
  handleAddNotification: 'useAgenda',
  handleMarkNotificationAsRead: 'useAgenda',
};

const aliases = {
  drinks: 'dranken as drinks',
  friesOrders: 'fryOrders as friesOrders',
  handleDeleteStreak: 'handleRemoveCost as handleDeleteStreak',
};

glob('src/screens/**/*.tsx', (err, files) => {
  if (err) throw err;
  let count = 0;

  files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    
    // Check if it uses useOutletContext
    if (content.includes('useOutletContext<AppContextType>') || content.includes('useOutletContext<any>')) {
      
      // 1. Remove context import
      content = content.replace(/import\s+{\s*AppContextType\s*}\s+from\s+['"]\.\.\/App['"];?\n?/, '');
      content = content.replace(/import\s+{\s*useOutletContext\s*}\s+from\s+['"]react-router-dom['"];?\n?/, '');

      // 2. Extract the destructured variables
      const regex = /const\s+{\s*([^}]+)\s*}\s*=\s*useOutletContext<(?:AppContextType|any)>\(\);/g;
      
      const allMatches = [...content.matchAll(regex)];
      allMatches.forEach(match => {
        let replacement = '';
        const vars = match[1].split(',').map(s => s.trim()).filter(Boolean);
        
        let needAuth = false;
        let needDrink = false;
        let needFries = false;
        let needAgenda = false;

        const authVars = [];
        const drinkVars = [];
        const friesVars = [];
        const agendaVars = [];
        let hasFriesSpecial = false;

        vars.forEach(v => {
          let cleanV = v.split(':')[0].trim();
          let hook = mapping[cleanV];
          
          let aliasV = aliases[cleanV] ? aliases[cleanV] : v;

          if (['friesSessionStatus', 'friesPickupTime', 'frituurSessieId'].includes(cleanV)) {
             aliasV = 'activeFrituurSession';
             needFries = true;
             hasFriesSpecial = true;
          } else if (cleanV === 'loading') { // loading is everywhere, let's just pluck it from Auth for now
             needAuth = true;
             authVars.push('loading');
          } else {
             if (hook === 'useAuth') { needAuth = true; authVars.push(aliasV); }
             else if (hook === 'useDrink') { needDrink = true; drinkVars.push(aliasV); }
             else if (hook === 'useFries') { needFries = true; friesVars.push(aliasV); }
             else if (hook === 'useAgenda') { needAgenda = true; agendaVars.push(aliasV); }
          }
        });

        const unq = arr => [...new Set(arr)].join(', ');

        if (needAuth) replacement += `  const { ${unq(authVars)} } = useAuth();\n`;
        if (needDrink) replacement += `  const { ${unq(drinkVars)} } = useDrink();\n`;
        if (needFries) replacement += `  const { ${unq(friesVars)} } = useFries();\n`;
        if (needAgenda) replacement += `  const { ${unq(agendaVars)} } = useAgenda();\n`;

        if (hasFriesSpecial) {
            replacement += `  const friesSessionStatus = activeFrituurSession?.status || 'closed';\n`;
            replacement += `  const friesPickupTime = activeFrituurSession?.pickupTime || null;\n`;
            replacement += `  const frituurSessieId = activeFrituurSession?.id || null;\n`;
        }

        content = content.replace(match[0], replacement.trimEnd());

        // 3. Add necessary imports
        let importsToAdd = '';
        if (needAuth) importsToAdd += `import { useAuth } from '../contexts/AuthContext';\n`;
        if (needDrink) importsToAdd += `import { useDrink } from '../contexts/DrinkContext';\n`;
        if (needFries) importsToAdd += `import { useFries } from '../contexts/FriesContext';\n`;
        if (needAgenda) importsToAdd += `import { useAgenda } from '../contexts/AgendaContext';\n`;

        content = content.replace(/import React[^;]*;\n/, `$&${importsToAdd}`);
      });

      fs.writeFileSync(file, content);
      count++;
      console.log(`Migrated ${file}`);
    }
  });

  console.log(`Successfully migrated ${count} files.`);
});
