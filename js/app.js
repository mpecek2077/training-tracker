import {
  buildExercisesIndex,
  calcPctDelta,
  calcWorkoutVolume,
  classifyWorkoutCategory,
  computeWeeklySummary,
  dedupKey,
  escapeHtml,
  fmtNum,
  formatDatePL,
  formatDateShort,
  formatSetCompact,
  formatSetFull,
  getExerciseSessionStats,
  getTodayISO,
  pluralSesja,
  resolveMetric,
  sortWorkoutsChronologically
} from './analytics.js';
import { renderProgressChart } from './chart.js';
import { getDemoWorkouts } from './demoData.js';
import { parseHevyCsvFile } from './hevyParser.js';
import {
  buildBackupJson,
  loadState,
  parseBackupJson,
  parseSyncAiJson,
  saveState
} from './storage.js';

const VALID_TABS = new Set(['pulpit', 'dziennik', 'skille']);

const state = {
  workouts: [],
  skills: [],
  lastSaved: ''
};

const ui = {
  activeTab: 'pulpit',
  selectedExercise: '',
  selectedMetric: 'e1rm', // 'e1rm' | 'maxWeight' | 'volume' | 'maxReps'
  journalCategory: 'ALL',
  expandedWorkouts: new Set(),
  pendingCsvWorkouts: null,
  pendingConfirm: null,
  editingWorkoutId: null,
  hideChartTooltip: null
};

function persistState() {
  const res = saveState(state);
  if (!res.ok) {
    console.error('Failed to save to localStorage:', res.error);
    if (res.quotaExceeded) {
      showToast('Pamięć localStorage jest pełna — pobierz kopię zapasową (.json) i usuń starsze dane.', 'error');
    } else {
      showToast('Uwaga: przeglądarka zablokowała localStorage. Zapisuj kopie .json.', 'error');
    }
  }
  updateSaveIndicator();
}

function updateSaveIndicator() {
  const el = document.getElementById('saveStatusText');
  if (!el) return;
  el.textContent = state.lastSaved
    ? `Zapis lokalny (offline) • ${state.lastSaved}`
    : 'Zapis lokalny (offline)';
}

function renderDeltaBadge(pct, emptyLabel = '—') {
  if (pct === null || pct === undefined) {
    return `<span class="badge badge-neutral">${escapeHtml(emptyLabel)}</span>`;
  }
  if (pct > 0) {
    return `<span class="badge badge-pos">+${pct.toFixed(1)}%</span>`;
  }
  if (pct < 0) {
    return `<span class="badge badge-neg">${pct.toFixed(1)}%</span>`;
  }
  return '<span class="badge badge-neutral">0.0%</span>';
}

// Dashboard
function renderPulpit() {
  const index = buildExercisesIndex(state.workouts);
  const isEmpty = index.length === 0;

  document.getElementById('pulpitEmpty').classList.toggle('hidden', !isEmpty);
  document.getElementById('pulpitContent').classList.toggle('hidden', isEmpty);

  if (isEmpty) return;

  const names = index.map((e) => e.name);
  if (!ui.selectedExercise || !names.includes(ui.selectedExercise)) {
    const bench = index.find((e) => e.name.toLowerCase().includes('wyciskanie leżąc (sztanga)'))
      || index.find((e) => e.name.toLowerCase().includes('bench press'))
      || index[0];
    ui.selectedExercise = bench.name;
  }

  const activeEx = index.find((e) => e.name === ui.selectedExercise) || index[0];

  document.getElementById('comboboxSelectedLabel').textContent = `${activeEx.name} (${activeEx.count})`;
  renderComboboxOptions(index);

  document.querySelectorAll('.seg-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.metric === ui.selectedMetric);
  });

  const chipsEl = document.getElementById('popularChips');
  chipsEl.innerHTML = index.slice(0, 7).map((item) => `
    <button type="button" class="chip ${item.name === activeEx.name ? 'active' : ''}" data-pick-ex="${escapeHtml(item.name)}">
      <span>${escapeHtml(item.name)}</span>
      <span class="chip-count num">${item.count}</span>
    </button>
  `).join('');

  renderWeeklySummary();
  renderKpis(activeEx);
  ui.hideChartTooltip = renderProgressChart({
    shell: document.getElementById('chartShell'),
    svg: document.getElementById('progressSvg'),
    tooltip: document.getElementById('chartTooltip'),
    titleEl: document.getElementById('chartTitle'),
    countEl: document.getElementById('chartSessionCount'),
    exItem: activeEx,
    selectedMetric: ui.selectedMetric
  });
  renderSessionHistoryTable(activeEx);
  renderAllExercisesTable(index);
}

function renderComboboxOptions(index) {
  const q = (document.getElementById('comboboxSearch')?.value || '').trim().toLowerCase();
  const filtered = index.filter((e) => !q || e.name.toLowerCase().includes(q));
  const listEl = document.getElementById('comboboxList');

  if (filtered.length === 0) {
    listEl.innerHTML = '<div style="padding:12px;text-align:center;font-size:12px;color:var(--text-muted);">Brak pasujących ćwiczeń</div>';
    return;
  }

  listEl.innerHTML = filtered.map((item) => `
    <button type="button" class="combobox-option ${item.name === ui.selectedExercise ? 'selected' : ''}" data-pick-ex="${escapeHtml(item.name)}">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(item.name)}</span>
      <span class="num" style="font-size:11px;opacity:0.7;flex-shrink:0;">${item.count} ses.</span>
    </button>
  `).join('');
}

