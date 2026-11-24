import { toLocalISO } from './analytics.js';

function addDaysISO(baseDate, offsetDays) {
  const d = new Date(baseDate);
  d.setDate(d.getDate() + offsetDays);
  return toLocalISO(d);
}

function getMondayOfWeek(referenceDate = new Date()) {
  const now = new Date(referenceDate);
  const dayOfWeek = now.getDay() || 7;
  const monday = new Date(now);
  monday.setDate(now.getDate() - dayOfWeek + 1);
  monday.setHours(0, 0, 0, 0);
  return { monday, dayOfWeek };
}

export function getDemoWorkouts(referenceDate = new Date()) {
  const { monday, dayOfWeek } = getMondayOfWeek(referenceDate);

  const dT3Mon = addDaysISO(monday, -21);
  const dT3Thu = addDaysISO(monday, -18);
  const dT2Mon = addDaysISO(monday, -14);
  const dT2Wed = addDaysISO(monday, -12);
  const dT2Fri = addDaysISO(monday, -10);
  const dT1Mon = addDaysISO(monday, -7);
  const dT1Wed = addDaysISO(monday, -5);
  const dT1Fri = addDaysISO(monday, -3);
  const dThisMon = addDaysISO(monday, 0);
  const dThisTue = addDaysISO(monday, 1);

  const workouts = [
    {
      id: 'demo-t3-push',
      date: dT3Mon,
      startTime: '18:10',
      title: 'PUSH',
      exercises: [
        {
          name: 'Wyciskanie leżąc (sztanga)',
          notes: 'Kontrola opuszczania',
          sets: [
            { w: 40, r: 8, type: 'warmup' },
            { w: 70, r: 5, type: 'normal' },
            { w: 70, r: 5, type: 'normal' },
            { w: 70, r: 5, type: 'normal' },
            { w: 70, r: 5, type: 'normal' }
          ]
        },
        {
          name: 'Pompki na poręczach',
          notes: '',
          sets: [{ w: 0, r: 10 }, { w: 0, r: 10 }, { w: 0, r: 9 }]
        },
        {
          name: 'Wyciskanie żołnierskie (sztanga)',
          notes: '',
          sets: [{ w: 40, r: 8 }, { w: 40, r: 8 }, { w: 40, r: 7 }]
        },
        {
          name: 'Prostowanie ramion na wyciągu',
          notes: '',
          sets: [{ w: 22.5, r: 12 }, { w: 22.5, r: 12 }, { w: 22.5, r: 11 }]
        }
      ]
    },
    {
      id: 'demo-t3-pull',
      date: dT3Thu,
      startTime: '18:30',
      title: 'PULL',
      exercises: [
        {
          name: 'Podciąganie na drążku',
          notes: '',
          sets: [{ w: 0, r: 9 }, { w: 0, r: 9 }, { w: 0, r: 8 }]
        },
        {
          name: 'Wiosłowanie sztangą',
          notes: '',
          sets: [{ w: 60, r: 8 }, { w: 60, r: 8 }, { w: 60, r: 8 }]
        },
        {
          name: 'Face pull (wyciąg)',
          notes: '',
          sets: [{ w: 20, r: 15 }, { w: 20, r: 15 }, { w: 20, r: 15 }]
        },
        {
          name: 'Uginanie ramion (hantle)',
          notes: '',
          sets: [{ w: 12.5, r: 12 }, { w: 12.5, r: 12 }, { w: 12.5, r: 10 }]
        }
      ]
    },
    {
      id: 'demo-t2-push',
      date: dT2Mon,
      startTime: '17:45',
      title: 'PUSH',
      exercises: [
        {
          name: 'Wyciskanie leżąc (sztanga)',
          notes: 'Pauza na klatce w pierwszej serii',
          sets: [
            { w: 40, r: 8, type: 'warmup' },
            { w: 72.5, r: 5, type: 'normal' },
            { w: 72.5, r: 5, type: 'normal' },
            { w: 72.5, r: 5, type: 'normal' },
            { w: 72.5, r: 5, type: 'normal' }
          ]
        },
        {
          name: 'Rozpiętki (maszyna)',
          notes: '',
          sets: [{ w: 40, r: 12 }, { w: 40, r: 12 }, { w: 40, r: 12 }]
        },
        {
          name: 'Wyciskanie nad głowę (hantle)',
          notes: '',
          sets: [{ w: 18, r: 10 }, { w: 18, r: 10 }, { w: 18, r: 9 }]
        },
        {
          name: 'Wznosy bokiem (hantle)',
          notes: '',
          sets: [{ w: 8, r: 15 }, { w: 8, r: 15 }, { w: 8, r: 14 }]
        }
      ]
    },
    {
      id: 'demo-t2-legs',
      date: dT2Wed,
      startTime: '18:00',
      title: 'LEGS & CORE',
      exercises: [
        {
          name: 'Przysiad ze sztangą',
          notes: '',
          sets: [
            { w: 50, r: 8, type: 'warmup' },
            { w: 90, r: 5, type: 'normal' },
            { w: 90, r: 5, type: 'normal' },
            { w: 90, r: 5, type: 'normal' }
          ]
        },
        {
          name: 'Wypychanie nóg na suwnicy',
          notes: '',
          sets: [{ w: 160, r: 10 }, { w: 160, r: 10 }, { w: 160, r: 10 }]
        },
        {
          name: 'Wspięcia na palce siedząc',
          notes: '',
          sets: [{ w: 45, r: 15 }, { w: 45, r: 15 }, { w: 45, r: 15 }]
        },
        {
          name: 'Unoszenie nóg w zwisie',
          notes: '',
          sets: [{ w: 0, r: 12 }, { w: 0, r: 11 }, { w: 0, r: 10 }]
        }
      ]
    },
    {
      id: 'demo-t2-pull',
      date: dT2Fri,
      startTime: '18:20',
      title: 'PULL',
      exercises: [
        {
          name: 'Podciąganie na drążku',
          notes: '',
          sets: [{ w: 0, r: 10 }, { w: 0, r: 9 }, { w: 0, r: 9 }]
        },
        {
          name: 'Wiosłowanie na wyciągu siedząc',
          notes: '',
          sets: [{ w: 45, r: 10 }, { w: 45, r: 10 }, { w: 45, r: 9 }]
        },
        {
          name: 'Face pull (wyciąg)',
          notes: '',
          sets: [{ w: 22.5, r: 14 }, { w: 22.5, r: 14 }, { w: 22.5, r: 14 }]
        },
        {
          name: 'Uginanie ramion (sztanga)',
          notes: '',
          sets: [{ w: 25, r: 10 }, { w: 25, r: 10 }, { w: 25, r: 10 }]
        }
      ]
    },
    {
      id: 'demo-t1-push',
      date: dT1Mon,
      startTime: '18:05',
      title: 'PUSH',
      exercises: [
        {
          name: 'Wyciskanie leżąc (sztanga)',
          notes: 'Stabilna pozycja łopatek',
          sets: [
            { w: 40, r: 8, type: 'warmup' },
            { w: 75, r: 5, type: 'normal' },
            { w: 75, r: 5, type: 'normal' },
            { w: 75, r: 5, type: 'normal' },
            { w: 75, r: 4, type: 'normal' }
          ]
        },
        {
          name: 'Pompki na poręczach',
          notes: '',
          sets: [{ w: 0, r: 12 }, { w: 0, r: 12 }, { w: 0, r: 11 }]
        },
        {
          name: 'Wyciskanie żołnierskie (sztanga)',
          notes: '',
          sets: [{ w: 42.5, r: 8 }, { w: 42.5, r: 8 }, { w: 42.5, r: 7 }]
        },
        {
          name: 'Prostowanie ramion na wyciągu',
          notes: '',
          sets: [{ w: 25, r: 12 }, { w: 25, r: 12 }, { w: 25, r: 12 }]
        }
      ]
    },
    {
      id: 'demo-t1-legs',
      date: dT1Wed,
      startTime: '17:40',
      title: 'LEGS & CORE',
      exercises: [
        {
          name: 'Przysiad ze sztangą',
          notes: '',
          sets: [
            { w: 50, r: 8, type: 'warmup' },
            { w: 95, r: 5, type: 'normal' },
            { w: 95, r: 5, type: 'normal' },
            { w: 95, r: 5, type: 'normal' }
          ]
        },
        {
          name: 'Rumuński martwy ciąg',
          notes: '',
          sets: [{ w: 80, r: 8 }, { w: 80, r: 8 }, { w: 80, r: 8 }]
        },
        {
          name: 'Brzuszki na wyciągu',
          notes: '',
          sets: [{ w: 35, r: 12 }, { w: 35, r: 12 }, { w: 35, r: 12 }]
        }
      ]
    },
    {
      id: 'demo-t1-pull',
      date: dT1Fri,
      startTime: '18:15',
      title: 'PULL',
      exercises: [
        {
          name: 'Podciąganie na drążku',
          notes: 'Pełny wyprost na dole',
          sets: [{ w: 0, r: 10 }, { w: 0, r: 10 }, { w: 0, r: 9 }]
        },
        {
          name: 'Wiosłowanie sztangą',
          notes: '',
          sets: [{ w: 62.5, r: 8 }, { w: 62.5, r: 8 }, { w: 62.5, r: 8 }]
        },
        {
          name: 'Uginanie ramion (hantle)',
          notes: '',
          sets: [{ w: 14, r: 10 }, { w: 14, r: 10 }, { w: 14, r: 10 }]
        }
      ]
    },
    {
      id: 'demo-t0-push',
      date: dThisMon,
      startTime: '18:00',
      title: 'PUSH',
      exercises: [
        {
          name: 'Wyciskanie leżąc (sztanga)',
          notes: 'Zapas ok. 1 powtórzenia',
          sets: [
            { w: 40, r: 8, type: 'warmup' },
            { w: 77.5, r: 5, type: 'normal' },
            { w: 77.5, r: 5, type: 'normal' },
            { w: 77.5, r: 5, type: 'normal' },
            { w: 77.5, r: 5, type: 'normal' }
          ]
        },
        {
          name: 'Pompki na poręczach',
          notes: '',
          sets: [{ w: 0, r: 12 }, { w: 0, r: 12 }, { w: 0, r: 12 }]
        },
        {
          name: 'Wyciskanie nad głowę (hantle)',
          notes: '',
          sets: [{ w: 20, r: 9 }, { w: 20, r: 9 }, { w: 20, r: 8 }]
        },
        {
          name: 'Wznosy bokiem (hantle)',
          notes: '',
          sets: [{ w: 9, r: 15 }, { w: 9, r: 15 }, { w: 9, r: 14 }]
        }
      ]
    }
  ];

  if (dayOfWeek >= 2) {
    workouts.push({
      id: 'demo-t0-legs',
      date: dThisTue,
      startTime: '17:50',
      title: 'LEGS & CORE',
      exercises: [
        {
          name: 'Przysiad ze sztangą',
          notes: 'Dobra głębokość',
          sets: [
            { w: 50, r: 8, type: 'warmup' },
            { w: 97.5, r: 5, type: 'normal' },
            { w: 97.5, r: 5, type: 'normal' },
            { w: 97.5, r: 5, type: 'normal' }
          ]
        },
        {
          name: 'Wypychanie nóg na suwnicy',
          notes: '',
          sets: [{ w: 170, r: 10 }, { w: 170, r: 10 }, { w: 170, r: 10 }]
        },
        {
          name: 'Wspięcia na palce siedząc',
          notes: '',
          sets: [{ w: 50, r: 15 }, { w: 50, r: 15 }, { w: 50, r: 15 }]
        },
        {
          name: 'Dragon flag',
          notes: '',
          sets: [{ w: 0, r: 4 }, { w: 0, r: 4 }, { w: 0, r: 3 }]
        }
      ]
    });
  }

  return workouts;
}

