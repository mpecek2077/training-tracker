import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildExercisesIndex,
  calcE1RM,
  computeWeeklySummary,
  getExerciseSessionStats,
  getWorkingSets,
  pluralSesja
} from '../js/analytics.js';
import { getDemoWorkouts } from '../js/demoData.js';
import { parseSyncAiJson } from '../js/storage.js';

describe('calcE1RM', () => {
  it('returns 0 when weight or reps are zero or negative', () => {
    assert.equal(calcE1RM(0, 10), 0);
    assert.equal(calcE1RM(80, 0), 0);
    assert.equal(calcE1RM(-20, 5), 0);
  });

  it('returns exact weight for single rep', () => {
    assert.equal(calcE1RM(100, 1), 100);
  });

  it('uses Epley formula for multi-rep sets', () => {
    assert.equal(calcE1RM(75, 5), 87.5);
    assert.equal(calcE1RM(100, 10), 133.3);
  });
});

describe('getWorkingSets & getExerciseSessionStats', () => {
  it('excludes warmup sets when working sets exist', () => {
    const sets = [
      { w: 40, r: 8, type: 'warmup' },
      { w: 80, r: 5, type: 'normal' },
      { w: 80, r: 5, type: 'normal' }
    ];
    const working = getWorkingSets(sets);
    assert.equal(working.length, 2);

    const stats = getExerciseSessionStats({ name: 'Bench', sets });
    assert.equal(stats.volume, 800);
    assert.equal(stats.maxWeight, 80);
    assert.equal(stats.e1rm, 93.3);
    assert.deepEqual(stats.bestSet, { w: 80, r: 5 });
  });

  it('falls back to all sets when every set is marked warmup', () => {
    const sets = [
      { w: 40, r: 10, type: 'warmup' },
      { w: 40, r: 10, type: 'warmup' }
    ];
    const working = getWorkingSets(sets);
    assert.equal(working.length, 2);

    const stats = getExerciseSessionStats({ name: 'Warmup Press', sets });
    assert.equal(stats.volume, 800);
    assert.equal(stats.e1rm, 53.3);
  });

  it('tracks reps properly for bodyweight exercises', () => {
    const stats = getExerciseSessionStats({
      name: 'Pull-ups',
      sets: [{ w: 0, r: 10 }, { w: 0, r: 12 }, { w: 0, r: 9 }]
    });
    assert.equal(stats.volume, 0);
    assert.equal(stats.maxWeight, 0);
    assert.equal(stats.maxReps, 12);
    assert.equal(stats.totalReps, 31);
    assert.deepEqual(stats.bestSet, { w: 0, r: 12 });
  });
});

describe('pluralSesja', () => {
  it('declines Polish noun sesja accurately', () => {
    const cases = [
      [1, 'sesja'],
      [2, 'sesje'],
      [4, 'sesje'],
      [5, 'sesji'],
      [12, 'sesji'],
      [14, 'sesji'],
      [21, 'sesji'],
      [22, 'sesje'],
      [24, 'sesje'],
      [25, 'sesji']
    ];
    for (const [n, expected] of cases) {
      assert.equal(pluralSesja(n), expected);
    }
  });
});