function renderWeeklySummary() {
  const container = document.getElementById('weeklySummary');
  if (!container) return;

  if (state.workouts.length === 0) {
    container.style.display = 'none';
    return;
  }

  const summary = computeWeeklySummary(state.workouts);

  container.style.display = 'block';
  container.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
      <h2 class="card-title">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
        Podsumowanie tygodnia
      </h2>
      <span class="badge badge-blue">${summary.streak > 0 ? `${summary.streak} tyg. z rzędu 🔥` : 'Brak aktywności'}</span>
    </div>
    <div class="weekly-row">
      <div class="weekly-stat">
        <div class="weekly-stat-value num">${summary.thisWeekCount}</div>
        <div class="weekly-stat-label">Treningi (ten tydzień)</div>
      </div>
      <div class="weekly-stat">
        <div class="weekly-stat-value num">${summary.volDisplay}</div>
        <div class="weekly-stat-label">Objętość ${summary.volDelta !== null ? renderDeltaBadge(summary.volDelta) : ''}</div>
      </div>
      <div class="weekly-stat">
        <div class="weekly-stat-value num">${summary.lastWeekCount}</div>
        <div class="weekly-stat-label">Treningi (poprz. tydzień)</div>
      </div>
    </div>
  `;
}

function renderKpis(exItem) {
  const sessions = exItem.sessions;
  const latest = sessions[sessions.length - 1];
  const prev = sessions.length >= 2 ? sessions[sessions.length - 2] : null;
  const first = sessions[0];

  const latestM = resolveMetric(latest, ui.selectedMetric, exItem.isBodyweight);
  const prevM = prev ? resolveMetric(prev, ui.selectedMetric, exItem.isBodyweight) : null;
  const firstM = resolveMetric(first, ui.selectedMetric, exItem.isBodyweight);

  const pctPrev = prevM ? calcPctDelta(latestM.value, prevM.value) : null;
  const pctTotal = sessions.length >= 2 ? calcPctDelta(latestM.value, firstM.value) : null;
  const absTotal = sessions.length >= 2 ? Number((latestM.value - firstM.value).toFixed(1)) : null;

  let prSession = sessions[0];
  let prMetric = resolveMetric(prSession, ui.selectedMetric, exItem.isBodyweight);
  for (const s of sessions) {
    const m = resolveMetric(s, ui.selectedMetric, exItem.isBodyweight);
    if (m.value > prMetric.value || (m.value === prMetric.value && s.date > prSession.date)) {
      prMetric = m;
      prSession = s;
    }
  }

  const totalCls = pctTotal === null ? '' : (pctTotal > 0 ? 'pos' : (pctTotal < 0 ? 'neg' : ''));
  const totalDisplay = pctTotal === null
    ? 'Pierwszy zapis'
    : `${pctTotal > 0 ? '+' : ''}${pctTotal.toFixed(1)}%`;

  const absDiffText = absTotal === null
    ? 'Potrzebne min. 2 sesje'
    : `${absTotal > 0 ? '+' : ''}${fmtNum(absTotal)} ${latestM.unit} (${formatDateShort(first.date)} → ${formatDateShort(latest.date)})`;

  document.getElementById('kpiGrid').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Ostatni wynik • ${escapeHtml(latestM.label)}</span>
        ${renderDeltaBadge(pctPrev, 'Pierwszy zapis')}
      </div>
      <div class="kpi-value num">${fmtNum(latestM.value)} <span style="font-size:15px;font-weight:600;color:var(--text-muted);">${latestM.unit}</span></div>
      <div class="kpi-foot">
        <span>Najlepsza seria: <strong class="tnum" style="color:#fff;">${formatSetFull(latest.bestSet)}</strong></span>
        <span>${formatDatePL(latest.date)}</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Rekord (PR) • ${escapeHtml(prMetric.label)}</span>
        <span class="badge badge-blue">PR</span>
      </div>
      <div class="kpi-value num">${fmtNum(prMetric.value)} <span style="font-size:15px;font-weight:600;color:var(--text-muted);">${prMetric.unit}</span></div>
      <div class="kpi-foot">
        <span>Seria: <strong class="tnum" style="color:#fff;">${formatSetFull(prSession.bestSet)}</strong></span>
        <span>${formatDatePL(prSession.date)}</span>
      </div>
    </div>

    <div class="kpi-card">
      <div class="kpi-top">
        <span class="kpi-label">Zmiana całkowita</span>
        <span class="badge badge-neutral">${sessions.length} ${pluralSesja(sessions.length)}</span>
      </div>
      <div class="kpi-value num ${totalCls}">${totalDisplay}</div>
      <div class="kpi-foot">
        <span>${escapeHtml(absDiffText)}</span>
      </div>
    </div>
  `;
}

function renderSessionHistoryTable(exItem) {
  const firstM = resolveMetric(exItem.sessions[0], ui.selectedMetric, exItem.isBodyweight);
  document.getElementById('sessionTableSub').textContent = exItem.name;
  document.getElementById('sessionMetricHeader').textContent = `Wynik (${firstM.label})`;

  const enriched = exItem.sessions.map((s, idx) => {
    const m = resolveMetric(s, ui.selectedMetric, exItem.isBodyweight);
    const prevVal = idx > 0 ? resolveMetric(exItem.sessions[idx - 1], ui.selectedMetric, exItem.isBodyweight).value : null;
    return {
      session: s,
      metric: m,
      pct: calcPctDelta(m.value, prevVal)
    };
  }).reverse();

  document.getElementById('sessionHistoryTbody').innerHTML = enriched.map((row) => {
    const setsHtml = row.session.allSets.map((s) => {
      const isWarmup = (s.type || '').toLowerCase() === 'warmup';
      return `<span class="set-pill num ${isWarmup ? 'warmup' : ''}">${isWarmup ? '<span class="badge-warmup">R</span>' : ''}${formatSetCompact(s)}</span>`;
    }).join('');

    return `
      <tr>
        <td class="tnum" style="white-space:nowrap;font-weight:600;color:#fff;">${formatDatePL(row.session.date)}</td>
        <td style="white-space:nowrap;">${escapeHtml(row.session.workoutTitle)}</td>
        <td>${setsHtml}</td>
        <td class="text-right num" style="white-space:nowrap;font-weight:700;color:#fff;">${fmtNum(row.metric.value)} ${row.metric.unit}</td>
        <td class="text-right">${renderDeltaBadge(row.pct, 'Pierwszy')}</td>
      </tr>
    `;
  }).join('');
}

function renderAllExercisesTable(index) {
  const q = (document.getElementById('overviewSearch')?.value || '').trim().toLowerCase();
  const filtered = index.filter((item) => !q || item.name.toLowerCase().includes(q));
  const tbody = document.getElementById('allExercisesTbody');

  if (filtered.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5" class="text-center" style="padding:24px;color:var(--text-muted);">Brak ćwiczeń pasujących do filtra.</td></tr>';
    return;
  }

  tbody.innerHTML = filtered.map((item) => {
    const latest = item.sessions[item.sessions.length - 1];
    const prev = item.sessions.length >= 2 ? item.sessions[item.sessions.length - 2] : null;
    const mLatest = resolveMetric(latest, ui.selectedMetric, item.isBodyweight);
    const mPrev = prev ? resolveMetric(prev, ui.selectedMetric, item.isBodyweight) : null;
    const pct = mPrev ? calcPctDelta(mLatest.value, mPrev.value) : null;
    const isSelected = item.name === ui.selectedExercise;

    return `
      <tr class="row-clickable ${isSelected ? 'row-selected' : ''}" data-overview-pick="${escapeHtml(item.name)}">
        <td style="font-weight:600;color:${isSelected ? '#60a5fa' : '#fff'};">${escapeHtml(item.name)}</td>
        <td class="text-center num">${item.count}</td>
        <td class="tnum" style="white-space:nowrap;">${formatDatePL(latest.date)}</td>
        <td class="num" style="white-space:nowrap;color:#fff;font-weight:600;">${formatSetFull(latest.bestSet)}</td>
        <td class="text-right">${renderDeltaBadge(pct)}</td>
      </tr>
    `;
  }).join('');
}