export function getDemoSkills(referenceDate = new Date()) {
  const ref = new Date(referenceDate);
  return [
    {
      id: 'cat-handstand',
      title: 'Handstand',
      color: '#3b82f6',
      items: [
        { id: 'hs-1', label: 'Ściana brzuchem 30s w linii', completed: true, date: addDaysISO(ref, -42) },
        { id: 'hs-2', label: 'Ściana plecami z odrywaniem pięt', completed: true, date: addDaysISO(ref, -19) },
        { id: 'hs-3', label: 'Kontrola palcami 5s wolno', completed: false, date: '' },
        { id: 'hs-4', label: 'Stanie na rękach 10s freestanding', completed: false, date: '' },
        { id: 'hs-5', label: 'Stanie na rękach 30s freestanding', completed: false, date: '' }
      ]
    },
    {
      id: 'cat-planche',
      title: 'Planche',
      color: '#8b5cf6',
      items: [
        { id: 'pl-1', label: 'Crow Stand 15s', completed: true, date: addDaysISO(ref, -36) },
        { id: 'pl-2', label: 'Planche Lean 20s z protrakcją', completed: true, date: addDaysISO(ref, -12) },
        { id: 'pl-3', label: 'Tuck Planche 5s', completed: false, date: '' },
        { id: 'pl-4', label: 'Tuck Planche 15s', completed: false, date: '' },
        { id: 'pl-5', label: 'Advanced Tuck Planche 10s', completed: false, date: '' },
        { id: 'pl-6', label: 'Straddle Planche 5s', completed: false, date: '' }
      ]
    },
    {
      id: 'cat-frontlever',
      title: 'Front Lever',
      color: '#10b981',
      items: [
        { id: 'fl-1', label: 'Tuck Front Lever 10s', completed: true, date: addDaysISO(ref, -25) },
        { id: 'fl-2', label: 'Tuck Front Lever 20s', completed: false, date: '' },
        { id: 'fl-3', label: 'Advanced Tuck FL 10s', completed: false, date: '' },
        { id: 'fl-4', label: 'One-Leg Front Lever 8s', completed: false, date: '' },
        { id: 'fl-5', label: 'Half Lay FL 5s', completed: false, date: '' },
        { id: 'fl-6', label: 'Full Front Lever 5s', completed: false, date: '' }
      ]
    },
    {
      id: 'cat-strength',
      title: 'Siła & Kalistenika',
      color: '#f59e0b',
      items: [
        { id: 'st-1', label: 'Muscle-Up na drążku', completed: true, date: addDaysISO(ref, -60) },
        { id: 'st-2', label: 'Podciąganie 3×12 czysto', completed: true, date: addDaysISO(ref, -28) },
        { id: 'st-3', label: 'Dragon Flag 3×5 pełne', completed: false, date: '' },
        { id: 'st-4', label: 'Ławka płaska 82.5 kg', completed: true, date: addDaysISO(ref, -9) },
        { id: 'st-5', label: 'Ławka płaska 90 kg', completed: false, date: '' },
        { id: 'st-6', label: 'Ławka płaska 100 kg', completed: false, date: '' }
      ]
    }
  ];
}
