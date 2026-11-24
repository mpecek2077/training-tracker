import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  detectDelimiter,
  parseCsvTable,
  parseHevyCsvFile,
  parseHevyDateTime
} from '../js/hevyParser.js';

describe('detectDelimiter', () => {
  it('detects comma vs semicolon delimiters', () => {
    assert.equal(detectDelimiter('title,start_time,exercise_title'), ',');
    assert.equal(detectDelimiter('title;start_time;exercise_title'), ';');
  });

  it('ignores semicolons inside quoted headers', () => {
    assert.equal(detectDelimiter('"title;main",start_time,exercise_title'), ',');
  });
});

describe('parseCsvTable', () => {
  it('strips UTF-8 BOM, handles escaped quotes, and preserves multiline notes', () => {
    const csv = '\uFEFFtitle,exercise_notes,reps\n"PUSH ""Heavy""","First line\nSecond line",5\n';
    const rows = parseCsvTable(csv);
    assert.equal(rows.length, 2);
    assert.equal(rows[0][0], 'title');
    assert.equal(rows[1][0], 'PUSH "Heavy"');
    assert.equal(rows[1][1], 'First line\nSecond line');
    assert.equal(rows[1][2], '5');
  });
});

describe('parseHevyDateTime', () => {
  it('parses ISO, numeric DMY, English, and Polish date strings', () => {
    assert.deepEqual(parseHevyDateTime('2026-11-16 16:12:00'), { date: '2026-11-16', startTime: '16:12' });
    assert.deepEqual(parseHevyDateTime('05.03.2026 09:05'), { date: '2026-03-05', startTime: '09:05' });
    assert.deepEqual(parseHevyDateTime('16 Nov 2026, 16:12'), { date: '2026-11-16', startTime: '16:12' });
    assert.deepEqual(parseHevyDateTime('16 paź 2026, 18:05'), { date: '2026-10-16', startTime: '18:05' });
  });
});

describe('parseHevyCsvFile', () => {
  it('groups exercises, sorts by set_index, converts lbs to kg, tracks warmup sets, and skips empty rows', () => {
    const csv = [
      'title;start_time;exercise_title;exercise_notes;set_index;set_type;weight_kg;weight_lbs;reps;duration_seconds',
      'PUSH;16 Nov 2026, 18:00;Bench Press;Paused reps;2;normal;80;;5;',
      'PUSH;16 Nov 2026, 18:00;Bench Press;;0;warmup;40;;8;',
      'PUSH;16 Nov 2026, 18:00;Bench Press;;1;normal;;150;5;',
      'PUSH;16 Nov 2026, 18:00;Treadmill;;0;normal;;;0;600'
    ].join('\n');

    const workouts = parseHevyCsvFile(csv);
    assert.equal(workouts.length, 1);
    assert.equal(workouts[0].date, '2026-11-16');
    assert.equal(workouts[0].startTime, '18:00');
    assert.equal(workouts[0].exercises.length, 1);

    const bench = workouts[0].exercises[0];
    assert.equal(bench.name, 'Bench Press');
    assert.equal(bench.notes, 'Paused reps');
    assert.deepEqual(bench.sets, [
      { w: 40, r: 8, type: 'warmup' },
      { w: 68, r: 5, type: 'normal' },
      { w: 80, r: 5, type: 'normal' }
    ]);
  });

  it('throws on missing required Hevy columns', () => {
    assert.throws(() => parseHevyCsvFile('foo,bar\n1,2'), /start_time/);
  });
});
