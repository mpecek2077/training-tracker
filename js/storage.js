import { dedupKey, getNowTimeHM, getTodayISO } from './analytics.js';
import { getDemoSkills, getDemoWorkouts } from './demoData.js';

export const STORAGE_KEY = 'training_tracker_standalone_v1';

export function saveState(state) {
  state.lastSaved = getNowTimeHM();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      version: 1,
      lastSaved: state.lastSaved,
      workouts: state.workouts,
      skills: state.skills
    }));
    return { ok: true, quotaExceeded: false };
  } catch (err) {
    const quotaExceeded = Boolean(err && (err.name === 'QuotaExceededError' || err.code === 22));
    return { ok: false, quotaExceeded, error: err };
  }
}

export function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.workouts) && Array.isArray(parsed.skills)) {
        return {
          workouts: parsed.workouts,
          skills: parsed.skills,
          lastSaved: parsed.lastSaved || ''
        };
      }
    }
  } catch (err) {
    console.warn('Failed to read from localStorage:', err);
  }

  const seeded = {
    workouts: getDemoWorkouts(),
    skills: getDemoSkills(),
    lastSaved: ''
  };
  saveState(seeded);
  return seeded;
}

export function buildBackupJson(state) {
  return JSON.stringify({
    app: 'Training Tracker',
    version: 1,
    exportedAt: new Date().toISOString(),
    workouts: state.workouts,
    skills: state.skills
  }, null, 2);
}

export function parseBackupJson(jsonText) {
  const parsed = JSON.parse(jsonText);
  if (!parsed || !Array.isArray(parsed.workouts) || !Array.isArray(parsed.skills)) {
    throw new Error('Nieprawidłowy plik kopii zapasowej (brak tablic workouts/skills).');
  }
  return {
    workouts: parsed.workouts,
    skills: parsed.skills
  };
}

export function parseSyncAiJson(rawText, existingWorkouts = []) {
  const parsed = JSON.parse(rawText);
  const list = Array.isArray(parsed) ? parsed : [parsed];
  if (list.length === 0) throw new Error('Tablica JSON jest pusta.');

  const existingKeys = new Set(existingWorkouts.map(dedupKey));
  const workoutsToAdd = [];
  let skipped = 0;

  list.forEach((item, i) => {
    if (!item || typeof item !== 'object') throw new Error(`Element #${i + 1} nie jest obiektem.`);
    if (!Array.isArray(item.exercises) || item.exercises.length === 0) {
      throw new Error(`Trening #${i + 1} musi posiadać tablicę "exercises".`);
    }

    const exercises = item.exercises.map((ex, j) => {
      if (!ex.name || !Array.isArray(ex.sets) || ex.sets.length === 0) {
        throw new Error(`Ćwiczenie #${j + 1} wymaga pól "name" oraz "sets".`);
      }
      return {
        name: String(ex.name).trim(),
        notes: ex.notes ? String(ex.notes).trim() : '',
        sets: ex.sets.map((s) => ({
          w: Number(s.w ?? s.weight ?? 0) || 0,
          r: Number(s.r ?? s.reps ?? 0) || 0,
          type: (s.type || s.set_type || 'normal').toLowerCase() === 'warmup' ? 'warmup' : 'normal'
        })).filter((s) => s.r > 0 || s.w > 0)
      };
    }).filter((ex) => ex.sets.length > 0);

    if (exercises.length === 0) throw new Error(`Trening #${i + 1} nie zawiera poprawnych serii.`);

    const dateStr = item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) ? item.date : getTodayISO();
    const workout = {
      id: item.id || `ai-${dateStr}-${Math.random().toString(36).slice(2, 8)}`,
      date: dateStr,
      startTime: item.startTime || '',
      title: String(item.title || 'Trening').trim() || 'Trening',
      exercises
    };

    const key = dedupKey(workout);
    if (existingKeys.has(key)) {
      skipped++;
    } else {
      existingKeys.add(key);
      workoutsToAdd.push(workout);
    }
  });

  return { workoutsToAdd, skipped };
}
