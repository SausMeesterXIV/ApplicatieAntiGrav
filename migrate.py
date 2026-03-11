import glob
import os
import re

mapping = {
  'currentUser': 'useAuth', 'setCurrentUser': 'useAuth', 'users': 'useAuth', 'setUsers': 'useAuth',
  'availableRoles': 'useAuth', 'setAvailableRoles': 'useAuth', 'handleSaveRoles': 'useAuth', 'loading': 'useAuth',

  'drinks': 'useDrink', 'setDrinks': 'useDrink', 'streaks': 'useDrink', 'setStreaks': 'useDrink',
  'balance': 'useDrink', 'setBalance': 'useDrink', 'activePeriod': 'useDrink', 'setActivePeriod': 'useDrink',
  'billingPeriods': 'useDrink', 'setBillingPeriods': 'useDrink', 'stockItems': 'useDrink',
  'setStockItems': 'useDrink', 'gsheetId': 'useDrink', 'setGsheetId': 'useDrink',
  'gsheetSharingEmail': 'useDrink', 'setGsheetSharingEmail': 'useDrink', 'syncToGoogleSheets': 'useDrink',
  'handleAddCost': 'useDrink', 'handleDeleteStreak': 'useDrink', 'handleQuickStreep': 'useDrink',

  'fryItems': 'useFries', 'setFryItems': 'useFries', 'friesOrders': 'useFries', 'setFriesOrders': 'useFries',
  'friesSessionStatus': 'useFries', 'setFriesSessionStatus': 'useFries', 'friesPickupTime': 'useFries',
  'setFriesPickupTime': 'useFries', 'frituurSessieId': 'useFries', 'handlePlaceFryOrder': 'useFries',
  'handleRemoveFryOrder': 'useFries', 'handleArchiveFriesSession': 'useFries',
  'handleCompleteFriesPayment': 'useFries', 'handleAddFryItem': 'useFries', 'handleUpdateFryItem': 'useFries',
  'handleDeleteFryItem': 'useFries',

  'countdowns': 'useAgenda', 'setCountdowns': 'useAgenda', 'handleSaveCountdowns': 'useAgenda',
  'events': 'useAgenda', 'setEvents': 'useAgenda', 'handleSaveEvent': 'useAgenda', 'handleDeleteEvent': 'useAgenda',
  'bierpongGames': 'useAgenda', 'setBierpongGames': 'useAgenda', 'handleAddBierpongGame': 'useAgenda',
  'duoBierpongWinners': 'useAgenda', 'setDuoBierpongWinners': 'useAgenda', 'quotes': 'useAgenda',
  'setQuotes': 'useAgenda', 'handleVoteQuote': 'useAgenda', 'handleAddQuote': 'useAgenda',
  'handleDeleteQuote': 'useAgenda', 'notifications': 'useAgenda', 'setNotifications': 'useAgenda',
  'handleAddNotification': 'useAgenda', 'handleMarkNotificationAsRead': 'useAgenda',
}

aliases = {
  'drinks': 'dranken',
  'friesOrders': 'fryOrders',
  'handleDeleteStreak': 'handleRemoveCost',
}

files = glob.glob('src/screens/**/*.tsx', recursive=True)
count = 0

for filepath in files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    if 'useOutletContext' in content:
        # Remove old imports
        content = re.sub(r"import\s+\{\s*AppContextType\s*\}\s+from\s+['\"]\.\.\/App['\"];?\n?", "", content)
        content = re.sub(r"import\s+\{\s*useOutletContext\s*\}\s+from\s+['\"]react-router-dom['\"];?\n?", "", content)

        # Match useOutletContext object destructuring. Handles multi-line!
        match = re.search(r"const\s+\{([^}]+)\}\s*=\s*useOutletContext<(?:AppContextType|any)>\(\);", content)
        if match:
            vars_str = match.group(1)
            var_list = [v.strip() for v in vars_str.split(',') if v.strip()]
            
            need_auth = False
            need_drink = False
            need_fries = False
            need_agenda = False
            
            auth_vars = []
            drink_vars = []
            fries_vars = []
            agenda_vars = []
            has_fries_special = False
            
            for var in var_list:
                clean_v = var.split(':')[0].strip()
                hook = mapping.get(clean_v, '')
                
                # Handling property renaming like handleRemoveCost: handleDeleteStreak
                alias_v = var
                if clean_v in aliases:
                   if ':' not in var:
                       alias_v = f"{aliases[clean_v]} : {clean_v}"
                
                if clean_v in ['friesSessionStatus', 'friesPickupTime', 'frituurSessieId']:
                    has_fries_special = True
                    need_fries = True
                else:
                    if hook == 'useAuth':
                        need_auth = True
                        auth_vars.append(alias_v)
                    elif hook == 'useDrink':
                        need_drink = True
                        drink_vars.append(alias_v)
                    elif hook == 'useFries':
                        need_fries = True
                        fries_vars.append(alias_v)
                    elif hook == 'useAgenda':
                        need_agenda = True
                        agenda_vars.append(alias_v)

            replacement = ''
            if need_auth and auth_vars: replacement += f"  const {{ {', '.join(list(dict.fromkeys(auth_vars)))} }} = useAuth();\n"
            if need_drink and drink_vars: replacement += f"  const {{ {', '.join(list(dict.fromkeys(drink_vars)))} }} = useDrink();\n"
            if need_fries and fries_vars: replacement += f"  const {{ {', '.join(list(dict.fromkeys(fries_vars)))} }} = useFries();\n"
            if need_agenda and agenda_vars: replacement += f"  const {{ {', '.join(list(dict.fromkeys(agenda_vars)))} }} = useAgenda();\n"
            
            if has_fries_special:
                replacement += "  const activeFrituurSession = useFries().activeFrituurSession;\n"
                replacement += "  const friesSessionStatus = activeFrituurSession?.status || 'closed';\n"
                replacement += "  const friesPickupTime = activeFrituurSession?.pickupTime || null;\n"
                replacement += "  const frituurSessieId = activeFrituurSession?.id || null;\n"
            
            content = content.replace(match.group(0), replacement.rstrip())
            
            # Add imports at top
            imports = ''
            if need_auth: imports += "import { useAuth } from '../contexts/AuthContext';\n"
            if need_drink: imports += "import { useDrink } from '../contexts/DrinkContext';\n"
            if need_fries: imports += "import { useFries } from '../contexts/FriesContext';\n"
            if need_agenda: imports += "import { useAgenda } from '../contexts/AgendaContext';\n"
            
            content = re.sub(r"(import React[^;]*;\n)", r"\1" + imports, content, count=1)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            count += 1
            print(f"Migrated {filepath}")

print(f"Successfully migrated {count} files.")