// Journal
function renderDziennik() {
  const sorted = sortWorkoutsChronologically(state.workouts);

  const lastVolByTitle = new Map();
  const lastVolByCat = new Map();
  const volCompareMap = new Map();

  for (const w of sorted) {
    const vol = calcWorkoutVolume(w);
    const titleKey = (w.title || '').trim().toLowerCase();
    const cat = classifyWorkoutCategory(w.title);

    let prevVol = null;
    let compareLabel = '';

    if (lastVolByTitle.has(titleKey)) {
      prevVol = lastVolByTitle.get(titleKey);
      compareLabel = w.title;
    } else if (cat !== 'OTHER' && lastVolByCat.has(cat)) {
      prevVol = lastVolByCat.get(cat);
      compareLabel = cat;
    }

    const pct = (vol > 0 && prevVol > 0) ? calcPctDelta(vol, prevVol) : null;
    volCompareMap.set(w.id, { vol, pct, compareLabel });

    if (vol > 0) {
      lastVolByTitle.set(titleKey, vol);
      if (cat !== 'OTHER') lastVolByCat.set(cat, vol);
    }
  }

  document.querySelectorAll('#journalCategoryChips .chip').forEach((c) => {
    c.classList.toggle('active', c.dataset.jcat === ui.journalCategory);
  });

  const q = (document.getElementById('journalSearch')?.value || '').trim().toLowerCase();

  const filtered = [...sorted].reverse().filter((w) => {
    if (ui.journalCategory !== 'ALL' && classifyWorkoutCategory(w.title) !== ui.journalCategory) {
      return false;
    }
    if (!q) return true;
    const matchTitle = (w.title || '').toLowerCase().includes(q);
    const matchDate = (w.date || '').includes(q);
    const matchEx = (w.exercises || []).some((e) => (e.name || '').toLowerCase().includes(q));
    return matchTitle || matchDate || matchEx;
  });

  document.getElementById('journalCountLabel').textContent = `${filtered.length} z ${state.workouts.length} treningów`;

  const listEl = document.getElementById('workoutList');
  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="card empty-state">
        <h3>Brak treningów do wyświetlenia</h3>
        <p>Zmień filtr wyszukiwania albo zaimportuj historię z pliku CSV z Hevy lub Sync AI.</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = filtered.map((w) => {
    const isExp = ui.expandedWorkouts.has(w.id);
    const comp = volCompareMap.get(w.id) || { vol: 0, pct: null, compareLabel: '' };
    const totalSets = (w.exercises || []).reduce((acc, ex) => acc + (ex.sets ? ex.sets.length : 0), 0);

    let volBadgeHtml = '';
    if (comp.pct !== null) {
      const sign = comp.pct > 0 ? '+' : '';
      const cls = comp.pct > 0 ? 'badge-pos' : (comp.pct < 0 ? 'badge-neg' : 'badge-neutral');
      const shortLbl = comp.compareLabel.length > 14 ? comp.compareLabel.slice(0, 14) + '…' : comp.compareLabel;
      volBadgeHtml = `<span class="badge ${cls}" title="Zmiana objętości względem poprzedniego: ${escapeHtml(comp.compareLabel)}">${sign}${comp.pct.toFixed(1)}% vs poprz. ${escapeHtml(shortLbl)}</span>`;
    }

    const exercisesHtml = (w.exercises || []).map((ex) => {
      const stats = getExerciseSessionStats(ex);
      const setsHtml = (ex.sets || []).map((s, idx) => {
        const isWarmup = (s.type || '').toLowerCase() === 'warmup';
        return `
          <span class="set-pill num ${isWarmup ? 'warmup' : ''}">
            <span style="color:var(--text-dim);">Seria ${idx + 1}:</span>
            <strong style="color:#fff;">${formatSetFull(s)}</strong>
            ${isWarmup ? '<span class="badge-warmup">R</span>' : ''}
          </span>
        `;
      }).join('');

      return `
        <div class="ex-block">
          <div class="ex-head">
            <button type="button" class="ex-link" data-jump-ex="${escapeHtml(ex.name)}">${escapeHtml(ex.name)}</button>
            <div style="display:flex;gap:12px;font-size:11.5px;color:var(--text-muted);" class="num">
              ${stats.e1rm > 0 ? `<span>e1RM: <strong style="color:#60a5fa;">${fmtNum(stats.e1rm)} kg</strong></span>` : ''}
              ${stats.volume > 0 ? `<span>Objętość: <strong style="color:#fff;">${fmtNum(stats.volume)} kg</strong></span>` : `<span>Powt.: <strong style="color:#fff;">${stats.totalReps}</strong></span>`}
            </div>
          </div>
          ${ex.notes ? `<p class="ex-note">${escapeHtml(ex.notes)}</p>` : ''}
          <div>${setsHtml}</div>
        </div>
      `;
    }).join('');

    return `
      <article class="workout-card ${isExp ? 'expanded' : ''}">
        <div class="workout-head" data-toggle-workout="${escapeHtml(w.id)}">
          <div>
            <h3 class="workout-title">${escapeHtml(w.title)}</h3>
            <div class="workout-meta">
              <span class="tnum">${formatDatePL(w.date)}${w.startTime ? ` • ${escapeHtml(w.startTime)}` : ''}</span>
              <span>•</span>
              <span class="tnum">${(w.exercises || []).length} ćw. • ${totalSets} serii</span>
            </div>
          </div>

          <div class="workout-right">
            <div class="workout-vol-block">
              <div class="workout-vol-label">Objętość</div>
              <div class="workout-vol-row">
                <span class="workout-vol-val num">${comp.vol > 0 ? `${fmtNum(comp.vol, 0)} kg` : 'BW'}</span>
                ${volBadgeHtml}
              </div>
            </div>
            <svg class="chevron-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
          </div>
        </div>

        <div class="workout-body">
          ${exercisesHtml}
          <div class="workout-foot">
            <span style="font-size:11.5px;color:var(--text-dim);">Kliknij nazwę ćwiczenia, aby otworzyć jego wykres na Pulpicie.</span>
            <div class="workout-foot-actions">
              <button type="button" class="btn btn-secondary btn-sm" data-edit-workout="${escapeHtml(w.id)}">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edytuj
              </button>
              <button type="button" class="btn btn-danger-soft btn-sm" data-delete-workout="${escapeHtml(w.id)}">Usuń trening</button>
            </div>
          </div>
        </div>
      </article>
    `;
  }).join('');
}

