import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { AppContextType } from '../App';
import * as db from '../lib/supabaseService';
import { supabase } from '../lib/supabase';
import { showToast } from '../components/Toast';

type SheetTab = 'consumpties' | 'dranken' | 'leden';
type CellKey = string; // "row-col"

const COL_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export const TeamDrankExcelBeheerScreen: React.FC = () => {
    const navigate = useNavigate();
    const {
        streaks, setStreaks, users, setUsers, drinks, setDrinks,
        activePeriod, setActivePeriod, billingPeriods, gsheetId, syncToGoogleSheets
    } = useOutletContext<AppContextType>();
    const [activeSheet, setActiveSheet] = useState<SheetTab>('consumpties');
    const [selectedCell, setSelectedCell] = useState<CellKey | null>(null);
    const [editingCell, setEditingCell] = useState<CellKey | null>(null);
    const [editValue, setEditValue] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [filterPeriod, setFilterPeriod] = useState<'active' | 'all'>('active');
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const tableRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (editingCell && inputRef.current) {
            inputRef.current.focus();
            inputRef.current.select();
        }
    }, [editingCell]);

    // ===== CONSUMPTIES DATA =====
    const consumptiesData = useMemo(() => {
        let data = [...streaks];
        if (filterPeriod === 'active' && activePeriod) {
            data = data.filter(s => s.period_id === activePeriod.id);
        }
        const enriched = data.map(streak => {
            const user = users.find(u => u.id === streak.userId);
            const drink = drinks.find(d => String(d.id) === String(streak.drinkId));
            return {
                ...streak,
                userName: streak.userName || user?.naam || user?.name || 'Onbekend',
                drinkName: drink?.name || streak.drinkName || 'Onbekend',
            };
        });
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            return enriched.filter(item =>
                item.userName.toLowerCase().includes(lower) ||
                item.drinkName.toLowerCase().includes(lower)
            ).sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
        }
        return enriched.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    }, [streaks, filterPeriod, activePeriod, users, drinks, searchTerm]);

    const consumptiesColumns = ['Datum', 'Tijd', 'Persoon', 'Drank', 'Aantal', 'Prijs (€)', '🗑️'];
    const consumptiesGetCellValue = (rowIdx: number, colIdx: number): string => {
        const item = consumptiesData[rowIdx];
        if (!item) return '';
        switch (colIdx) {
            case 0: return item.timestamp.toLocaleDateString('nl-BE');
            case 1: return item.timestamp.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
            case 2: return item.userName;
            case 3: return item.drinkName;
            case 4: return String(item.amount);
            case 5: return item.price.toFixed(2).replace('.', ',');
            case 6: return '×';
            default: return '';
        }
    };
    const consumptiesIsEditable = (_row: number, col: number): boolean => col === 4; // Only amount is editable
    const consumptiesIsDelete = (_row: number, col: number): boolean => col === 6;

    // ===== DRANKEN DATA =====
    const drankenData = useMemo(() => {
        let data = [...drinks];
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(d => d.name.toLowerCase().includes(lower));
        }
        return data.sort((a, b) => a.name.localeCompare(b.name));
    }, [drinks, searchTerm]);

    const drankenColumns = ['ID', 'Naam', 'Prijs (€)', 'Categorie', 'Tijdelijk', 'Status'];
    const drankenGetCellValue = (rowIdx: number, colIdx: number): string => {
        const item = drankenData[rowIdx];
        if (!item) return '';
        switch (colIdx) {
            case 0: return String(item.id);
            case 1: return item.name;
            case 2: return item.price.toFixed(2).replace('.', ',');
            case 3: return item.categorie || 'bier';
            case 4: return item.isTemporary ? 'Ja' : 'Nee';
            case 5: return item.validUntil ? `tot ${new Date(item.validUntil).toLocaleDateString('nl-BE')}` : 'Actief';
            default: return '';
        }
    };
    const drankenIsEditable = (_row: number, col: number): boolean => col === 1 || col === 2;

    // ===== LEDEN DATA =====
    const ledenData = useMemo(() => {
        let data = [...users];
        if (searchTerm) {
            const lower = searchTerm.toLowerCase();
            data = data.filter(u => (u.naam || u.name || '').toLowerCase().includes(lower));
        }
        return data.sort((a, b) => (a.naam || a.name || '').localeCompare(b.naam || b.name || ''));
    }, [users, searchTerm]);

    const ledenColumns = ['Naam', 'Nickname', 'E-mail', 'Rol', 'Rollen', 'Actief'];
    const ledenGetCellValue = (rowIdx: number, colIdx: number): string => {
        const item = ledenData[rowIdx];
        if (!item) return '';
        switch (colIdx) {
            case 0: return item.naam || item.name || '';
            case 1: return item.nickname || '';
            case 2: return item.email || '';
            case 3: return item.rol || 'standaard';
            case 4: return (item.roles || []).join(', ') || '—';
            case 5: return item.actief !== false ? 'Ja' : 'Nee';
            default: return '';
        }
    };
    const ledenIsEditable = (_row: number, col: number): boolean => col === 0 || col === 1;

    // ===== GENERIC HELPERS =====
    const getColumns = () => {
        switch (activeSheet) {
            case 'consumpties': return consumptiesColumns;
            case 'dranken': return drankenColumns;
            case 'leden': return ledenColumns;
        }
    };
    const getRowCount = () => {
        switch (activeSheet) {
            case 'consumpties': return consumptiesData.length;
            case 'dranken': return drankenData.length;
            case 'leden': return ledenData.length;
        }
    };
    const getCellValue = (row: number, col: number) => {
        switch (activeSheet) {
            case 'consumpties': return consumptiesGetCellValue(row, col);
            case 'dranken': return drankenGetCellValue(row, col);
            case 'leden': return ledenGetCellValue(row, col);
        }
    };
    const isEditable = (row: number, col: number) => {
        switch (activeSheet) {
            case 'consumpties': return consumptiesIsEditable(row, col);
            case 'dranken': return drankenIsEditable(row, col);
            case 'leden': return ledenIsEditable(row, col);
        }
    };

    const cellKey = (row: number, col: number) => `${row}-${col}`;

    const handleCellClick = (row: number, col: number) => {
        const key = cellKey(row, col);
        setSelectedCell(key);

        // Handle delete button for consumpties
        if (activeSheet === 'consumpties' && consumptiesIsDelete(row, col)) {
            handleDeleteConsumptie(row);
            return;
        }

        if (isEditable(row, col)) {
            setEditingCell(key);
            setEditValue(getCellValue(row, col));
        } else {
            setEditingCell(null);
        }
    };

    const handleDeleteConsumptie = async (rowIdx: number) => {
        const item = consumptiesData[rowIdx];
        if (!item) return;
        if (!window.confirm(`${item.userName} — ${item.amount}x ${item.drinkName} verwijderen?`)) return;

        setIsSaving(true);
        try {
            await db.deleteConsumptie(item.id);
            setStreaks(prev => prev.filter(s => s.id !== item.id));
            showToast('Rij verwijderd', 'success');
        } catch {
            showToast('Fout bij verwijderen', 'error');
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveCell = useCallback(async () => {
        if (!editingCell) return;
        const [row, col] = editingCell.split('-').map(Number);
        const oldValue = getCellValue(row, col);
        if (editValue === oldValue) {
            setEditingCell(null);
            return;
        }

        setIsSaving(true);
        try {
            if (activeSheet === 'consumpties') {
                // Only amount (col 4) is editable
                const item = consumptiesData[row];
                if (!item) return;
                const newAmount = parseInt(editValue);
                if (isNaN(newAmount) || newAmount < 0) {
                    showToast('Ongeldig aantal', 'warning');
                    setEditValue(oldValue);
                    return;
                }
                // Delete old and add new with updated amount
                await db.deleteConsumptie(item.id);
                if (newAmount > 0) {
                    await db.addConsumptie(item.userId, String(item.drinkId), newAmount, item.period_id || undefined);
                }
                // Refresh consumpties
                const freshStreaks = await db.fetchConsumpties();
                setStreaks(freshStreaks);
                showToast('Aantal aangepast', 'success');
            } else if (activeSheet === 'dranken') {
                const item = drankenData[row];
                if (!item) return;
                if (col === 1) {
                    // Name
                    await db.updateDrank(item.id, editValue, item.price);
                    setDrinks(prev => prev.map(d => String(d.id) === String(item.id) ? { ...d, name: editValue } : d));
                    showToast('Naam aangepast', 'success');
                } else if (col === 2) {
                    // Price
                    const newPrice = parseFloat(editValue.replace(',', '.'));
                    if (isNaN(newPrice) || newPrice < 0) {
                        showToast('Ongeldige prijs', 'warning');
                        setEditValue(oldValue);
                        return;
                    }
                    await db.updateDrank(item.id, item.name, newPrice);
                    setDrinks(prev => prev.map(d => String(d.id) === String(item.id) ? { ...d, price: newPrice } : d));
                    showToast('Prijs aangepast', 'success');
                }
            } else if (activeSheet === 'leden') {
                const item = ledenData[row];
                if (!item) return;
                if (col === 0) {
                    await db.updateProfile(item.id, { naam: editValue });
                    setUsers(prev => prev.map(u => u.id === item.id ? { ...u, naam: editValue, name: editValue } : u));
                    showToast('Naam aangepast', 'success');
                } else if (col === 1) {
                    await db.updateProfile(item.id, { nickname: editValue });
                    setUsers(prev => prev.map(u => u.id === item.id ? { ...u, nickname: editValue } : u));
                    showToast('Nickname aangepast', 'success');
                }
            }

            // AFTER SUCCESSFUL DB SAVE: Sync to Google Sheets if configured
            if (gsheetId && activePeriod && activeSheet === 'consumpties') {
                await syncActiveTabToGoogleSheets();
            }
        } catch (error) {
            console.error(error);
            showToast('Fout bij opslaan', 'error');
        } finally {
            setIsSaving(false);
            setEditingCell(null);
        }
    }, [editingCell, editValue, activeSheet, consumptiesData, drankenData, ledenData, gsheetId, activePeriod]);

    const syncActiveTabToGoogleSheets = async () => {
        if (!gsheetId || !activePeriod) return;

        setIsSaving(true);
        try {
            let currentSheetId = activePeriod.gsheet_sheet_id;

            // 1. Ensure the sheet exists (named after the period)
            try {
                const res = await syncToGoogleSheets('add_sheet', {
                    spreadsheetId: gsheetId,
                    title: activePeriod.naam
                });
                
                // If it returned a sheetId, store it if we didn't have it
                if (res.sheetId && !currentSheetId) {
                    currentSheetId = String(res.sheetId);
                    await db.updateBillingPeriod(activePeriod.id, { gsheet_sheet_id: currentSheetId } as any);
                    // Update local state
                    setActivePeriod({ ...activePeriod, gsheet_sheet_id: currentSheetId });
                }
            } catch (err: any) {
                console.log('Sheet existence check/creation note:', err);
            }

            // 2. Prepare data for the current active sheet
            const values: string[][] = [];

            if (activeSheet === 'consumpties') {
                // FETCH FRESH FROM DATABASE VIA JOIN INSTEAD OF LOCAL TABLE STATE
                const { data: rawData, error } = await supabase
                    .from('consumpties')
                    .select(`
                        aantal,
                        datum,
                        dranken ( naam, prijs ),
                        profiles ( naam ) 
                    `)
                    .eq('period_id', activePeriod.id)
                    .order('datum', { ascending: false });

                if (error) throw error;

                // Headers without delete bin
                values.push(['Datum', 'Tijd', 'Persoon', 'Drank', 'Aantal', 'Prijs (€)']);
                
                // Rows
                for (const row of (rawData || [])) {
                    const d = new Date(row.datum);
                    values.push([
                        d.toLocaleDateString('nl-BE'),
                        d.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }),
                        (row.profiles as any)?.naam || 'Onbekend',
                        (row.dranken as any)?.naam || 'Onbekend',
                        String(row.aantal),
                        Number((row.dranken as any)?.prijs || 0).toFixed(2).replace('.', ',')
                    ]);
                }
            } else {
                // Dranken & Leden: from local table
                const cols = getColumns();
                values.push(cols);
                const rowsCount = getRowCount();

                for (let i = 0; i < rowsCount; i++) {
                    const row: string[] = [];
                    for (let j = 0; j < cols.length; j++) {
                        row.push(getCellValue(i, j));
                    }
                    values.push(row);
                }
            }

            // 3. Sync to the tab (using sheetId if available to handle renames)
            await syncToGoogleSheets('update_values', {
                spreadsheetId: gsheetId,
                sheetId: currentSheetId, // This allows the backend to find the sheet even if renamed
                range: currentSheetId ? 'A1' : `'${activePeriod.naam}'!A1`, // Fallback to name if ID unknown
                values
            });
            showToast('Google Sheet gesynchroniseerd!', 'success');
        } catch (err: any) {
            console.error('Sync error:', err);
            showToast('Google Sheet sync mislukt', 'warning');
        } finally {
            setIsSaving(false);
        }
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleSaveCell();
        } else if (e.key === 'Escape') {
            setEditingCell(null);
        }
    };

    const columns = getColumns();
    const rowCount = getRowCount();

    // Cell ref for the formula bar
    const selectedCellRef = useMemo(() => {
        if (!selectedCell) return '';
        const [row, col] = selectedCell.split('-').map(Number);
        return `${COL_LETTERS[col] || '?'}${row + 1}`;
    }, [selectedCell]);

    const selectedCellValue = useMemo(() => {
        if (!selectedCell) return '';
        const [row, col] = selectedCell.split('-').map(Number);
        return getCellValue(row, col);
    }, [selectedCell, activeSheet, consumptiesData, drankenData, ledenData]);

    return (
        <div className="flex flex-col h-screen bg-white dark:bg-[#1e293b] text-gray-900 dark:text-white font-sans overflow-hidden">
            {/* === EXCEL TITLE BAR === */}
            <header className="bg-[#217346] text-white h-[calc(2.5rem+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)] flex items-center px-3 gap-3 shrink-0 z-20 shadow-md">
                <button onClick={() => navigate(-1)} className="p-0.5 hover:bg-white/10 rounded transition-colors">
                    <span className="material-icons-round text-lg">arrow_back</span>
                </button>
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="material-icons-round text-lg">grid_on</span>
                    <span className="font-semibold text-sm truncate">KSA Drankbeheer — Excel Modus</span>
                </div>
                {gsheetId && (
                    <button
                        onClick={syncActiveTabToGoogleSheets}
                        disabled={isSaving}
                        className="bg-white/10 hover:bg-white/20 p-1 px-2 rounded text-[10px] font-bold border border-white/20 flex items-center gap-1 transition-all"
                    >
                        <span className="material-icons-round text-sm">sync</span>
                        SYNC NU
                    </button>
                )}
                {isSaving && (
                    <div className="flex items-center gap-1 text-green-200 text-[10px] animate-pulse">
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white"></div>
                        Bezig...
                    </div>
                )}
            </header>

            {/* === TOOLBAR RIBBON === */}
            <div className="bg-[#f3f3f3] dark:bg-[#2d3748] border-b border-gray-300 dark:border-gray-700 px-3 py-1.5 flex items-center gap-4 shrink-0 text-[11px]">
                {/* Period filter for consumpties */}
                {activeSheet === 'consumpties' && (
                    <div className="flex items-center gap-1 bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-600 rounded px-1.5">
                        <span className="material-icons-round text-gray-500 text-xs">filter_list</span>
                        <select
                            value={filterPeriod}
                            onChange={(e) => setFilterPeriod(e.target.value as 'active' | 'all')}
                            className="bg-transparent text-xs py-1 pr-4 appearance-none cursor-pointer focus:outline-none"
                        >
                            <option value="active">Huidige Periode</option>
                            <option value="all">Alle Periodes</option>
                        </select>
                    </div>
                )}
                <div className="flex items-center gap-1 flex-1 max-w-xs bg-white dark:bg-[#1e293b] border border-gray-300 dark:border-gray-600 rounded px-1.5">
                    <span className="material-icons-round text-gray-400 text-xs">search</span>
                    <input
                        type="text"
                        placeholder="Zoeken..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="bg-transparent text-xs py-1 flex-1 focus:outline-none min-w-0"
                    />
                    {searchTerm && (
                        <button onClick={() => setSearchTerm('')} className="text-gray-400 hover:text-gray-600">
                            <span className="material-icons-round text-xs">close</span>
                        </button>
                    )}
                </div>
                <div className="text-gray-500 dark:text-gray-400 whitespace-nowrap">
                    {rowCount} rijen
                </div>
            </div>

            {/* === FORMULA BAR === */}
            <div className="bg-white dark:bg-[#1e293b] border-b border-gray-300 dark:border-gray-700 flex items-center shrink-0 h-7">
                <div className="w-14 text-center text-xs font-bold text-gray-700 dark:text-gray-300 border-r border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 h-full flex items-center justify-center select-none">
                    {selectedCellRef || '—'}
                </div>
                <div className="flex-1 px-2 text-xs text-gray-600 dark:text-gray-400 truncate flex items-center h-full">
                    <span className="text-gray-400 mr-2 italic text-[10px]">fx</span>
                    {editingCell ? (
                        <span className="text-blue-600 dark:text-blue-400 font-medium">{editValue}</span>
                    ) : (
                        <span>{selectedCellValue}</span>
                    )}
                </div>
            </div>

            {/* === SPREADSHEET GRID === */}
            <div ref={tableRef} className="flex-1 overflow-auto bg-white dark:bg-[#0f172a]">
                <table className="border-collapse w-full" style={{ minWidth: '600px' }}>
                    <thead className="sticky top-0 z-10">
                        <tr>
                            {/* Row number header */}
                            <th className="w-10 min-w-[40px] bg-[#e6e6e6] dark:bg-[#374151] border border-[#c0c0c0] dark:border-[#4b5563] text-[10px] text-gray-600 dark:text-gray-400 font-normal select-none"></th>
                            {/* Column headers (A, B, C...) */}
                            {columns.map((colName, i) => (
                                <th
                                    key={i}
                                    className={`min-w-[90px] bg-[#e6e6e6] dark:bg-[#374151] border border-[#c0c0c0] dark:border-[#4b5563] text-[10px] font-medium text-gray-700 dark:text-gray-300 px-1 py-1 select-none ${selectedCell && parseInt(selectedCell.split('-')[1]) === i
                                        ? 'bg-[#c7dff1] dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold'
                                        : ''
                                        }`}
                                >
                                    <div className="text-[9px] text-gray-400 leading-none mb-0.5">{COL_LETTERS[i]}</div>
                                    <div className="leading-none">{colName}</div>
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody>
                        {rowCount > 0 ? (
                            Array.from({ length: rowCount }).map((_, rowIdx) => {
                                const isSelectedRow = selectedCell ? parseInt(selectedCell.split('-')[0]) === rowIdx : false;
                                return (
                                    <tr key={rowIdx}>
                                        {/* Row number */}
                                        <td className={`text-center text-[10px] font-normal select-none border border-[#c0c0c0] dark:border-[#4b5563] ${isSelectedRow
                                            ? 'bg-[#c7dff1] dark:bg-blue-900/40 text-blue-800 dark:text-blue-300 font-bold'
                                            : 'bg-[#e6e6e6] dark:bg-[#374151] text-gray-500 dark:text-gray-400'
                                            }`}>
                                            {rowIdx + 1}
                                        </td>
                                        {/* Data cells */}
                                        {columns.map((_, colIdx) => {
                                            const key = cellKey(rowIdx, colIdx);
                                            const isSelected = selectedCell === key;
                                            const isEditing = editingCell === key;
                                            const editable = isEditable(rowIdx, colIdx);
                                            const isDeleteBtn = activeSheet === 'consumpties' && consumptiesIsDelete(rowIdx, colIdx);
                                            const value = getCellValue(rowIdx, colIdx);

                                            return (
                                                <td
                                                    key={colIdx}
                                                    onClick={() => handleCellClick(rowIdx, colIdx)}
                                                    className={`relative px-1.5 py-0.5 text-xs border cursor-default transition-colors ${isSelected
                                                        ? 'border-[#4472C4] dark:border-blue-500 border-2 bg-[#d6e6f7] dark:bg-blue-900/20 z-[5]'
                                                        : 'border-[#d4d4d4] dark:border-[#374151] bg-white dark:bg-[#1e293b]'
                                                        } ${editable ? 'cursor-cell' : ''} ${isDeleteBtn ? 'cursor-pointer' : ''}`}
                                                >
                                                    {isEditing ? (
                                                        <input
                                                            ref={inputRef}
                                                            type="text"
                                                            value={editValue}
                                                            onChange={(e) => setEditValue(e.target.value)}
                                                            onBlur={handleSaveCell}
                                                            onKeyDown={handleKeyDown}
                                                            className="w-full bg-transparent border-none outline-none text-xs font-medium text-blue-700 dark:text-blue-300 p-0 m-0"
                                                        />
                                                    ) : isDeleteBtn ? (
                                                        <div className="flex items-center justify-center">
                                                            <span className="text-red-400 hover:text-red-600 dark:text-red-500 dark:hover:text-red-300 text-sm font-bold transition-colors">✕</span>
                                                        </div>
                                                    ) : (
                                                        <span className={`block truncate ${editable ? 'text-gray-900 dark:text-white' : 'text-gray-600 dark:text-gray-400'
                                                            } ${colIdx >= 4 && activeSheet === 'consumpties' ? 'text-right' : ''} ${colIdx === 2 && activeSheet === 'dranken' ? 'text-right' : ''}`}>
                                                            {value}
                                                            {editable && isSelected && !isEditing && (
                                                                <span className="ml-1 text-[8px] text-blue-400 align-middle">✎</span>
                                                            )}
                                                        </span>
                                                    )}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                );
                            })
                        ) : (
                            <tr>
                                <td colSpan={columns.length + 1} className="text-center py-12 text-gray-400 text-xs border border-[#d4d4d4] dark:border-[#374151]">
                                    Geen data gevonden.
                                </td>
                            </tr>
                        )}
                        {/* Extra empty rows to make it look like Excel */}
                        {Array.from({ length: Math.max(0, 8 - rowCount) }).map((_, i) => (
                            <tr key={`empty-${i}`}>
                                <td className="bg-[#e6e6e6] dark:bg-[#374151] border border-[#c0c0c0] dark:border-[#4b5563] text-center text-[10px] text-gray-400">{rowCount + i + 1}</td>
                                {columns.map((_, colIdx) => (
                                    <td key={colIdx} className="border border-[#d4d4d4] dark:border-[#374151] bg-white dark:bg-[#1e293b] h-6"></td>
                                ))}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            {/* === SHEET TABS (Like real Excel tabs at the bottom) === */}
            <div className="bg-[#e6e6e6] dark:bg-[#1e293b] border-t border-gray-300 dark:border-gray-700 flex items-end shrink-0 h-9 z-20">
                <div className="flex items-end gap-0.5 px-1 h-full">
                    {/* Tab: Consumpties */}
                    <button
                        onClick={() => { setActiveSheet('consumpties'); setSelectedCell(null); setEditingCell(null); setSearchTerm(''); }}
                        className={`px-4 py-1.5 text-[11px] font-medium rounded-t-md border border-b-0 transition-colors ${activeSheet === 'consumpties'
                            ? 'bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 -mb-px'
                            : 'bg-[#d9d9d9] dark:bg-[#374151] text-gray-600 dark:text-gray-400 border-transparent hover:bg-[#cfcfcf] dark:hover:bg-[#4b5563]'
                            }`}
                    >
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block"></span>
                            Consumpties
                        </span>
                    </button>

                    {/* Tab: Dranken */}
                    <button
                        onClick={() => { setActiveSheet('dranken'); setSelectedCell(null); setEditingCell(null); setSearchTerm(''); }}
                        className={`px-4 py-1.5 text-[11px] font-medium rounded-t-md border border-b-0 transition-colors ${activeSheet === 'dranken'
                            ? 'bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 -mb-px'
                            : 'bg-[#d9d9d9] dark:bg-[#374151] text-gray-600 dark:text-gray-400 border-transparent hover:bg-[#cfcfcf] dark:hover:bg-[#4b5563]'
                            }`}
                    >
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span>
                            Dranken
                        </span>
                    </button>

                    {/* Tab: Leden */}
                    <button
                        onClick={() => { setActiveSheet('leden'); setSelectedCell(null); setEditingCell(null); setSearchTerm(''); }}
                        className={`px-4 py-1.5 text-[11px] font-medium rounded-t-md border border-b-0 transition-colors ${activeSheet === 'leden'
                            ? 'bg-white dark:bg-[#0f172a] text-gray-900 dark:text-white border-gray-300 dark:border-gray-600 -mb-px'
                            : 'bg-[#d9d9d9] dark:bg-[#374151] text-gray-600 dark:text-gray-400 border-transparent hover:bg-[#cfcfcf] dark:hover:bg-[#4b5563]'
                            }`}
                    >
                        <span className="inline-flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-orange-500 inline-block"></span>
                            Leden
                        </span>
                    </button>
                </div>

                {/* Right corner: status */}
                <div className="ml-auto px-3 text-[10px] text-gray-500 dark:text-gray-400 flex items-center gap-3 h-full">
                    {activeSheet === 'consumpties' && consumptiesData.length > 0 && (
                        <span>Σ = € {consumptiesData.reduce((s, i) => s + i.price, 0).toFixed(2).replace('.', ',')}</span>
                    )}
                    <span>Blad: {activeSheet === 'consumpties' ? 'Consumpties' : activeSheet === 'dranken' ? 'Dranken' : 'Leden'}</span>
                </div>
            </div>
        </div>
    );
};
