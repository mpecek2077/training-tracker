export const MONTHS_PL = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export function escapeHtml(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function toLocalISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function getTodayISO(referenceDate = new Date()) {
  return toLocalISO(referenceDate);
}

export function getNowTimeHM(referenceDate = new Date()) {
  return `${String(referenceDate.getHours()).padStart(2, '0')}:${String(referenceDate.getMinutes()).padStart(2, '0')}`;
}

export function formatDatePL(iso) {
  if (!iso) return '—';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  const m = parseInt(parts[1], 10) - 1;
  return `${parseInt(parts[2], 10)} ${MONTHS_PL[m] || parts[1]} ${parts[0]}`;
}

export function formatDateShort(iso) {
  if (!iso) return '';
  const parts = String(iso).split('-');
  if (parts.length !== 3) return iso;
  const m = parseInt(parts[1], 10) - 1;
  return `${parseInt(parts[2], 10)} ${MONTHS_PL[m] || parts[1]}`;
}

export function fmtNum(n, maxDecimals = 1) {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  return Number(n).toLocaleString('pl-PL', { maximumFractionDigits: maxDecimals });
}

export function pluralSesja(n) {
  if (n === 1) return 'sesja';
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'sesje';
  return 'sesji';
}

// Epley formula for estimated 1RM
export function calcE1RM(weight, reps) {
  const w = Number(weight) || 0;
  const r = Number(reps) || 0;
  if (w <= 0 || r <= 0) return 0;
  if (r === 1) return Number(w.toFixed(1));
  return Number((w * (1 + r / 30)).toFixed(1));
}

// Exclude warmup sets from PR/e1RM unless all sets are warmups
export function getWorkingSets(sets) {
  if (!Array.isArray(sets) || sets.length === 0) return [];
  const nonWarmup = sets.filter((s) => (s.type || 'normal').toLowerCase() !== 'warmup');
  return nonWarmup.length > 0 ? nonWarmup : sets;
}

export function getExerciseSessionStats(ex) {
  const allSets = Array.isArray(ex?.sets) ? ex.sets : [];
  const working = getWorkingSets(allSets);

  let maxWeight = 0;
  let maxReps = 0;
  let bestE1rm = 0;
  let bestSet = { w: 0, r: 0 };
  let volume = 0;
  let totalReps = 0;

  for (const s of working) {
    const w = Number(s.w) || 0;
    const r = Number(s.r) || 0;
    const e1 = calcE1RM(w, r);
    if (w > maxWeight) maxWeight = w;
    if (r > maxReps) maxReps = r;
    volume += w * r;
    totalReps += r;

    if (w > 0) {
      if (e1 > bestE1rm || (e1 === bestE1rm && w > bestSet.w) || (e1 === bestE1rm && w === bestSet.w && r > bestSet.r)) {
        bestE1rm = e1;
        bestSet = { w, r };
      }
    } else if (bestSet.w === 0 && r > bestSet.r) {
      bestSet = { w: 0, r };
    }
  }

  return {
    allSets,
    working,
    maxWeight: Number(maxWeight.toFixed(1)),
    maxReps,
    e1rm: Number(bestE1rm.toFixed(1)),
    volume: Number(volume.toFixed(1)),
    totalReps,
    bestSet
  };
}

export function calcWorkoutVolume(workout) {
  let sum = 0;
  for (const ex of (workout?.exercises || [])) {
    const working = getWorkingSets(ex.sets || []);
    for (const s of working) {
      sum += (Number(s.w) || 0) * (Number(s.r) || 0);
    }
  }
  return Number(sum.toFixed(1));
}

export function calcPctDelta(current, previous) {
  if (previous === null || previous === undefined || previous === 0) return null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

export function formatSetCompact(s) {
  const w = Number(s.w) || 0;
  const r = Number(s.r) || 0;
  return w > 0 ? `${fmtNum(w)}×${r}` : `BW×${r}`;
}

export function formatSetFull(s) {
  const w = Number(s.w) || 0;
  const r = Number(s.r) || 0;
  return w > 0 ? `${fmtNum(w)} kg × ${r}` : `BW × ${r} powt.`;
}

export function classifyWorkoutCategory(title) {
  const t = (title || '').toLowerCase();
  if (t.includes('push') || t.includes('klat')) return 'PUSH';
  if (t.includes('pull') || t.includes('plec')) return 'PULL';
  if (t.includes('leg') || t.includes('nog') || t.includes('core')) return 'LEGS';
  return 'OTHER';
}

export function sortWorkoutsChronologically(workouts) {
  return [...(workouts || [])].sort((a, b) => {
    const da = `${a.date || ''} ${a.startTime || '00:00'}`;
    const db = `${b.date || ''} ${b.startTime || '00:00'}`;
    return da.localeCompare(db) || (a.id || '').localeCompare(b.id || '');
  });
}

export function buildExercisesIndex(workouts) {
  const map = new Map();
  const sorted = sortWorkoutsChronologically(workouts);

  for (const w of sorted) {
    for (const ex of (w.exercises || [])) {
      const name = (ex.name || '').trim();
      if (!name) continue;
      if (!map.has(name)) {
        map.set(name, []);
      }
      const stats = getExerciseSessionStats(ex);
      map.get(name).push({
        workoutId: w.id,
        date: w.date,
        startTime: w.startTime || '',
        workoutTitle: w.title || 'Trening',
        ...stats
      });
    }
  }

  const list = [];
  map.forEach((sessions, name) => {
    const isBodyweight = sessions.every((s) => s.maxWeight === 0);
    list.push({
      name,
      count: sessions.length,
      isBodyweight,
      sessions
    });
  });

  return list.sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'pl'));
}