// Skills
function renderSkille() {
  let total = 0;
  let done = 0;
  state.skills.forEach((cat) => {
    total += cat.items.length;
    done += cat.items.filter((i) => i.completed).length;
  });

  const totalPct = total > 0 ? Math.round((done / total) * 100) : 0;
  document.getElementById('skillsTotalBadge').textContent = `${done} / ${total} zaliczone (${totalPct}%)`;

  document.getElementById('skillsGrid').innerHTML = state.skills.map((cat) => {
    const catDone = cat.items.filter((i) => i.completed).length;
    const catTotal = cat.items.length;
    const pct = catTotal > 0 ? Math.round((catDone / catTotal) * 100) : 0;

    const itemsHtml = cat.items.map((item) => `
      <div class="checkpoint-row ${item.completed ? 'done' : ''}">
        <label class="checkpoint-label">
          <input
            type="checkbox"
            class="checkpoint-checkbox"
            data-cp-toggle="${escapeHtml(cat.id)}|${escapeHtml(item.id)}"
            ${item.completed ? 'checked' : ''}
          />
          <span class="checkpoint-text">${escapeHtml(item.label)}</span>
        </label>
        <div class="checkpoint-actions">
          <input
            type="date"
            class="checkpoint-date"
            data-cp-date="${escapeHtml(cat.id)}|${escapeHtml(item.id)}"
            value="${escapeHtml(item.date || '')}"
            title="Data zaliczenia"
          />
          <button
            type="button"
            class="checkpoint-del"
            data-cp-del="${escapeHtml(cat.id)}|${escapeHtml(item.id)}"
            title="Usuń checkpoint"
            aria-label="Usuń checkpoint"
          >×</button>
        </div>
      </div>
    `).join('');

    return `
      <div class="skill-card">
        <div>
          <div class="skill-head">
            <h3 class="skill-title">${escapeHtml(cat.title)}</h3>
            <div style="display:flex;align-items:center;gap:8px;">
              <span class="skill-counter num">${catDone} / ${catTotal} zaliczone</span>
              <button type="button" class="checkpoint-del cat-del-btn" data-cat-del="${escapeHtml(cat.id)}" title="Usuń kategorię" aria-label="Usuń kategorię">×</button>
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill" style="width:${pct}%;background:${escapeHtml(cat.color || '#3b82f6')};"></div>
          </div>
          <div class="checkpoint-list">
            ${itemsHtml || '<div style="font-size:12px;color:var(--text-dim);padding:6px 0;">Brak checkpointów.</div>'}
          </div>
        </div>

        <form class="add-cp-form" data-add-cp="${escapeHtml(cat.id)}">
          <input type="text" name="label" class="input" placeholder="Nowy checkpoint..." required />
          <button type="submit" class="btn btn-secondary btn-sm">+ Dodaj checkpoint</button>
        </form>
      </div>
    `;
  }).join('');
}

function addSkillCategory(title, color) {
  const id = `cat-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`;
  state.skills.push({
    id,
    title: title.trim(),
    color: color || '#6366f1',
    items: []
  });
  persistState();
  renderSkille();
  showToast(`Dodano kategorię „${title}”.`, 'success');
}

// Edit workout modal
function openEditWorkout(workoutId) {
  const workout = state.workouts.find((w) => w.id === workoutId);
  if (!workout) return;
  ui.editingWorkoutId = workoutId;
  const body = document.getElementById('editModalBody');
  body.innerHTML = renderEditForm(workout);
  body.scrollTop = 0;
  openModal('editModal');
}

function renderEditForm(workout) {
  const exercisesHtml = (workout.exercises || []).map((ex, exIdx) => {
    const setsHtml = (ex.sets || []).map((s, sIdx) => {
      const isWarmup = (s.type || 'normal').toLowerCase() === 'warmup';
      return `
        <span class="edit-set-label">S${sIdx + 1}</span>
        <input type="number" class="input" data-edit-set="${exIdx}|${sIdx}|w" value="${s.w || 0}" step="any" min="0" placeholder="kg" />
        <input type="number" class="input" data-edit-set="${exIdx}|${sIdx}|r" value="${s.r || 0}" step="1" min="0" placeholder="powt." />
        <button type="button" class="edit-type-btn${isWarmup ? ' active' : ''}" data-edit-toggle-type="${exIdx}|${sIdx}" data-set-type="${isWarmup ? 'warmup' : 'normal'}" title="Seria rozgrzewkowa (nie wlicza się do PR/e1RM)" aria-pressed="${isWarmup ? 'true' : 'false'}">R</button>
        <button type="button" class="edit-del-btn" data-edit-del-set="${exIdx}|${sIdx}" title="Usuń serię" aria-label="Usuń serię">×</button>
      `;
    }).join('');

    return `
      <div class="edit-exercise-block" data-edit-ex-idx="${exIdx}">
        <div class="edit-exercise-header">
          <input type="text" class="input" data-edit-ex-name="${exIdx}" value="${escapeHtml(ex.name)}" placeholder="Nazwa ćwiczenia" style="flex:1;" />
          <button type="button" class="btn btn-danger-soft btn-sm" data-edit-del-ex="${exIdx}">Usuń</button>
        </div>
        <input type="text" class="input" data-edit-ex-notes="${exIdx}" value="${escapeHtml(ex.notes || '')}" placeholder="Notatki (opcjonalne)" style="margin-bottom:10px;font-size:12px;" />
        <div class="edit-sets-grid">
          <span class="edit-set-label" style="color:var(--text-dim);">#</span>
          <span class="edit-set-label">Ciężar (kg)</span>
          <span class="edit-set-label">Powtórzenia</span>
          <span class="edit-set-label" title="Seria rozgrzewkowa">Rozgrz.</span>
          <span></span>
          ${setsHtml}
        </div>
        <div class="edit-btn-row">
          <button type="button" class="btn btn-secondary btn-sm" data-edit-add-set="${exIdx}">+ Seria</button>
        </div>
      </div>
    `;
  }).join('');

  return `
    <div class="edit-meta-grid">
      <div>
        <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Nazwa treningu</label>
        <input type="text" class="input" id="editTitle" value="${escapeHtml(workout.title || '')}" />
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Data</label>
        <input type="date" class="input" id="editDate" value="${escapeHtml(workout.date || '')}" />
      </div>
      <div>
        <label style="display:block;font-size:11px;font-weight:600;color:var(--text-muted);margin-bottom:4px;">Godzina startu</label>
        <input type="time" class="input" id="editStartTime" value="${escapeHtml(workout.startTime || '')}" />
      </div>
    </div>
    <div id="editExercisesList">
      ${exercisesHtml}
    </div>
    <button type="button" class="btn btn-secondary" id="editAddExercise" style="width:100%;margin-top:8px;">+ Dodaj ćwiczenie</button>
  `;
}