describe('computeWeeklySummary', () => {
  it('keeps active 4-week streak on Monday morning with 0 workouts and shows 0 kg without -100%', () => {
    // 2026-11-23 is a Monday; demo generated for Monday has 1 workout on 2026-11-23,
    // so filter out current Monday's workout to simulate Monday before training.
    const monday = new Date('2026-11-23T09:00:00');
    const priorWorkouts = getDemoWorkouts(new Date('2026-11-22T12:00:00'))
      .filter((w) => w.date < '2026-11-23');

    const summary = computeWeeklySummary(priorWorkouts, monday);
    assert.equal(summary.thisWeekCount, 0);
    assert.equal(summary.volDisplay, '0 kg');
    assert.equal(summary.volDelta, null);
    assert.equal(summary.streak, 4);

    // Explicitly check a 4-week prior streak before current Monday
    const fourWeekWorkouts = [
      { id: 'w4', date: '2026-10-26', title: 'PUSH', exercises: [{ name: 'Bench', sets: [{ w: 70, r: 5 }] }] },
      { id: 'w3', date: '2026-11-02', title: 'PUSH', exercises: [{ name: 'Bench', sets: [{ w: 72.5, r: 5 }] }] },
      { id: 'w2', date: '2026-11-09', title: 'PUSH', exercises: [{ name: 'Bench', sets: [{ w: 75, r: 5 }] }] },
      { id: 'w1', date: '2026-11-16', title: 'PUSH', exercises: [{ name: 'Bench', sets: [{ w: 77.5, r: 5 }] }] }
    ];
    const fourStreak = computeWeeklySummary(fourWeekWorkouts, monday);
    assert.equal(fourStreak.thisWeekCount, 0);
    assert.equal(fourStreak.volDisplay, '0 kg');
    assert.equal(fourStreak.volDelta, null);
    assert.equal(fourStreak.streak, 4);
  });

  it('displays BW when current week has only bodyweight workouts', () => {
    const ref = new Date('2026-11-24T12:00:00');
    const workouts = [
      {
        id: 'bw-1',
        date: '2026-11-23',
        title: 'Calisthenics',
        exercises: [{ name: 'Dips', sets: [{ w: 0, r: 15 }] }]
      }
    ];
    const summary = computeWeeklySummary(workouts, ref);
    assert.equal(summary.thisWeekCount, 1);
    assert.equal(summary.volDisplay, 'BW');
    assert.equal(summary.volDelta, null);
    assert.equal(summary.streak, 1);
  });

  it('calculates positive volume and percentage delta vs previous week', () => {
    const ref = new Date('2026-11-24T12:00:00');
    const workouts = [
      {
        id: 'prev',
        date: '2026-11-17',
        title: 'PUSH',
        exercises: [{ name: 'Bench', sets: [{ w: 100, r: 10 }] }]
      },
      {
        id: 'curr',
        date: '2026-11-24',
        title: 'PUSH',
        exercises: [{ name: 'Bench', sets: [{ w: 100, r: 12 }] }]
      }
    ];
    const summary = computeWeeklySummary(workouts, ref);
    assert.equal(summary.thisWeekCount, 1);
    assert.equal(summary.lastWeekCount, 1);
    assert.equal(summary.thisVol, 1200);
    assert.equal(summary.volDelta, 20);
    assert.equal(summary.streak, 2);
  });
});

describe('buildExercisesIndex & parseSyncAiJson', () => {
  it('indexes exercises chronologically and identifies bodyweight movements', () => {
    const workouts = getDemoWorkouts(new Date('2026-11-24T12:00:00'));
    const index = buildExercisesIndex(workouts);
    const bench = index.find((e) => e.name === 'Wyciskanie leżąc (sztanga)');
    assert.ok(bench);
    assert.equal(bench.count, 4);
    assert.equal(bench.isBodyweight, false);
    assert.equal(bench.sessions[0].maxWeight, 70);
    assert.equal(bench.sessions[3].maxWeight, 77.5);

    const pullups = index.find((e) => e.name === 'Podciąganie na drążku');
    assert.ok(pullups);
    assert.equal(pullups.isBodyweight, true);
  });

  it('validates, deduplicates, and preserves warmup sets in Sync AI JSON', () => {
    const existing = [
      {
        id: 'w1',
        date: '2026-11-20',
        startTime: '18:00',
        title: 'PUSH',
        exercises: [{ name: 'Bench', sets: [{ w: 75, r: 5 }] }]
      }
    ];

    const payload = JSON.stringify([
      {
        date: '2026-11-20',
        startTime: '18:00',
        title: 'PUSH',
        exercises: [{ name: 'Bench', sets: [{ w: 75, r: 5 }] }]
      },
      {
        date: '2026-11-22',
        startTime: '17:30',
        title: 'PULL',
        exercises: [
          {
            name: 'Barbell Row',
            sets: [
              { w: 40, r: 8, type: 'warmup' },
              { w: 70, r: 6 }
            ]
          }
        ]
      }
    ]);

    const res = parseSyncAiJson(payload, existing);
    assert.equal(res.skipped, 1);
    assert.equal(res.workoutsToAdd.length, 1);
    assert.equal(res.workoutsToAdd[0].exercises[0].sets[0].type, 'warmup');
    assert.equal(res.workoutsToAdd[0].exercises[0].sets[1].type, 'normal');

    assert.throws(() => parseSyncAiJson('[]', existing), /pusta/);
    assert.throws(() => parseSyncAiJson(JSON.stringify({ title: 'Bad', exercises: [] }), existing), /exercises/);
  });
});
