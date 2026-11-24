import { getTodayISO } from './analytics.js';

export function detectDelimiter(headerLine) {
  let commas = 0;
  let semis = 0;
  let inQuotes = false;
  for (let i = 0; i < headerLine.length; i++) {
    const ch = headerLine[i];
    if (ch === '"') inQuotes = !inQuotes;
    else if (!inQuotes && ch === ',') commas++;
    else if (!inQuotes && ch === ';') semis++;
  }
  return semis > commas ? ';' : ',';
}

export function parseCsvTable(text) {
  const clean = text.replace(/^\uFEFF/, '');
  const firstLineEnd = clean.indexOf('\n');
  const firstLine = firstLineEnd === -1 ? clean : clean.slice(0, firstLineEnd);
  const delim = detectDelimiter(firstLine);

  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    const next = clean[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === delim) {
        row.push(field);
        field = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
        i++;
      } else if (ch === '\n' || ch === '\r') {
        row.push(field);
        rows.push(row);
        row = [];
        field = '';
      } else {
        field += ch;
      }
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

const MONTH_MAP = {
  jan: '01', sty: '01',
  feb: '02', lut: '02',
  mar: '03',
  apr: '04', kwi: '04',
  may: '05', maj: '05',
  jun: '06', cze: '06',
  jul: '07', lip: '07',
  aug: '08', sie: '08',
  sep: '09', wrz: '09',
  oct: '10', paź: '10', paz: '10',
  nov: '11', lis: '11',
  dec: '12', gru: '12'
};

// Parse Hevy start_time into { date: 'YYYY-MM-DD', startTime: 'HH:MM' }
export function parseHevyDateTime(raw) {
  const str = String(raw || '').trim();
  if (!str) return { date: getTodayISO(), startTime: '' };

  const timeMatch = str.match(/(\d{1,2}):(\d{2})/);
  const startTime = timeMatch
    ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`
    : '';

  // ISO: 2026-11-16 ...
  const isoMatch = str.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    return { date: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`, startTime };
  }

  // DD.MM.YYYY or DD/MM/YYYY
  const dmyNum = str.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (dmyNum) {
    return {
      date: `${dmyNum[3]}-${dmyNum[2].padStart(2, '0')}-${dmyNum[1].padStart(2, '0')}`,
      startTime
    };
  }

  // English & Polish month names: "16 Nov 2026, 16:12" or "16 lis 2026, 16:12"
  const dmyText = str.match(/(\d{1,2})\s+([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]+)\.?\s+(\d{4})/);
  if (dmyText) {
    const monKey = dmyText[2].slice(0, 3).toLowerCase();
    if (MONTH_MAP[monKey]) {
      return {
        date: `${dmyText[3]}-${MONTH_MAP[monKey]}-${dmyText[1].padStart(2, '0')}`,
        startTime
      };
    }
  }

  // Month DD, YYYY ("Nov 16, 2026 16:12")
  const mdyText = str.match(/([A-Za-zżźćńółęąśŻŹĆĄŚĘŁÓŃ]+)\.?\s+(\d{1,2}),?\s+(\d{4})/);
  if (mdyText) {
    const monKey = mdyText[1].slice(0, 3).toLowerCase();
    if (MONTH_MAP[monKey]) {
      return {
        date: `${mdyText[3]}-${MONTH_MAP[monKey]}-${mdyText[2].padStart(2, '0')}`,
        startTime
      };
    }
  }

  // Native Date fallback
  const parsed = new Date(str);
  if (!Number.isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return { date: `${y}-${m}-${d}`, startTime };
  }

  return { date: getTodayISO(), startTime };
}