function readEditFormExercises(filterEmptySets) {
  const blocks = document.querySelectorAll('#editExercisesList .edit-exercise-block');
  const exercises = [];
  blocks.forEach((block) => {
    const exIdx = parseInt(block.dataset.editExIdx, 10);
    const name = (block.querySelector(`[data-edit-ex-name="${exIdx}"]`) || {}).value || '';
    const notes = (block.querySelector(`[data-edit-ex-notes="${exIdx}"]`) || {}).value || '';

    const sets = [];
    block.querySelectorAll('[data-edit-set]').forEach((input) => {
      const parts = input.dataset.editSet.split('|');
      const sIdx = parseInt(parts[1], 10);
      const field = parts[2];
      if (!sets[sIdx]) sets[sIdx] = { w: 0, r: 0, type: 'normal' };
      sets[sIdx][field] = parseFloat(input.value) || 0;
    });
    block.querySelectorAll('[data-edit-toggle-type]').forEach((btn) => {
      const parts = btn.dataset.editToggleType.split('|');
      const sIdx = parseInt(parts[1], 10);
      if (!sets[sIdx]) sets[sIdx] = { w: 0, r: 0, type: 'normal' };
      sets[sIdx].type = btn.dataset.setType === 'warmup' ? 'warmup' : 'normal';
    });

    let cleanSets = sets.filter(Boolean);
    if (filterEmptySets) {
      cleanSets = cleanSets.filter((s) => s.w > 0 || s.r > 0);
    }

    exercises.push({
      name: filterEmptySets ? name.trim() : name,
      notes: filterEmptySets ? notes.trim() : notes,
      sets: cleanSets
    });
  });
  return exercises;
}

function saveEditWorkout() {
  const title = ((document.getElementById('editTitle') || {}).value || '').trim() || 'Trening';
  const date = (document.getElementById('editDate') || {}).value || getTodayISO();
  const startTime = (document.getElementById('editStartTime') || {}).value || '';
  const exercises = readEditFormExercises(true).filter((ex) => ex.name && ex.sets.length > 0);

  if (exercises.length === 0) {
    showToast('Trening musi zawierać przynajmniej jedno ćwiczenie z serią.', 'error');
    return;
  }

  const idx = state.workouts.findIndex((w) => w.id === ui.editingWorkoutId);
  if (idx === -1) {
    showToast('Nie znaleziono treningu do edycji.', 'error');
    closeModal('editModal');
    return;
  }

  state.workouts[idx].title = title;
  state.workouts[idx].date = date;
  state.workouts[idx].startTime = startTime;
  state.workouts[idx].exercises = exercises;

  persistState();
  renderAll();
  closeModal('editModal');
  showToast('Trening zaktualizowany.', 'success');
}

function refreshEditForm(mutator) {
  const title = (document.getElementById('editTitle') || {}).value || '';
  const date = (document.getElementById('editDate') || {}).value || '';
  const startTime = (document.getElementById('editStartTime') || {}).value || '';
  const body = document.getElementById('editModalBody');
  const prevScroll = body ? body.scrollTop : 0;

  const allEx = readEditFormExercises(false);
  const mutated = mutator(allEx);
  const fake = { title, date, startTime, exercises: mutated };
  body.innerHTML = renderEditForm(fake);
  body.scrollTop = prevScroll;
}

// Imports and backup
function applyCsvImport(mode) {
  const imported = ui.pendingCsvWorkouts;
  if (!Array.isArray(imported) || imported.length === 0) {
    closeModal('csvModal');
    return;
  }

  if (mode === 'replace') {
    const seen = new Set();
    const unique = [];
    for (const w of imported) {
      const k = dedupKey(w);
      if (!seen.has(k)) {
        seen.add(k);
        unique.push(w);
      }
    }
    state.workouts = unique;
    ui.expandedWorkouts.clear();
    ui.selectedExercise = '';
    persistState();
    renderAll();
    closeModal('csvModal');
    showToast(`Zastąpiono historię — zaimportowano ${unique.length} treningów z Hevy.`, 'success');
  } else {
    const existingKeys = new Set(state.workouts.map(dedupKey));
    let added = 0;
    let skipped = 0;
    for (const w of imported) {
      const k = dedupKey(w);
      if (existingKeys.has(k)) {
        skipped++;
      } else {
        existingKeys.add(k);
        state.workouts.push(w);
        added++;
      }
    }
    persistState();
    renderAll();
    closeModal('csvModal');
    if (added > 0) {
      showToast(`Dodano ${added} nowych treningów (pominięto ${skipped} duplikatów).`, 'success');
    } else {
      showToast(`Brak nowych treningów — wszystkie (${skipped}) są już w dzienniku.`, 'info');
    }
  }

  ui.pendingCsvWorkouts = null;
}

function handleAiJsonSubmit() {
  const textarea = document.getElementById('aiJsonInput');
  const errEl = document.getElementById('aiJsonError');
  errEl.classList.remove('visible');
  errEl.textContent = '';

  const raw = textarea.value.trim();
  if (!raw) {
    errEl.textContent = 'Wklej najpierw kod JSON treningu.';
    errEl.classList.add('visible');
    return;
  }

  try {
    const { workoutsToAdd, skipped } = parseSyncAiJson(raw, state.workouts);
    workoutsToAdd.forEach((workout) => {
      state.workouts.push(workout);
      ui.expandedWorkouts.add(workout.id);
    });

    persistState();
    renderAll();
    textarea.value = '';
    closeModal('syncAiModal');

    if (workoutsToAdd.length > 0) {
      showToast(`Dodano ${workoutsToAdd.length} trening(ów) z Sync AI${skipped > 0 ? ` (pominięto ${skipped} dupl.)` : ''}.`, 'success');
    } else {
      showToast('Wszystkie wklejone treningi już istnieją w dzienniku.', 'info');
    }
  } catch (err) {
    errEl.textContent = `Błąd JSON: ${err.message}`;
    errEl.classList.add('visible');
  }
}

