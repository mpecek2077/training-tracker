import {
  calcPctDelta,
  escapeHtml,
  fmtNum,
  formatDatePL,
  formatDateShort,
  formatSetFull,
  pluralSesja,
  resolveMetric
} from './analytics.js';

export function renderProgressChart({ shell, svg, tooltip, titleEl, countEl, exItem, selectedMetric }) {
  const sessions = exItem.sessions;
  const firstM = resolveMetric(sessions[0], selectedMetric, exItem.isBodyweight);

  titleEl.textContent = `${exItem.name} — ${firstM.label}`;
  countEl.textContent = `${sessions.length} ${pluralSesja(sessions.length)}`;

  tooltip.classList.remove('visible');

  const rect = shell.getBoundingClientRect();
  const W = Math.max(320, Math.round(rect.width || 700));
  const H = Math.max(220, Math.round(rect.height || 300));

  const pad = { top: 22, right: 24, bottom: 38, left: 56 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const points = sessions.map((s, idx) => {
    const m = resolveMetric(s, selectedMetric, exItem.isBodyweight);
    const prevVal = idx > 0 ? resolveMetric(sessions[idx - 1], selectedMetric, exItem.isBodyweight).value : null;
    const pct = calcPctDelta(m.value, prevVal);
    return {
      idx,
      session: s,
      value: m.value,
      unit: m.unit,
      label: m.label,
      pct
    };
  });

  const vals = points.map((p) => p.value);
  let minVal = Math.min(...vals);
  let maxVal = Math.max(...vals);

  if (minVal === maxVal) {
    const delta = minVal === 0 ? 10 : Math.max(2, minVal * 0.12);
    minVal = Math.max(0, minVal - delta);
    maxVal = maxVal + delta;
  } else {
    const span = maxVal - minVal;
    minVal = Math.max(0, minVal - span * 0.16);
    maxVal = maxVal + span * 0.16;
  }

  const getX = (i) => {
    if (points.length === 1) return pad.left + plotW / 2;
    return pad.left + (i / (points.length - 1)) * plotW;
  };

  const getY = (val) => {
    const ratio = (val - minVal) / (maxVal - minVal || 1);
    return pad.top + plotH - ratio * plotH;
  };

  const coords = points.map((p, i) => ({
    ...p,
    x: Number(getX(i).toFixed(1)),
    y: Number(getY(p.value).toFixed(1))
  }));

  // Y-axis gridlines (5 steps)
  const yTicks = 4;
  let gridSvg = '';
  for (let i = 0; i <= yTicks; i++) {
    const val = minVal + ((maxVal - minVal) * (yTicks - i)) / yTicks;
    const y = Number((pad.top + (plotH * i) / yTicks).toFixed(1));
    gridSvg += `
      <line x1="${pad.left}" y1="${y}" x2="${W - pad.right}" y2="${y}" stroke="#262e42" stroke-opacity="0.7" stroke-dasharray="${i === yTicks ? '' : '3 4'}" />
      <text x="${pad.left - 10}" y="${y + 4}" text-anchor="end" fill="#94a3b8" font-size="11" font-family="ui-monospace, monospace">${fmtNum(val, val >= 100 ? 0 : 1)}</text>
    `;
  }

  // X-axis date labels (prevent overlapping with pixel minGap)
  const maxXLabels = W < 500 ? 4 : 7;
  const step = Math.max(1, Math.ceil(coords.length / maxXLabels));
  const minGap = W < 500 ? 54 : 62;
  let xLabelsSvg = '';
  let lastLabelX = -Infinity;
  const lastIdx = coords.length - 1;
  const lastX = coords.length > 0 ? coords[lastIdx].x : 0;
  coords.forEach((c, idx) => {
    const isFirst = idx === 0;
    const isLast = idx === lastIdx && coords.length > 1;
    const isMid = !isFirst && !isLast && idx % step === 0;
    if (isFirst || isLast || (isMid && c.x - lastLabelX >= minGap && lastX - c.x >= minGap)) {
      lastLabelX = c.x;
      xLabelsSvg += `
        <text x="${c.x}" y="${H - 12}" text-anchor="middle" fill="#94a3b8" font-size="11">${escapeHtml(formatDateShort(c.session.date))}</text>
      `;
    }
  });

  // Line & Area paths
  let lineSvg = '';
  let areaSvg = '';
  if (coords.length >= 2) {
    const linePath = coords.map((c, i) => `${i === 0 ? 'M' : 'L'} ${c.x} ${c.y}`).join(' ');
    const baseY = pad.top + plotH;
    const areaPath = `${linePath} L ${coords[coords.length - 1].x} ${baseY} L ${coords[0].x} ${baseY} Z`;
    areaSvg = `<path d="${areaPath}" fill="url(#chartGrad)" />`;
    lineSvg = `<path d="${linePath}" fill="none" stroke="#3b82f6" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />`;
  }

  // Data points
  const dotsSvg = coords.map((c) => {
    const fill = c.pct === null ? '#3b82f6' : (c.pct > 0 ? '#10b981' : (c.pct < 0 ? '#ef4444' : '#94a3b8'));
    return `
      <g class="chart-point-hit" data-pt-idx="${c.idx}">
        <circle cx="${c.x}" cy="${c.y}" r="16" fill="transparent" />
        <circle class="chart-point-dot" cx="${c.x}" cy="${c.y}" r="5.5" fill="${fill}" stroke="#0b0d12" stroke-width="2.2" />
      </g>
    `;
  }).join('');

  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.innerHTML = `
    <defs>
      <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#3b82f6" stop-opacity="0.24" />
        <stop offset="100%" stop-color="#3b82f6" stop-opacity="0.0" />
      </linearGradient>
    </defs>
    ${gridSvg}
    ${xLabelsSvg}
    ${areaSvg}
    ${lineSvg}
    <line id="chartHoverGuide" x1="0" y1="${pad.top}" x2="0" y2="${pad.top + plotH}" stroke="#3b82f6" stroke-opacity="0" stroke-dasharray="3 3" />
    ${dotsSvg}
  `;

  const guide = svg.querySelector('#chartHoverGuide');
  const showPointTooltip = (idx) => {
    const c = coords[idx];
    if (!c) return;

    if (guide) {
      guide.setAttribute('x1', c.x);
      guide.setAttribute('x2', c.x);
      guide.setAttribute('stroke-opacity', '0.45');
    }

    svg.querySelectorAll('.chart-point-dot').forEach((dot, dIdx) => {
      dot.setAttribute('r', dIdx === idx ? '7.5' : '5.5');
    });

    const pctHtml = c.pct === null
      ? '<span style="color:#94a3b8;">Pierwszy zapis</span>'
      : (c.pct > 0
        ? `<span style="color:#34d399;font-weight:700;">+${c.pct.toFixed(1)}%</span>`
        : (c.pct < 0
          ? `<span style="color:#f87171;font-weight:700;">${c.pct.toFixed(1)}%</span>`
          : '<span style="color:#94a3b8;font-weight:700;">0.0%</span>'));

    tooltip.innerHTML = `
      <div class="tt-date">${escapeHtml(formatDatePL(c.session.date))}</div>
      <div class="tt-title">${escapeHtml(c.session.workoutTitle)}</div>
      <div class="tt-row">
        <span>${escapeHtml(c.label)}</span>
        <span class="tt-val num">${fmtNum(c.value)} ${c.unit}</span>
      </div>
      <div class="tt-row">
        <span>Najlepsza seria</span>
        <span class="tt-val num">${formatSetFull(c.session.bestSet)}</span>
      </div>
      <div class="tt-row">
        <span>vs poprzednia</span>
        <span class="num">${pctHtml}</span>
      </div>
    `;

    const clampedX = Math.max(105, Math.min(W - 105, c.x));
    const placeBelow = c.y < 115;
    tooltip.style.left = `${clampedX}px`;
    tooltip.style.top = placeBelow ? `${c.y + 18}px` : `${c.y}px`;
    tooltip.style.transform = placeBelow
      ? 'translate(-50%, 0)'
      : 'translate(-50%, -100%) translateY(-12px)';
    tooltip.classList.add('visible');
  };

  const hideTooltip = () => {
    tooltip.classList.remove('visible');
    if (guide) guide.setAttribute('stroke-opacity', '0');
    svg.querySelectorAll('.chart-point-dot').forEach((dot) => dot.setAttribute('r', '5.5'));
  };

  svg.querySelectorAll('.chart-point-hit').forEach((node) => {
    const idx = parseInt(node.dataset.ptIdx, 10);
    node.addEventListener('mouseenter', () => showPointTooltip(idx));
    node.addEventListener('click', (e) => {
      e.stopPropagation();
      showPointTooltip(idx);
    });
    node.addEventListener('touchstart', (e) => {
      e.stopPropagation();
      e.preventDefault();
      showPointTooltip(idx);
    }, { passive: false });
  });

  svg.onclick = (e) => {
    if (!e.target.closest('.chart-point-hit')) hideTooltip();
  };
  svg.ontouchstart = (e) => {
    if (!e.target.closest('.chart-point-hit')) hideTooltip();
  };
  shell.onmouseleave = hideTooltip;

  return hideTooltip;
}
