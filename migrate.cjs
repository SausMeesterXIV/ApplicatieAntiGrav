const fs = require('fs');
const path = require('path');

const mapping = {
  // Auth
  currentUser: 'useAuth', setCurrentUser: 'useAuth', users: 'useAuth', setUsers: 'useAuth',
  availableRoles: 'useAuth', setAvailableRoles: 'useAuth', handleSaveRoles: 'useAuth', loading: 'useAuth',

  // Drink
  drinks: 'useDrink', setDrinks: 'useDrink', streaks: 'useDrink', setStreaks: 'useDrink',
  balance: 'useDrink', setBalance: 'useDrink', activePeriod: 'useDrink', setActivePeriod: 'useDrink',
  billingPeriods: 'useDrink', setBillingPeriods: 'useDrink', stockItems: 'useDrink',
  setStockItems: 'useDrink', gsheetId: 'useDrink', setGsheetId: 'useDrink',
  gsheetSharingEmail: 'useDrink', setGsheetSharingEmail: 'useDrink', syncToGoogleSheets: 'useDrink',
  handleAddCost: 'useDrink', handleDeleteStreak: 'useDrink', handleQuickStreep: 'useDrink',

  // Fries
  fryItems: 'useFries', setFryItems: 'useFries', friesOrders: 'useFries', setFriesOrders: 'useFries',
  friesSessionStatus: 'useFries', setFriesSessionStatus: 'useFries', friesPickupTime: 'useFries',
  setFriesPickupTime: 'useFries', frituurSessieId: 'useFries', handlePlaceFryOrder: 'useFries',
  handleRemoveFryOrder: 'useFries', handleArchiveFriesSession: 'useFries',
  handleCompleteFriesPayment: 'useFries', handleAddFryItem: 'useFries', handleUpdateFryItem: 'useFries',
  handleDeleteFryItem: 'useFries',

  // Agenda
  countdowns: 'useAgenda', setCountdowns: 'useAgenda', handleSaveCountdowns: 'useAgenda',
  events: 'useAgenda', setEvents: 'useAgenda', handleSaveEvent: 'useAgenda', handleDeleteEvent: 'useAgenda',
  bierpongGames: 'useAgenda', setBierpongGames: 'useAgenda', handleAddBierpongGame: 'useAgenda',
  duoBierpongWinners: 'useAgenda', setDuoBierpongWinners: 'useAgenda', quotes: 'useAgenda',
  setQuotes: 'useAgenda', handleVoteQuote: 'useAgenda', handleAddQuote: 'useAgenda',
  handleDeleteQuote: 'useAgenda', notifications: 'useAgenda', setNotifications: 'useAgenda',
  handleAddNotification: 'useAgenda', handleMarkNotificationAsRead: 'useAgenda',
};

const aliases = {
  drinks: 'dranken',
  friesOrders: 'fryOrders',
  handleDeleteStreak: 'handleRemoveCost',
};

function getFiles(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach(file => {
    file = dir + '/' + file;
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) { 
      results = results.concat(getFiles(file));
    } else { 
      if (file.endsWith('.tsx')) results.push(file);
    }
  });
  return results;
}

const files = getFiles('src/screens');
let count = 0;

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (content.includes('useOutletContext')) {
    content = content.replace(/import\s+\{\s*AppContextType\s*\}\s+from\s+['"]\.\.\/App['"];?\n?/, '');
    content = content.replace(/import\s+\{\s*useOutletContext\s*\}\s+from\s+['"]react-router-dom['"];?\n?/, '');

    const regex = /const\s+\{\s*([^}]+)\s*}\s*=\s*useOutletContext<(?:AppContextType|any)>\(\);/g;
    const matches = [...content.matchAll(regex)];

    matches.forEach(match => {
      let replacement = '';
      const vars = match[1].split(',').map(s => s.trim()).filter(Boolean);
      
      let needAuth = false, needDrink = false, needFries = false, needAgenda = false;
      const authVars = [], drinkVars = [], friesVars = [], agendaVars = [];
      let hasFriesSpecial = false;

      vars.forEach(v => {
        let cleanV = v.split(':')[0].trim();
        let hook = mapping[cleanV];
        let aliasV = v;

        if (cleanV in aliases) {
            aliasV = v.includes(':') ? v : `${aliases[cleanV]} : ${cleanV}`;
        }

        if (['friesSessionStatus', 'friesPickupTime', 'frituurSessieId'].includes(cleanV)) {
           hasFriesSpecial = true;
           needFries = true;
        } else {
           if (hook === 'useAuth') { needAuth = true; authVars.push(aliasV); }
           else if (hook === 'useDrink') { needDrink = true; drinkVars.push(aliasV); }
           else if (hook === 'useFries') { needFries = true; friesVars.push(aliasV); }
           else if (hook === 'useAgenda') { needAgenda = true; agendaVars.push(aliasV); }
        }
      });

      const unq = arr => Array.from(new Set(arr)).join(', ');

      if (needAuth && authVars.length > 0) replacement += `  const { ${unq(authVars)} } = useAuth();\n`;
      if (needDrink && drinkVars.length > 0) replacement += `  const { ${unq(drinkVars)} } = useDrink();\n`;
      if (needFries && friesVars.length > 0) replacement += `  const { ${unq(friesVars)} } = useFries();\n`;
      if (needAgenda && agendaVars.length > 0) replacement += `  const { ${unq(agendaVars)} } = useAgenda();\n`;

      if (hasFriesSpecial) {
          replacement += `  const activeFrituurSession = useFries().activeFrituurSession;\n`;
          replacement += `  const friesSessionStatus = activeFrituurSession?.status || 'closed';\n`;
          replacement += `  const friesPickupTime = activeFrituurSession?.pickupTime || null;\n`;
          replacement += `  const frituurSessieId = activeFrituurSession?.id || null;\n`;
      }

      content = content.replace(match[0], replacement.trimEnd());

      let importsToAdd = '';
      if (needAuth) importsToAdd += `import { useAuth } from '../contexts/AuthContext';\n`;
      if (needDrink) importsToAdd += `import { useDrink } from '../contexts/DrinkContext';\n`;
      if (needFries) importsToAdd += `import { useFries } from '../contexts/FriesContext';\n`;
      if (needAgenda) importsToAdd += `import { useAgenda } from '../contexts/AgendaContext';\n`;

      content = content.replace(/(import React[^;]*;\n)/, `$1${importsToAdd}`);
    });

    fs.writeFileSync(file, content);
    count++;
    console.log(`Migrated ${file}`);
  }
});
console.log(`Successfully migrated ${count} files.`);