function exportFullBackup() {
  const data = buildBackupJson(state);
  const blob = new Blob([data], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `training-tracker-backup-${getTodayISO()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  showToast('Pobrano kopię zapasową (.json).', 'success');
}

function importFullBackup(jsonText) {
  try {
    const parsed = parseBackupJson(jsonText);
    askConfirm(
      'Wczytać kopię zapasową?',
      `Plik zawiera ${parsed.workouts.length} treningów i ${parsed.skills.length} kategorii skilli. Obecne dane zostaną nadpisane.`,
      () => {
        state.workouts = parsed.workouts;
        state.skills = parsed.skills;
        ui.expandedWorkouts.clear();
        ui.selectedExercise = '';
        persistState();
        renderAll();
        showToast(`Przywrócono kopię zapasową (${state.workouts.length} treningów).`, 'success');
      }
    );
  } catch (err) {
    showToast(`Błąd wczytywania kopii: ${err.message}`, 'error');
  }
}

// Tabs, modals, toasts
function switchTab(tabName, { updateHash = true } = {}) {
  const target = VALID_TABS.has(tabName) ? tabName : 'pulpit';
  ui.activeTab = target;

  document.querySelectorAll('.tab-panel').forEach((p) => {
    p.classList.toggle('active', p.id === `tab-${target}`);
  });
  document.querySelectorAll('.nav-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === target);
  });
  document.querySelectorAll('.mobile-nav-btn').forEach((b) => {
    b.classList.toggle('active', b.dataset.tab === target);
  });

  if (updateHash && typeof history !== 'undefined' && typeof history.replaceState === 'function') {
    history.replaceState(null, '', `#${target}`);
  }

  if (target === 'pulpit') renderPulpit();
  if (target === 'dziennik') renderDziennik();
  if (target === 'skille') renderSkille();
}

function renderAll() {
  renderPulpit();
  renderDziennik();
  renderSkille();
}

function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  if (el._trapHandler) {
    el.removeEventListener('keydown', el._trapHandler);
    delete el._trapHandler;
  }
  if (!el.classList.contains('open')) {
    el._prevFocus = document.activeElement;
  }
  el.classList.add('open');

  const getFocusable = () => Array.from(el.querySelectorAll(
    'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
  )).filter((node) => node.offsetParent !== null || node.getClientRects().length > 0);

  el._trapHandler = (e) => {
    if (e.key !== 'Tab') return;
    const focusable = getFocusable();
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first || !el.contains(document.activeElement)) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last || !el.contains(document.activeElement)) {
      e.preventDefault();
      first.focus();
    }
  };
  el.addEventListener('keydown', el._trapHandler);

  const initialTarget = el.querySelector('.modal-body input:not([disabled]), .modal-body textarea:not([disabled]), .modal-body select:not([disabled])')
    || el.querySelector('.modal-body button:not([disabled])')
    || getFocusable()[0];
  if (initialTarget) {
    setTimeout(() => initialTarget.focus(), 20);
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('open');
  if (el._trapHandler) {
    el.removeEventListener('keydown', el._trapHandler);
    delete el._trapHandler;
  }
  if (id === 'editModal') {
    ui.editingWorkoutId = null;
  }
  const prev = el._prevFocus;
  delete el._prevFocus;
  if (prev && prev.isConnected && typeof prev.focus === 'function') {
    prev.focus();
  }
}

function askConfirm(title, message, onConfirm) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmMessage').textContent = message;
  ui.pendingConfirm = onConfirm;
  openModal('confirmModal');
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  container.appendChild(el);
  setTimeout(() => {
    el.style.opacity = '0';
    el.style.transition = 'opacity 0.25s ease';
    setTimeout(() => el.remove(), 250);
  }, 3500);
}