export function parseHevyCsvFile(csvText) {
  const rows = parseCsvTable(csvText);
  if (rows.length < 2) {
    throw new Error('Plik CSV jest pusty lub nie zawiera wierszy z danymi.');
  }

  const headers = rows[0].map((h) => h.trim().toLowerCase());
  const idx = {
    title: headers.indexOf('title'),
    startTime: headers.indexOf('start_time'),
    exerciseTitle: headers.indexOf('exercise_title'),
    exerciseNotes: headers.indexOf('exercise_notes'),
    setIndex: headers.indexOf('set_index'),
    setType: headers.indexOf('set_type'),
    weightKg: headers.indexOf('weight_kg'),
    weightLbs: headers.indexOf('weight_lbs'),
    reps: headers.indexOf('reps')
  };

  if (idx.startTime === -1 || idx.exerciseTitle === -1) {
    throw new Error('Nie wykryto standardowych kolumn Hevy (wymagane: start_time, exercise_title).');
  }

  const workoutsMap = new Map();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawStart = (r[idx.startTime] || '').trim();
    const exName = (r[idx.exerciseTitle] || '').trim();
    if (!rawStart || !exName) continue;

    const title = (idx.title !== -1 && r[idx.title] ? r[idx.title].trim() : '') || 'Trening Hevy';
    const notes = idx.exerciseNotes !== -1 ? (r[idx.exerciseNotes] || '').trim() : '';
    const setType = idx.setType !== -1 ? (r[idx.setType] || 'normal').trim().toLowerCase() : 'normal';
    const reps = parseInt(r[idx.reps], 10) || 0;

    let weight = 0;
    if (idx.weightKg !== -1 && r[idx.weightKg] !== undefined && String(r[idx.weightKg]).trim() !== '') {
      weight = parseFloat(String(r[idx.weightKg]).replace(',', '.')) || 0;
    } else if (idx.weightLbs !== -1 && r[idx.weightLbs] !== undefined && String(r[idx.weightLbs]).trim() !== '') {
      const lbs = parseFloat(String(r[idx.weightLbs]).replace(',', '.')) || 0;
      weight = Number((lbs * 0.45359237).toFixed(1));
    }

    // Skip completely empty rows (e.g. duration-only cardio with 0 reps & 0 weight)
    if (reps <= 0 && weight <= 0) continue;

    const { date, startTime } = parseHevyDateTime(rawStart);
    const groupKey = `${rawStart}|||${title}`;

    if (!workoutsMap.has(groupKey)) {
      workoutsMap.set(groupKey, {
        id: `hevy-${date}-${Math.random().toString(36).slice(2, 8)}`,
        date,
        startTime,
        title,
        exercisesOrder: [],
        exercisesMap: new Map()
      });
    }

    const wGroup = workoutsMap.get(groupKey);
    if (!wGroup.exercisesMap.has(exName)) {
      wGroup.exercisesOrder.push(exName);
      wGroup.exercisesMap.set(exName, { name: exName, notes, sets: [] });
    }

    const exObj = wGroup.exercisesMap.get(exName);
    if (!exObj.notes && notes) exObj.notes = notes;

    const setIdx = idx.setIndex !== -1 ? parseInt(r[idx.setIndex], 10) : exObj.sets.length;
    exObj.sets.push({
      _order: Number.isNaN(setIdx) ? exObj.sets.length : setIdx,
      w: Number(weight.toFixed(2)),
      r: reps,
      type: setType === 'warmup' ? 'warmup' : 'normal'
    });
  }

  const result = [];
  workoutsMap.forEach((wg) => {
    const exercises = wg.exercisesOrder.map((exName) => {
      const ex = wg.exercisesMap.get(exName);
      ex.sets.sort((a, b) => a._order - b._order);
      return {
        name: ex.name,
        notes: ex.notes || '',
        sets: ex.sets.map((s) => ({ w: s.w, r: s.r, type: s.type }))
      };
    }).filter((ex) => ex.sets.length > 0);

    if (exercises.length > 0) {
      result.push({
        id: wg.id,
        date: wg.date,
        startTime: wg.startTime,
        title: wg.title,
        exercises
      });
    }
  });

  return result;
}