export function resolveMetric(session, metric, isBodyweight) {
  if (isBodyweight) {
    if (metric === 'volume') {
      return { value: session.totalReps, unit: 'powt.', label: 'Łączne powt. (BW)' };
    }
    return { value: session.maxReps, unit: 'powt.', label: 'Maks. powt. (BW)' };
  }

  switch (metric) {
    case 'maxWeight':
      return { value: session.maxWeight, unit: 'kg', label: 'Maks. ciężar' };
    case 'volume':
      return { value: session.volume, unit: 'kg', label: 'Objętość' };
    case 'maxReps':
      return { value: session.maxReps, unit: 'powt.', label: 'Maks. powtórzenia' };
    case 'e1rm':
    default:
      return { value: session.e1rm, unit: 'kg', label: 'e1RM (Epley)' };
  }
}

export function dedupKey(w) {
  return `${w.date || ''}|${(w.title || '').trim().toLowerCase()}|${(w.startTime || '').trim()}`;
}

export function computeWeeklySummary(workouts, referenceDate = new Date()) {
  const sorted = sortWorkoutsChronologically(workouts);
  if (sorted.length === 0) {
    return {
      thisWeekCount: 0,
      lastWeekCount: 0,
      thisVol: 0,
      lastVol: 0,
      volDisplay: '0 kg',
      volDelta: null,
      streak: 0
    };
  }

  const now = new Date(referenceDate);
  const dayOfWeek = now.getDay() || 7;
  const mondayThis = new Date(now);
  mondayThis.setDate(now.getDate() - dayOfWeek + 1);
  mondayThis.setHours(0, 0, 0, 0);

  const sundayThis = new Date(mondayThis);
  sundayThis.setDate(sundayThis.getDate() + 6);

  const mondayLast = new Date(mondayThis);
  mondayLast.setDate(mondayLast.getDate() - 7);

  const mondayThisISO = toLocalISO(mondayThis);
  const sundayThisISO = toLocalISO(sundayThis);
  const mondayLastISO = toLocalISO(mondayLast);

  const thisWeek = sorted.filter((w) => w.date >= mondayThisISO && w.date <= sundayThisISO);
  const lastWeek = sorted.filter((w) => w.date >= mondayLastISO && w.date < mondayThisISO);

  const thisVol = Number(thisWeek.reduce((s, w) => s + calcWorkoutVolume(w), 0).toFixed(1));
  const lastVol = Number(lastWeek.reduce((s, w) => s + calcWorkoutVolume(w), 0).toFixed(1));

  let volDisplay;
  let volDelta = null;
  if (thisWeek.length === 0) {
    volDisplay = '0 kg';
  } else if (thisVol === 0) {
    volDisplay = 'BW';
  } else {
    volDisplay = `${fmtNum(thisVol, 0)} kg`;
    volDelta = lastVol > 0 ? calcPctDelta(thisVol, lastVol) : null;
  }

  // Keep an active streak alive if the current week just started with 0 workouts so far.
  let streak = 0;
  const checkM = new Date(thisWeek.length > 0 ? mondayThis : mondayLast);
  for (let iter = 0; iter < 520; iter++) {
    const checkEnd = new Date(checkM);
    checkEnd.setDate(checkEnd.getDate() + 6);
    const startISO = toLocalISO(checkM);
    const endISO = toLocalISO(checkEnd);
    const has = sorted.some((w) => w.date >= startISO && w.date <= endISO);
    if (has) {
      streak++;
      checkM.setDate(checkM.getDate() - 7);
    } else {
      break;
    }
  }

  return {
    thisWeekCount: thisWeek.length,
    lastWeekCount: lastWeek.length,
    thisVol,
    lastVol,
    volDisplay,
    volDelta,
    streak
  };
}