function showUndoToast(msg, onUndo, timeoutMs = 5000) {
  const container = document.getElementById('toastContainer');
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${escapeHtml(msg)}</span><button class="undo-btn" type="button">Cofnij</button>`;
  container.appendChild(el);

  let undone = false;
  el.querySelector('.undo-btn').addEventListener('click', () => {
    undone = true;
    if (typeof onUndo === 'function') onUndo();
    el.remove();
  });

  setTimeout(() => {
    if (!undone) {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.25s ease';
      setTimeout(() => el.remove(), 250);
    }
  }, timeoutMs);
}

// Event listeners
function bindEvents() {
  const combobox = document.getElementById('exerciseCombobox');
  const comboboxSearch = document.getElementById('comboboxSearch');

  document.getElementById('comboboxTrigger').addEventListener('click', (e) => {
    e.stopPropagation();
    const opening = !combobox.classList.contains('open');
    combobox.classList.toggle('open', opening);
    document.getElementById('comboboxTrigger').setAttribute('aria-expanded', String(opening));
    if (opening) {
      comboboxSearch.value = '';
      renderComboboxOptions(buildExercisesIndex(state.workouts));
      setTimeout(() => comboboxSearch.focus(), 10);
    }
  });

  comboboxSearch.addEventListener('input', () => {
    renderComboboxOptions(buildExercisesIndex(state.workouts));
  });

  comboboxSearch.addEventListener('click', (e) => e.stopPropagation());

  document.getElementById('btnLoadDemo')?.addEventListener('click', () => {
    state.workouts = getDemoWorkouts();
    const chrono = sortWorkoutsChronologically(state.workouts);
    ui.expandedWorkouts.clear();
    if (chrono.length > 0) {
      ui.expandedWorkouts.add(chrono[chrono.length - 1].id);
    }
    ui.selectedExercise = '';
    persistState();
    renderAll();
    showToast('Załadowano przykładowe treningi demo.', 'success');
  });

  document.addEventListener('touchstart', (e) => {
    if (!e.target.closest('#chartShell') && typeof ui.hideChartTooltip === 'function') {
      ui.hideChartTooltip();
    }
  }, { passive: true });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#chartShell') && typeof ui.hideChartTooltip === 'function') {
      ui.hideChartTooltip();
    }

    if (!e.target.closest('#exerciseCombobox')) {
      combobox.classList.remove('open');
      document.getElementById('comboboxTrigger').setAttribute('aria-expanded', 'false');
    }

    const tabBtn = e.target.closest('[data-tab]');
    if (tabBtn) {
      switchTab(tabBtn.dataset.tab);
      return;
    }

    const jumpTab = e.target.closest('[data-tab-jump]');
    if (jumpTab) {
      switchTab(jumpTab.dataset.tabJump);
      return;
    }

    const segBtn = e.target.closest('[data-metric]');
    if (segBtn) {
      ui.selectedMetric = segBtn.dataset.metric;
      renderPulpit();
      return;
    }

    const pickEx = e.target.closest('[data-pick-ex]');
    if (pickEx) {
      ui.selectedExercise = pickEx.dataset.pickEx;
      combobox.classList.remove('open');
      renderPulpit();
      return;
    }

    const overRow = e.target.closest('[data-overview-pick]');
    if (overRow) {
      ui.selectedExercise = overRow.dataset.overviewPick;
      renderPulpit();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const jumpEx = e.target.closest('[data-jump-ex]');
    if (jumpEx) {
      ui.selectedExercise = jumpEx.dataset.jumpEx;
      switchTab('pulpit');
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }

    const jCat = e.target.closest('[data-jcat]');
    if (jCat) {
      ui.journalCategory = jCat.dataset.jcat;
      renderDziennik();
      return;
    }

    const toggleW = e.target.closest('[data-toggle-workout]');
    if (toggleW) {
      const id = toggleW.dataset.toggleWorkout;
      if (ui.expandedWorkouts.has(id)) ui.expandedWorkouts.delete(id);
      else ui.expandedWorkouts.add(id);
      renderDziennik();
      return;
    }

    const editW = e.target.closest('[data-edit-workout]');
    if (editW) {
      openEditWorkout(editW.dataset.editWorkout);
      return;
    }

    const delW = e.target.closest('[data-delete-workout]');
    if (delW) {
      const id = delW.dataset.deleteWorkout;
      const targetIdx = state.workouts.findIndex((w) => w.id === id);
      if (targetIdx === -1) return;
      const removed = state.workouts[targetIdx];
      state.workouts.splice(targetIdx, 1);
      ui.expandedWorkouts.delete(id);
      persistState();
      renderAll();
      showUndoToast(
        `Usunięto „${removed.title}” (${formatDatePL(removed.date)}).`,
        () => {
          state.workouts.splice(targetIdx, 0, removed);
          persistState();
          renderAll();
          showToast('Przywrócono trening.', 'success');
        }
      );
      return;
    }

    const delCat = e.target.closest('[data-cat-del]');
    if (delCat) {
      const catId = delCat.dataset.catDel;
      const catIdx = state.skills.findIndex((c) => c.id === catId);
      if (catIdx === -1) return;
      const removedCat = state.skills[catIdx];
      state.skills.splice(catIdx, 1);
      persistState();
      renderSkille();
      showUndoToast(
        `Usunięto kategorię „${removedCat.title}”.`,
        () => {
          state.skills.splice(catIdx, 0, removedCat);
          persistState();
          renderSkille();
        }
      );
      return;
    }

    const delCp = e.target.closest('[data-cp-del]');
    if (delCp) {
      const [catId, itemId] = delCp.dataset.cpDel.split('|');
      const cat = state.skills.find((c) => c.id === catId);
      if (!cat) return;
      const cpIdx = cat.items.findIndex((i) => i.id === itemId);
      if (cpIdx === -1) return;
      const removedCp = cat.items[cpIdx];
      cat.items.splice(cpIdx, 1);
      persistState();
      renderSkille();
      showUndoToast(
        `Usunięto checkpoint „${removedCp.label}”.`,
        () => {
          const restoreCat = state.skills.find((c) => c.id === catId);
          if (restoreCat) {
            restoreCat.items.splice(cpIdx, 0, removedCp);
            persistState();
            renderSkille();
          }
        }
      );
      return;
    }

    const closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
      closeModal(closeBtn.dataset.closeModal);
    }
  });

  document.getElementById('overviewSearch').addEventListener('input', () => {
    renderAllExercisesTable(buildExercisesIndex(state.workouts));
  });
  document.getElementById('journalSearch').addEventListener('input', renderDziennik);

  const csvInput = document.getElementById('hevyCsvInput');
  document.getElementById('btnImportHevy').addEventListener('click', () => csvInput.click());
  csvInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsedWorkouts = parseHevyCsvFile(String(ev.target.result || ''));
        if (parsedWorkouts.length === 0) {
          showToast('Nie znaleziono żadnych serii siłowych w wybranym pliku CSV.', 'error');
        } else {
          const totalSets = parsedWorkouts.reduce((acc, w) => acc + w.exercises.reduce((a, ex) => a + ex.sets.length, 0), 0);
          ui.pendingCsvWorkouts = parsedWorkouts;
          document.getElementById('csvSummaryText').innerHTML =
            `Wykryto <strong style="color:#fff;">${parsedWorkouts.length}</strong> treningów (<strong style="color:#fff;">${totalSets}</strong> serii) w pliku <code>${escapeHtml(file.name)}</code>. Wybierz sposób importu:`;
          openModal('csvModal');
        }
      } catch (err) {
        showToast(`Błąd pliku CSV: ${err.message}`, 'error');
      } finally {
        csvInput.value = '';
      }
    };
    reader.readAsText(file, 'UTF-8');
  });

  document.getElementById('csvMergeBtn').addEventListener('click', () => applyCsvImport('merge'));
  document.getElementById('csvReplaceBtn').addEventListener('click', () => applyCsvImport('replace'));

  document.getElementById('btnOpenSyncAi').addEventListener('click', () => {
    document.getElementById('aiJsonError').classList.remove('visible');
    openModal('syncAiModal');
  });
  document.getElementById('btnFillAiExample').addEventListener('click', () => {
    document.getElementById('aiJsonInput').value = JSON.stringify({
      date: getTodayISO(),
      startTime: '18:00',
      title: 'PUSH',
      exercises: [
        {
          name: 'Wyciskanie leżąc (sztanga)',
          sets: [{ w: 75, r: 5 }, { w: 75, r: 5 }, { w: 75, r: 5 }, { w: 75, r: 5 }]
        },
        {
          name: 'Pompki na poręczach',
          sets: [{ w: 0, r: 12 }, { w: 0, r: 12 }, { w: 0, r: 12 }]
        }
      ]
    }, null, 2);
  });
  document.getElementById('btnSubmitAiJson').addEventListener('click', handleAiJsonSubmit);

  document.getElementById('btnExportBackup').addEventListener('click', exportFullBackup);
  const backupInput = document.getElementById('backupJsonInput');
  document.getElementById('btnImportBackup').addEventListener('click', () => backupInput.click());
  backupInput.addEventListener('change', (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      importFullBackup(String(ev.target.result || ''));
      backupInput.value = '';
    };
    reader.readAsText(file, 'UTF-8');
  });

  document.getElementById('btnSaveEdit').addEventListener('click', saveEditWorkout);

  document.getElementById('editModalBody').addEventListener('click', (e) => {
    const toggleType = e.target.closest('[data-edit-toggle-type]');
    if (toggleType) {
      const nextWarmup = toggleType.dataset.setType !== 'warmup';
      toggleType.dataset.setType = nextWarmup ? 'warmup' : 'normal';
      toggleType.classList.toggle('active', nextWarmup);
      toggleType.setAttribute('aria-pressed', nextWarmup ? 'true' : 'false');
      return;
    }
    const delSet = e.target.closest('[data-edit-del-set]');
    if (delSet) {
      const parts = delSet.dataset.editDelSet.split('|').map(Number);
      refreshEditForm((exs) => {
        if (exs[parts[0]] && exs[parts[0]].sets) exs[parts[0]].sets.splice(parts[1], 1);
        return exs;
      });
      return;
    }
    const delEx = e.target.closest('[data-edit-del-ex]');
    if (delEx) {
      refreshEditForm((exs) => {
        exs.splice(parseInt(delEx.dataset.editDelEx, 10), 1);
        return exs;
      });
      return;
    }
    const addSet = e.target.closest('[data-edit-add-set]');
    if (addSet) {
      refreshEditForm((exs) => {
        const idx = parseInt(addSet.dataset.editAddSet, 10);
        if (exs[idx]) exs[idx].sets.push({ w: 0, r: 0, type: 'normal' });
        return exs;
      });
      return;
    }
    if (e.target.closest('#editAddExercise')) {
      refreshEditForm((exs) => {
        exs.push({ name: '', notes: '', sets: [{ w: 0, r: 0, type: 'normal' }] });
        return exs;
      });
    }
  });

  document.getElementById('addCategoryForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const titleInput = e.target.querySelector('input[name="title"]');
    const colorInput = e.target.querySelector('input[name="color"]');
    const title = (titleInput.value || '').trim();
    if (!title) return;
    addSkillCategory(title, colorInput.value);
    titleInput.value = '';
  });

  document.addEventListener('change', (e) => {
    const toggle = e.target.closest('[data-cp-toggle]');
    if (toggle) {
      const [catId, itemId] = toggle.dataset.cpToggle.split('|');
      const cat = state.skills.find((c) => c.id === catId);
      const item = cat?.items.find((i) => i.id === itemId);
      if (!item) return;
      item.completed = toggle.checked;
      item.date = item.completed ? (item.date || getTodayISO()) : '';
      persistState();
      renderSkille();
      return;
    }

    const dateInput = e.target.closest('[data-cp-date]');
    if (dateInput) {
      const [catId, itemId] = dateInput.dataset.cpDate.split('|');
      const cat = state.skills.find((c) => c.id === catId);
      const item = cat?.items.find((i) => i.id === itemId);
      if (!item) return;
      item.date = dateInput.value;
      if (item.date && !item.completed) item.completed = true;
      persistState();
      renderSkille();
    }
  });

  document.addEventListener('submit', (e) => {
    const form = e.target.closest('[data-add-cp]');
    if (!form) return;
    e.preventDefault();
    const catId = form.dataset.addCp;
    const input = form.querySelector('input[name="label"]');
    const label = input.value.trim();
    if (!label) return;
    const cat = state.skills.find((c) => c.id === catId);
    if (!cat) return;
    cat.items.push({
      id: `cp-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      label,
      completed: false,
      date: ''
    });
    input.value = '';
    persistState();
    renderSkille();
    showToast('Dodano checkpoint.', 'success');
  });

  document.getElementById('confirmCancelBtn').addEventListener('click', () => {
    ui.pendingConfirm = null;
    closeModal('confirmModal');
  });
  document.getElementById('confirmOkBtn').addEventListener('click', () => {
    const fn = ui.pendingConfirm;
    ui.pendingConfirm = null;
    closeModal('confirmModal');
    if (typeof fn === 'function') fn();
  });

  ['csvModal', 'syncAiModal', 'confirmModal', 'editModal'].forEach((id) => {
    document.getElementById(id).addEventListener('click', (e) => {
      if (e.target.id === id) closeModal(id);
    });
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      ['csvModal', 'syncAiModal', 'confirmModal', 'editModal'].forEach(closeModal);
      combobox.classList.remove('open');
    }
  });

  window.addEventListener('hashchange', () => {
    const hashTab = location.hash.replace(/^#/, '').toLowerCase();
    if (VALID_TABS.has(hashTab) && hashTab !== ui.activeTab) {
      switchTab(hashTab, { updateHash: false });
    }
  });

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    if (ui.activeTab !== 'pulpit') return;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      const idx = buildExercisesIndex(state.workouts);
      const active = idx.find((e) => e.name === ui.selectedExercise);
      if (active) {
        ui.hideChartTooltip = renderProgressChart({
          shell: document.getElementById('chartShell'),
          svg: document.getElementById('progressSvg'),
          tooltip: document.getElementById('chartTooltip'),
          titleEl: document.getElementById('chartTitle'),
          countEl: document.getElementById('chartSessionCount'),
          exItem: active,
          selectedMetric: ui.selectedMetric
        });
      }
    }, 90);
  });
}

window.addEventListener('DOMContentLoaded', () => {
  const loaded = loadState();
  state.workouts = loaded.workouts;
  state.skills = loaded.skills;
  state.lastSaved = loaded.lastSaved;
  updateSaveIndicator();

  if (state.workouts.length > 0) {
    const chrono = sortWorkoutsChronologically(state.workouts);
    ui.expandedWorkouts.add(chrono[chrono.length - 1].id);
  }

  bindEvents();
  renderAll();

  const hashTab = location.hash.replace(/^#/, '').toLowerCase();
  if (VALID_TABS.has(hashTab) && hashTab !== 'pulpit') {
    switchTab(hashTab, { updateHash: false });
  }

  if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
    navigator.serviceWorker.register('sw.js').catch((err) => {
      console.warn('SW registration failed:', err);
    });
  }
});
