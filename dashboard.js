// =====================================================
// POLPO ANALYTICS · DASHBOARD (CHARTS)
// -bynd
// =====================================================

// =====================================================
// CONSTANTES GLOBALES
// =====================================================
const PALETTE = ['#E8FF00','#FF3366','#00D9FF','#000000','#737373','#B8CC00','#CC2952','#00AED4','#333333','#999999','#D4E600','#FF6688','#33E0FF','#555555','#AAAAAA'];
const MC = '#E8FF00', MA = '#E8FF0055';
const GC = '#FF3366', GA = '#FF336655';
const SC = '#00D9FF', SA = '#00D9FF33';

Chart.defaults.color = '#737373';
Chart.defaults.borderColor = '#D4D4D4';
Chart.defaults.font.family = "'JetBrains Mono',monospace";
Chart.defaults.font.size = 10;
Chart.defaults.plugins.legend.labels.padding = 14;
Chart.defaults.plugins.legend.labels.usePointStyle = true;
Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';

const TT_BASE = {
  backgroundColor: '#0A0A0A',
  titleColor: '#FAFAF9',
  bodyColor: '#FAFAF9',
  borderWidth: 2,
  titleFont: { family: "'EB Garamond',serif", size: 13 },
  bodyFont: { family: "'JetBrains Mono',monospace", size: 10 }
};
function tt(bc) { return { ...TT_BASE, borderColor: bc }; }

let globalSelfHistory = null;

// =====================================================
// SELF HISTORY UPLOAD (CSV inline, opcional)
// =====================================================
function setupSelfUpload(dropEl, inputEl) {
  if (!dropEl || !inputEl) return;
  dropEl.addEventListener('dragover', e => { e.preventDefault(); dropEl.classList.add('dragover'); });
  dropEl.addEventListener('dragleave', () => dropEl.classList.remove('dragover'));
  dropEl.addEventListener('drop', e => {
    e.preventDefault();
    dropEl.classList.remove('dragover');
    if (e.dataTransfer.files.length) handleSelfFile(e.dataTransfer.files[0]);
  });
  inputEl.addEventListener('change', e => { if (e.target.files.length) handleSelfFile(e.target.files[0]); });
}

const dASI = document.getElementById('dropAreaSelfInline');
const fISI = document.getElementById('fileInputSelfInline');
if (dASI && fISI) setupSelfUpload(dASI, fISI);

function handleSelfFile(file) {
  const r = new FileReader();
  r.onload = e => {
    const rows = parseSelfCSV(e.target.result);
    if (!rows.length) { alert('self_history.csv vacío'); return; }
    globalSelfHistory = rows;
    buildSelfGrowth(rows);
    const il = document.getElementById('selfUploadInline');
    if (il) il.style.display = 'none';
  };
  r.readAsText(file);
}

function parseSelfCSV(text) {
  const lines = text.trim().split('\n');
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(h => h.trim());
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const vals = lines[i].split(',');
    if (vals.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, idx) => obj[h] = vals[idx]?.trim() || '');
    obj.followers = parseInt(obj.followers) || 0;
    obj.following = parseInt(obj.following) || 0;
    obj.ratio = parseFloat(obj.ratio) || 0;
    rows.push(obj);
  }
  return rows;
}

// =====================================================
// DASHBOARD MAIN
// =====================================================
function buildDashboard(data) {
  // Si hay varios rows con status='self' (ej. user antiguo + nuevo),
  // agarrar el más reciente por last_updated. Si no tiene last_updated, fallback al primero.
  const selfs = data.filter(d => d.status === 'self');
  const selfRow = selfs.length
    ? [...selfs].sort((a, b) => (b.last_updated || '').localeCompare(a.last_updated || ''))[0]
    : null;
  const nd = data.filter(d => d.status !== 'self');
  const active = nd.filter(d => d.status === 'active').filter(d => d.origen && d.origen !== 'unknown' && d.origen !== '@unknown');
  const mutuals = active.filter(d => d.mutual);
  const ghosts = active.filter(d => !d.mutual);

  const totalHistoric = nd.length;
  const cancelled = nd.filter(d => d.status === 'request_cancelled').length;
  const avgRM = mutuals.length ? (mutuals.reduce((s, d) => s + d.profile_ratio, 0) / mutuals.length).toFixed(2) : '—';
  const avgRG = ghosts.length ? (ghosts.reduce((s, d) => s + d.profile_ratio, 0) / ghosts.length).toFixed(2) : '—';

  if (selfRow) {
    const ss = document.getElementById('selfSection');
    ss.classList.add('visible');
    document.getElementById('selfUsername').textContent = selfRow.username || '???';
    if (!globalSelfHistory) {
      const il = document.getElementById('selfUploadInline');
      if (il) il.style.display = 'block';
    }
    const sh = document.getElementById('selfHero');
    const diff = selfRow.profile_followers - selfRow.profile_following;
    sh.innerHTML = [
      { l: 'Mis Followers', v: selfRow.profile_followers.toLocaleString() },
      { l: 'Mi Following', v: selfRow.profile_following.toLocaleString() },
      { l: 'Mi Ratio', v: (typeof selfRow.profile_ratio === 'number' ? selfRow.profile_ratio.toFixed(4) : selfRow.profile_ratio) },
      { l: 'Diferencia', v: (diff >= 0 ? '+' : '') + diff }
    ].map(s => `<div class="stat-card self-card"><div class="stat-label">${s.l}</div><div class="stat-value">${s.v}</div></div>`).join('');
  }

  document.getElementById('statsBar').innerHTML = [
    { l: 'Total Histórico', v: totalHistoric, c: 'info' },
    { l: 'Activos', v: active.length, c: 'info' },
    { l: 'Mutuals', v: mutuals.length, c: 'mutual' },
    { l: 'No Mutuals', v: ghosts.length, c: 'ghost' },
    { l: 'Requests ✗', v: cancelled, c: 'warn' },
    { l: 'Ratio Avg Mutual', v: avgRM, c: 'mutual' },
    { l: 'Ratio Avg Ghost', v: avgRG, c: 'ghost' },
    { l: 'Orígenes', v: new Set(active.map(d => d.origen)).size, c: 'info' }
  ].map(s => `<div class="stat-card ${s.c}"><div class="stat-label">${s.l}</div><div class="stat-value">${s.v}</div></div>`).join('');

  buildPie('pieMutuals', mutuals);
  buildPie('pieGhosts', ghosts);
  buildLine('lineMutuals', mutuals, MC, MA);
  buildLine('lineGhosts', ghosts, GC, GA);

  const bd = buildBinData(mutuals, ghosts);
  buildSingleHist('histMutuals', bd.labels, bd.mutualBins, MC, MA, 'Mutuals', 'FRECUENCIA');
  buildSingleHist('histGhosts', bd.labels, bd.ghostBins, GC, GA, 'No Mutuals', 'FRECUENCIA');
  buildPolygon('polyCompare', bd, false);

  const mT = bd.mutualBins.reduce((a, b) => a + b, 0);
  const gT = bd.ghostBins.reduce((a, b) => a + b, 0);
  const mP = bd.mutualBins.map(v => mT > 0 ? parseFloat(((v / mT) * 100).toFixed(2)) : 0);
  const gP = bd.ghostBins.map(v => gT > 0 ? parseFloat(((v / gT) * 100).toFixed(2)) : 0);

  buildSingleHist('histMutualsPct', bd.labels, mP, MC, MA, 'Mutuals %', '% DEL GRUPO');
  buildSingleHist('histGhostsPct', bd.labels, gP, GC, GA, 'No Mutuals %', '% DEL GRUPO');
  buildPolygon('polyComparePct', { labels: bd.labels, midpoints: bd.midpoints, mutualBins: mP, ghostBins: gP }, true);

  buildMutualityRate('mutualityRate', active);
  buildAvgRatioByOrigin('avgRatioByOrigin', active);
  buildMaxRatioByOrigin('maxRatioByOrigin', active);
  buildVersus(mutuals, ghosts);
  buildUsernameQuality(active);
  buildUqScatter(active);
  buildUqByOrigin(active);
  buildBestUser(active);

  // Re-render self history charts si ya hay data cargada
  if (globalSelfHistory) buildSelfGrowth(globalSelfHistory);
}

// =====================================================
// SELF GROWTH
// =====================================================
function buildSelfGrowth(sd) {
  if (!sd || !sd.length) return;
  const ss = document.getElementById('selfSection');
  ss.classList.add('visible');
  const ue = document.getElementById('selfUsername');
  if (ue.textContent === '???' && sd[0].username) ue.textContent = sd[0].username;

  const sorted = [...sd].sort((a, b) => (a.timestamp || '').localeCompare(b.timestamp || ''));
  const labels = sorted.map(d => {
    const dt = new Date(d.timestamp);
    return `${dt.getMonth() + 1}/${dt.getDate()} ${dt.getHours()}:${String(dt.getMinutes()).padStart(2, '0')}`;
  });
  const followers = sorted.map(d => d.followers);
  const following = sorted.map(d => d.following);
  const ratios = sorted.map(d => d.ratio);

  if (sorted.length > 0) {
    const latest = sorted[sorted.length - 1];
    const first = sorted[0];
    const growth = latest.followers - first.followers;
    const he = document.getElementById('selfHero');
    he.innerHTML = [
      { l: 'Mis Followers', v: latest.followers.toLocaleString() },
      { l: 'Mi Following', v: latest.following.toLocaleString() },
      { l: 'Mi Ratio', v: latest.ratio.toFixed(4) },
      { l: `Crecimiento (${sorted.length} snaps)`, v: `${growth >= 0 ? '+' : ''}${growth}` }
    ].map(s => `<div class="stat-card self-card"><div class="stat-label">${s.l}</div><div class="stat-value">${s.v}</div></div>`).join('');
  }

  let ch = Chart.getChart('selfFollowersLine');
  if (ch) ch.destroy();
  new Chart(document.getElementById('selfFollowersLine'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Followers', data: followers, borderColor: SC, backgroundColor: SA, fill: true, tension: 0.3,
        pointRadius: sorted.length > 30 ? 2 : 5, pointHoverRadius: 8,
        pointBackgroundColor: SC, pointBorderColor: '#000', pointBorderWidth: 2, borderWidth: 3
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: '#E8E8E8' }, ticks: { maxTicksLimit: 15, font: { size: 8 }, color: '#737373', maxRotation: 45 }, border: { color: '#000', width: 2 } },
        y: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'FOLLOWERS', font: { size: 10, weight: '600' }, color: '#00D9FF' }, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tt(SC),
          callbacks: {
            title: items => `Snapshot #${items[0].dataIndex + 1}`,
            label: ctx => {
              const s = sorted[ctx.dataIndex];
              const lines = [` followers: ${s.followers.toLocaleString()}`];
              if (ctx.dataIndex > 0) {
                const prev = sorted[ctx.dataIndex - 1];
                const diff = s.followers - prev.followers;
                lines.push(` cambio: ${diff >= 0 ? '+' : ''}${diff}`);
              }
              return lines;
            }
          }
        }
      }
    }
  });

  ch = Chart.getChart('selfFollowingLine');
  if (ch) ch.destroy();
  new Chart(document.getElementById('selfFollowingLine'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Following', data: following, borderColor: MC, backgroundColor: MA, fill: true, tension: 0.3,
        pointRadius: sorted.length > 30 ? 2 : 4, pointHoverRadius: 7,
        pointBackgroundColor: MC, pointBorderColor: '#000', pointBorderWidth: 2, borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: '#E8E8E8' }, ticks: { maxTicksLimit: 12, font: { size: 8 }, color: '#737373', maxRotation: 45 }, border: { color: '#000', width: 2 } },
        y: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'FOLLOWING', font: { size: 9 }, color: '#737373' }, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...tt(MC), callbacks: { label: ctx => ` following: ${sorted[ctx.dataIndex].following.toLocaleString()}` } }
      }
    }
  });

  ch = Chart.getChart('selfRatioLine');
  if (ch) ch.destroy();
  new Chart(document.getElementById('selfRatioLine'), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ratio', data: ratios, borderColor: GC, backgroundColor: GA, fill: true, tension: 0.3,
        pointRadius: sorted.length > 30 ? 2 : 4, pointHoverRadius: 7,
        pointBackgroundColor: GC, pointBorderColor: '#000', pointBorderWidth: 2, borderWidth: 2
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: '#E8E8E8' }, ticks: { maxTicksLimit: 12, font: { size: 8 }, color: '#737373', maxRotation: 45 }, border: { color: '#000', width: 2 } },
        y: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'RATIO', font: { size: 9 }, color: '#737373' }, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tt(GC),
          callbacks: {
            label: ctx => {
              const s = sorted[ctx.dataIndex];
              return ` ratio: ${s.ratio.toFixed(4)} (${s.followers}/${s.following})`;
            }
          }
        }
      }
    }
  });
}

// =====================================================
// PIE
// =====================================================
function buildPie(id, sub) {
  const c = {};
  sub.forEach(d => { const o = d.origen || 'unknown'; c[o] = (c[o] || 0) + 1; });
  const l = Object.keys(c).sort((a, b) => c[b] - c[a]);
  const v = l.map(x => c[x]);
  const co = l.map((_, i) => PALETTE[i % PALETTE.length]);

  new Chart(document.getElementById(id), {
    type: 'doughnut',
    data: {
      labels: l.map(x => '@' + x),
      datasets: [{ data: v, backgroundColor: co, borderColor: '#000', borderWidth: 2, hoverBorderColor: '#E8FF00', hoverBorderWidth: 3 }]
    },
    options: {
      responsive: true, cutout: '58%',
      plugins: {
        legend: { position: 'bottom', labels: { padding: 10, font: { size: 9 }, color: '#737373' } },
        tooltip: {
          ...tt('#E8FF00'),
          callbacks: { label: ctx => { const t = ctx.dataset.data.reduce((a, b) => a + b, 0); return ` ${ctx.raw} → ${((ctx.raw / t) * 100).toFixed(1)}%`; } }
        }
      }
    }
  });
}

// =====================================================
// LINE (ratio en el tiempo)
// =====================================================
function buildLine(id, sub, color, colorA) {
  const sorted = [...sub].filter(d => d.followed_at && d.profile_ratio > 0).sort((a, b) => a.followed_at.localeCompare(b.followed_at));
  const labels = sorted.map(d => { const dt = new Date(d.followed_at); return `${dt.getMonth() + 1}/${dt.getDate()}`; });
  const ratios = sorted.map(d => d.profile_ratio);

  new Chart(document.getElementById(id), {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'Ratio', data: ratios, borderColor: color, backgroundColor: colorA, fill: true, tension: 0.3,
        pointRadius: sorted.length > 50 ? 0 : 2, pointHoverRadius: 5,
        pointBackgroundColor: color, pointBorderColor: '#000', pointBorderWidth: 1, borderWidth: 2
      }]
    },
    options: {
      responsive: true, interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: '#E8E8E8' }, ticks: { maxTicksLimit: 12, font: { size: 8 }, color: '#737373' }, border: { color: '#000', width: 2 } },
        y: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'RATIO', font: { size: 9 }, color: '#737373' }, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tt(color),
          callbacks: {
            title: items => sorted[items[0].dataIndex].username,
            label: ctx => ` ratio: ${ctx.raw} → ${sorted[ctx.dataIndex].profile_followers}/${sorted[ctx.dataIndex].profile_following}`
          }
        }
      }
    }
  });
}

// =====================================================
// BIN DATA (histogramas)
// =====================================================
function buildBinData(m, g) {
  const all = [...m, ...g].map(d => d.profile_ratio).filter(r => r > 0);
  if (!all.length) return { labels: [], mutualBins: [], ghostBins: [], midpoints: [] };

  const maxR = Math.min(Math.ceil(Math.max(...all)), 20);
  const bs = maxR <= 5 ? 0.5 : 1;
  const bc = Math.ceil(maxR / bs) + 1;
  const bl = [], mp = [];
  const mb = new Array(bc).fill(0);
  const gb = new Array(bc).fill(0);

  for (let i = 0; i < bc; i++) {
    const lo = i * bs, hi = (i + 1) * bs;
    bl.push(`${lo.toFixed(1)}-${hi.toFixed(1)}`);
    mp.push(((lo + hi) / 2).toFixed(2));
  }

  function toBin(r) { return Math.min(Math.floor(r / bs), bc - 1); }

  m.filter(d => d.profile_ratio > 0).forEach(d => mb[toBin(d.profile_ratio)]++);
  g.filter(d => d.profile_ratio > 0).forEach(d => gb[toBin(d.profile_ratio)]++);

  return { labels: bl, mutualBins: mb, ghostBins: gb, midpoints: mp };
}

function buildSingleHist(id, labels, bins, color, colorA, label, yLabel) {
  const canvas = document.getElementById(id);
  if (!labels.length) {
    canvas.parentElement.innerHTML = '<p style="color:#737373;text-align:center;padding:2rem;font-family:var(--font-mono);font-size:0.7rem;">[SIN DATOS]</p>';
    return;
  }

  new Chart(canvas, {
    type: 'bar',
    data: { labels, datasets: [{ label, data: bins, backgroundColor: colorA, borderColor: color, borderWidth: 2, barPercentage: 1.0, categoryPercentage: 0.92 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'RATIO', font: { size: 9 }, color: '#737373' }, ticks: { font: { size: 8 }, maxRotation: 45, color: '#737373' }, border: { color: '#000', width: 2 } },
        y: { grid: { color: '#E8E8E8' }, title: { display: true, text: yLabel, font: { size: 9 }, color: '#737373' }, beginAtZero: true, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...tt(color), callbacks: { label: ctx => yLabel.includes('%') ? ` ${ctx.raw.toFixed(1)}%` : ` ${ctx.raw}` } }
      }
    }
  });
}

function buildPolygon(id, bd, isPct) {
  const canvas = document.getElementById(id);
  if (!bd.labels.length) {
    canvas.parentElement.innerHTML = '<p style="color:#737373;text-align:center;padding:2rem;font-family:var(--font-mono);font-size:0.7rem;">[SIN DATOS]</p>';
    return;
  }

  const yL = isPct ? '% DEL GRUPO' : 'FRECUENCIA';

  new Chart(canvas, {
    type: 'line',
    data: {
      labels: bd.midpoints,
      datasets: [
        { label: 'MUTUALS', data: bd.mutualBins, borderColor: MC, backgroundColor: MA, fill: true, tension: 0.25, pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: MC, pointBorderColor: '#000', pointBorderWidth: 2, borderWidth: 3 },
        { label: 'NO MUTUALS', data: bd.ghostBins, borderColor: GC, backgroundColor: GA, fill: true, tension: 0.25, pointRadius: 4, pointHoverRadius: 7, pointBackgroundColor: GC, pointBorderColor: '#000', pointBorderWidth: 2, borderWidth: 3 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false, interaction: { mode: 'index', intersect: false },
      scales: {
        x: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'MARCA DE CLASE', font: { size: 9 }, color: '#737373' }, ticks: { font: { size: 8 }, maxRotation: 45, color: '#737373' }, border: { color: '#000', width: 2 } },
        y: { grid: { color: '#E8E8E8' }, title: { display: true, text: yL, font: { size: 9 }, color: '#737373' }, beginAtZero: true, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 10, weight: '600' }, padding: 20, color: '#737373', usePointStyle: true, pointStyle: 'rect' } },
        tooltip: {
          ...tt('#FFF'),
          callbacks: {
            title: items => `RATIO ≈ ${items[0].label}`,
            label: ctx => isPct ? ` ${ctx.dataset.label}: ${ctx.raw.toFixed(1)}%` : ` ${ctx.dataset.label}: ${ctx.raw} usuarios`
          }
        }
      }
    }
  });
}

// =====================================================
// AVG / MAX RATIO POR ORIGEN
// =====================================================
function buildAvgRatioByOrigin(id, active) {
  const bo = {};
  active.forEach(d => {
    const o = d.origen || 'unknown';
    if (!bo[o]) bo[o] = { sum: 0, count: 0 };
    if (d.profile_ratio > 0) { bo[o].sum += d.profile_ratio; bo[o].count++; }
  });

  const origins = Object.keys(bo)
    .map(o => ({ name: o, avg: bo[o].count > 0 ? bo[o].sum / bo[o].count : 0, count: bo[o].count }))
    .filter(o => o.count > 0)
    .sort((a, b) => b.avg - a.avg);

  if (!origins.length) {
    document.getElementById(id).parentElement.innerHTML = '<p style="color:#737373;text-align:center;padding:2rem;">[SIN DATOS]</p>';
    return;
  }

  const canvas = document.getElementById(id);
  const ch = Math.max(250, origins.length * 38 + 80);
  canvas.parentElement.style.minHeight = ch + 'px';
  canvas.style.height = ch + 'px';

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: origins.map(o => `@${o.name}`),
      datasets: [{
        label: 'Ratio Promedio', data: origins.map(o => parseFloat(o.avg.toFixed(3))),
        backgroundColor: origins.map((_, i) => PALETTE[i % PALETTE.length]),
        borderColor: '#000', borderWidth: 2, barPercentage: 0.72, categoryPercentage: 0.88
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'RATIO PROMEDIO', font: { size: 9 }, color: '#737373' }, border: { color: '#000', width: 2 }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { font: { size: 10, weight: '500' }, color: '#000', padding: 8 }, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: { ...tt('#FFF'), callbacks: { label: ctx => { const o = origins[ctx.dataIndex]; return ` avg: ${o.avg.toFixed(3)} (n=${o.count})`; } } }
      }
    }
  });
}

function buildMaxRatioByOrigin(id, active) {
  const bo = {};
  active.forEach(d => {
    const o = d.origen || 'unknown';
    if (!bo[o]) bo[o] = { max: 0, user: '—', count: 0 };
    if (d.profile_ratio > 0) {
      bo[o].count++;
      if (d.profile_ratio > bo[o].max) {
        bo[o].max = d.profile_ratio;
        bo[o].user = d.username || '—';
      }
    }
  });

  const origins = Object.keys(bo)
    .map(o => ({ name: o, max: bo[o].max, user: bo[o].user, count: bo[o].count }))
    .filter(o => o.count > 0)
    .sort((a, b) => b.max - a.max);

  if (!origins.length) {
    document.getElementById(id).parentElement.innerHTML = '<p style="color:#737373;text-align:center;padding:2rem;">[SIN DATOS]</p>';
    return;
  }

  const canvas = document.getElementById(id);
  const ch = Math.max(250, origins.length * 38 + 80);
  canvas.parentElement.style.minHeight = ch + 'px';
  canvas.style.height = ch + 'px';

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: origins.map(o => `@${o.name}`),
      datasets: [{
        label: 'Ratio Máximo', data: origins.map(o => parseFloat(o.max.toFixed(3))),
        backgroundColor: origins.map((_, i) => `rgba(255,51,102,${(1 - (i / origins.length) * 0.55).toFixed(2)})`),
        borderColor: '#000', borderWidth: 2, barPercentage: 0.72, categoryPercentage: 0.88
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'RATIO MÁXIMO', font: { size: 9 }, color: '#737373' }, border: { color: '#000', width: 2 }, beginAtZero: true },
        y: { grid: { display: false }, ticks: { font: { size: 10, weight: '500' }, color: '#000', padding: 8 }, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...tt('#FF3366'),
          callbacks: {
            label: ctx => ` max: ${origins[ctx.dataIndex].max.toFixed(3)}`,
            afterLabel: ctx => ` @${origins[ctx.dataIndex].user}`
          }
        }
      }
    }
  });
}

// =====================================================
// MUTUALITY RATE
// =====================================================
function buildMutualityRate(id, active) {
  const bo = {};
  active.forEach(d => {
    const o = d.origen || 'unknown';
    if (!bo[o]) bo[o] = { mutuals: 0, ghosts: 0, total: 0 };
    bo[o].total++;
    if (d.mutual) bo[o].mutuals++; else bo[o].ghosts++;
  });

  const origins = Object.keys(bo)
    .map(o => ({ name: o, ...bo[o], rate: bo[o].total > 0 ? (bo[o].mutuals / bo[o].total) * 100 : 0 }))
    .filter(o => o.total >= 1)
    .sort((a, b) => b.rate - a.rate);

  if (!origins.length) {
    document.getElementById(id).parentElement.innerHTML = '<p style="color:#737373;text-align:center;padding:2rem;">[SIN DATOS]</p>';
    return;
  }

  const canvas = document.getElementById(id);
  const ch = Math.max(250, origins.length * 36 + 80);
  canvas.parentElement.style.minHeight = ch + 'px';
  canvas.style.height = ch + 'px';

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: origins.map(o => `@${o.name}`),
      datasets: [
        { label: 'MUTUALS', data: origins.map(o => o.mutuals), backgroundColor: MC, borderColor: '#000', borderWidth: 2, barPercentage: 0.75, categoryPercentage: 0.85 },
        { label: 'NO MUTUALS', data: origins.map(o => o.ghosts), backgroundColor: GC, borderColor: '#000', borderWidth: 2, barPercentage: 0.75, categoryPercentage: 0.85 }
      ]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { stacked: true, grid: { color: '#E8E8E8' }, title: { display: true, text: 'USUARIOS', font: { size: 9 }, color: '#737373' }, ticks: { stepSize: 1 }, border: { color: '#000', width: 2 } },
        y: { stacked: true, grid: { display: false }, ticks: { font: { size: 10, weight: '500' }, color: '#000', padding: 8 }, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 10, weight: '600' }, padding: 20, color: '#737373', usePointStyle: true, pointStyle: 'rect' } },
        tooltip: {
          ...tt('#FFF'),
          callbacks: {
            afterBody: items => {
              const o = origins[items[0].dataIndex];
              return `\n→ TASA: ${o.rate.toFixed(1)}% (${o.mutuals}/${o.total})`;
            }
          }
        }
      }
    }
  });
}

// =====================================================
// VERSUS (top mutual vs top ghost)
// =====================================================
function buildVersus(mutuals, ghosts) {
  const tN = 10;
  const tM = [...mutuals].filter(d => d.profile_ratio > 0).sort((a, b) => b.profile_ratio - a.profile_ratio).slice(0, tN);
  const tG = [...ghosts].filter(d => d.profile_ratio > 0).sort((a, b) => b.profile_ratio - a.profile_ratio).slice(0, tN);
  const m1 = tM[0] || null;
  const g1 = tG[0] || null;

  document.getElementById('versusGrid').innerHTML = `
    <div class="versus-card mutual-side"><div class="vs-label">TOP MUTUAL</div><div class="vs-user">@${m1 ? (m1.username || '—') : '—'}</div>
      <div class="vs-ratio" style="color:#555500;">${m1 ? m1.profile_ratio.toFixed(3) : '—'}</div>
      <div class="vs-detail">${m1 ? `${m1.profile_followers.toLocaleString()} / ${m1.profile_following.toLocaleString()}` : '—'}</div></div>
    <div class="versus-divider"><span>vs</span></div>
    <div class="versus-card ghost-side"><div class="vs-label">TOP NO MUTUAL</div><div class="vs-user">@${g1 ? (g1.username || '—') : '—'}</div>
      <div class="vs-ratio" style="color:#990033;">${g1 ? g1.profile_ratio.toFixed(3) : '—'}</div>
      <div class="vs-detail">${g1 ? `${g1.profile_followers.toLocaleString()} / ${g1.profile_following.toLocaleString()}` : '—'}</div></div>`;

  const maxLen = Math.max(tM.length, tG.length);
  const labels = [], mD = [], gD = [], mU = [], gU = [];
  for (let i = 0; i < maxLen; i++) {
    labels.push(`#${i + 1}`);
    mD.push(tM[i] ? tM[i].profile_ratio : 0);
    gD.push(tG[i] ? tG[i].profile_ratio : 0);
    mU.push(tM[i] ? tM[i].username : '—');
    gU.push(tG[i] ? tG[i].username : '—');
  }

  new Chart(document.getElementById('versusBar'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'MUTUAL', data: mD, backgroundColor: MC, borderColor: '#000', borderWidth: 2, barPercentage: 0.8, categoryPercentage: 0.75 },
        { label: 'NO MUTUAL', data: gD, backgroundColor: GC, borderColor: '#000', borderWidth: 2, barPercentage: 0.8, categoryPercentage: 0.75 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#E8E8E8' }, ticks: { font: { size: 10, weight: '600' }, color: '#000' }, border: { color: '#000', width: 2 } },
        y: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'RATIO', font: { size: 9 }, color: '#737373' }, beginAtZero: true, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 10, weight: '600' }, padding: 20, color: '#737373', usePointStyle: true, pointStyle: 'rect' } },
        tooltip: {
          ...tt('#FFF'),
          callbacks: {
            title: items => `Puesto ${items[0].label}`,
            label: ctx => {
              const iM = ctx.datasetIndex === 0;
              const u = iM ? mU[ctx.dataIndex] : gU[ctx.dataIndex];
              return ` ${ctx.dataset.label}: ${ctx.raw.toFixed(3)} → @${u}`;
            }
          }
        }
      }
    }
  });
}

// =====================================================
// USERNAME QUALITY
// =====================================================
function scoreUsername(u) {
  u = (u || '').toLowerCase();
  const len = u.length;
  const dig = (u.match(/[0-9]/g) || []).length;
  const sig = (u.match(/[^a-z0-9]/g) || []).length;
  const unc = (u.match(/[ywz]/g) || []).length;
  const xC = (u.match(/x/g) || []).length;

  let rep = 0;
  for (let i = 1; i < u.length; i++) {
    if (u[i] === u[i - 1] && /[a-z]/.test(u[i])) rep++;
  }

  const lP = len * 3, dP = dig * 5, sP = sig * 5, uP = unc * 1, xP = xC * 2, rP = rep * 1;
  const tot = lP + dP + sP + uP + xP + rP;

  return {
    score: Math.max(0, Math.min(100, 100 - tot)),
    lenPenalty: lP, digitPenalty: dP, signPenalty: sP,
    uncommonPenalty: uP, xPenalty: xP, repeatPenalty: rP
  };
}

function buildUsernameQuality(active) {
  const seen = new Set();
  const scored = [];
  active.forEach(d => {
    const u = d.username || '';
    if (!u || seen.has(u)) return;
    seen.add(u);
    const s = scoreUsername(u);
    scored.push({ username: u, mutual: d.mutual, ...s });
  });

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 10);

  function bc(s) { return s >= 70 ? MC : s >= 40 ? '#00D9FF' : s >= 20 ? '#FF6688' : GC; }

  const c = document.getElementById('uqTable');
  let h = '<table class="uq-table"><tr><th>#</th><th>User</th><th>Score</th><th>Barra</th><th>Penalización</th><th>Tipo</th></tr>';

  top.forEach((t, i) => {
    const co = bc(t.score);
    const md = t.mutual
      ? `<span class="uq-mutual-dot" style="background:${MC};"></span>`
      : `<span class="uq-mutual-dot" style="background:${GC};"></span>`;
    h += `<tr><td class="uq-rank">${i + 1}</td><td class="uq-user">@${t.username}</td><td style="font-weight:700;color:${co};">${t.score}</td>
      <td><div class="uq-score-bar"><div class="uq-score-fill" style="width:${t.score}%;background:${co};"></div></div></td>
      <td class="uq-penalty">len:−${t.lenPenalty} · dig:−${t.digitPenalty} · sig:−${t.signPenalty} · yzw:−${t.uncommonPenalty} · x:−${t.xPenalty} · rep:−${t.repeatPenalty}</td><td>${md}</td></tr>`;
  });

  h += '</table>';
  c.innerHTML = h;
}

function buildUqScatter(active) {
  const seen = new Set();
  const mP = [], gP = [];

  active.forEach(d => {
    const u = d.username || '';
    if (!u || d.profile_ratio <= 0 || seen.has(u)) return;
    seen.add(u);
    const s = scoreUsername(u);
    const pt = { x: s.score, y: d.profile_ratio, username: u };
    if (d.mutual) mP.push(pt); else gP.push(pt);
  });

  const all = [...mP, ...gP];
  let sX = 0, sY = 0, sXY = 0, sX2 = 0;
  const n = all.length;

  all.forEach(p => { sX += p.x; sY += p.y; sXY += p.x * p.y; sX2 += p.x * p.x; });

  const slope = n > 1 ? (n * sXY - sX * sY) / (n * sX2 - sX * sX) : 0;
  const intercept = n > 0 ? (sY - slope * sX) / n : 0;
  const meanY = sY / (n || 1);

  let ssTot = 0, ssRes = 0;
  all.forEach(p => {
    const pred = slope * p.x + intercept;
    ssRes += (p.y - pred) ** 2;
    ssTot += (p.y - meanY) ** 2;
  });

  const r2 = ssTot > 0 ? (1 - ssRes / ssTot) : 0;
  const xMin = all.length ? Math.max(0, Math.min(...all.map(p => p.x)) - 5) : 0;
  const xMax = all.length ? Math.min(100, Math.max(...all.map(p => p.x)) + 5) : 100;
  const td = [{ x: xMin, y: slope * xMin + intercept }, { x: xMax, y: slope * xMax + intercept }];

  new Chart(document.getElementById('scatterUqRatio'), {
    type: 'scatter',
    data: {
      datasets: [
        { label: 'MUTUALS', data: mP, backgroundColor: MA, borderColor: MC, borderWidth: 2, pointRadius: 5, pointHoverRadius: 8, pointStyle: 'rect' },
        { label: 'NO MUTUALS', data: gP, backgroundColor: GA, borderColor: GC, borderWidth: 2, pointRadius: 5, pointHoverRadius: 8, pointStyle: 'rect' },
        { label: `TENDENCIA (R²=${r2.toFixed(3)})`, data: td, type: 'line', borderColor: '#00D9FF', borderWidth: 2, borderDash: [8, 4], pointRadius: 0, fill: false, tension: 0 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'USERNAME SCORE', font: { size: 9 }, color: '#737373' }, border: { color: '#000', width: 2 }, min: 0, max: 100 },
        y: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'RATIO', font: { size: 9 }, color: '#737373' }, border: { color: '#000', width: 2 }, beginAtZero: true }
      },
      plugins: {
        legend: { position: 'top', labels: { font: { size: 10, weight: '600' }, padding: 20, color: '#737373', usePointStyle: true } },
        tooltip: {
          ...TT_BASE, borderColor: '#FFF', borderWidth: 2,
          filter: item => item.datasetIndex < 2,
          callbacks: {
            title: items => `@${items[0].raw.username}`,
            label: ctx => ` score: ${ctx.raw.x} → ratio: ${ctx.raw.y.toFixed(3)}`
          }
        }
      }
    }
  });
}

function buildUqByOrigin(active) {
  const seen = {};
  active.forEach(d => {
    const u = d.username || '';
    if (!u) return;
    const o = d.origen || 'unknown';
    if (!seen[o]) seen[o] = [];
    seen[o].push(scoreUsername(u).score);
  });

  const origins = Object.keys(seen)
    .map(o => ({ name: o, avg: seen[o].reduce((a, b) => a + b, 0) / seen[o].length, count: seen[o].length }))
    .filter(o => o.count > 0)
    .sort((a, b) => b.avg - a.avg);

  if (!origins.length) return;

  const canvas = document.getElementById('uqByOrigin');
  const ch = Math.max(250, origins.length * 38 + 80);
  canvas.parentElement.style.minHeight = ch + 'px';
  canvas.style.height = ch + 'px';

  function bc(a) { return a >= 50 ? MC : a >= 30 ? '#00D9FF' : a >= 15 ? '#FF6688' : GC; }

  new Chart(canvas, {
    type: 'bar',
    data: {
      labels: origins.map(o => `@${o.name}`),
      datasets: [{
        label: 'Score Promedio', data: origins.map(o => parseFloat(o.avg.toFixed(1))),
        backgroundColor: origins.map(o => bc(o.avg)),
        borderColor: '#000', borderWidth: 2, barPercentage: 0.72, categoryPercentage: 0.88
      }]
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { color: '#E8E8E8' }, title: { display: true, text: 'USERNAME SCORE PROMEDIO', font: { size: 9 }, color: '#737373' }, border: { color: '#000', width: 2 }, beginAtZero: true, max: 100 },
        y: { grid: { display: false }, ticks: { font: { size: 10, weight: '500' }, color: '#000', padding: 8 }, border: { color: '#000', width: 2 } }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          ...TT_BASE, borderColor: '#FFF', borderWidth: 2,
          callbacks: { label: ctx => { const o = origins[ctx.dataIndex]; return ` avg score: ${o.avg.toFixed(1)} (n=${o.count})`; } }
        }
      }
    }
  });
}

function buildBestUser(active) {
  const users = [];
  const seen = new Set();

  active.forEach(d => {
    const u = d.username || '';
    if (!u || seen.has(u) || d.profile_ratio <= 0) return;
    seen.add(u);
    const s = scoreUsername(u);
    users.push({
      username: u, score: s.score, ratio: d.profile_ratio, mutual: d.mutual,
      origen: d.origen || '?', followers: d.profile_followers, following: d.profile_following
    });
  });

  if (!users.length) return;

  const maxR = Math.max(...users.map(u => u.ratio));
  users.forEach(u => {
    u.ratioNorm = maxR > 0 ? (u.ratio / maxR) * 100 : 0;
    u.combined = (u.score * 0.5) + (u.ratioNorm * 0.5);
  });

  const bN = [...users].sort((a, b) => b.score - a.score)[0];
  const bR = [...users].sort((a, b) => b.ratio - a.ratio)[0];
  const bC = [...users].sort((a, b) => b.combined - a.combined)[0];

  const md = m => `<span class="uq-mutual-dot" style="background:${m ? MC : GC};"></span>`;

  document.getElementById('bestUserGrid').innerHTML = `
    <div class="best-card"><div class="best-crown">✦</div><div class="best-category">Mejor Nombre</div><div class="best-username">@${bN.username}</div>
      <div class="best-stat" style="color:#555500;">${bN.score}</div><div class="best-detail">score · ratio: ${bN.ratio.toFixed(3)}</div>
      <div class="best-detail">origen: @${bN.origen} ${md(bN.mutual)}</div></div>
    <div class="best-card"><div class="best-crown">✦</div><div class="best-category">Mejor Ratio</div><div class="best-username">@${bR.username}</div>
      <div class="best-stat" style="color:#990033;">${bR.ratio.toFixed(3)}</div><div class="best-detail">${bR.followers.toLocaleString()} / ${bR.following.toLocaleString()}</div>
      <div class="best-detail">score: ${bR.score} · @${bR.origen} ${md(bR.mutual)}</div></div>
    <div class="best-card best-combined"><div class="best-crown">★</div><div class="best-category">Mejor Overall</div><div class="best-username">@${bC.username}</div>
      <div class="best-stat" style="color:#1a1a1a;">${bC.combined.toFixed(1)}</div><div class="best-detail">score: ${bC.score} · ratio: ${bC.ratio.toFixed(3)}</div>
      <div class="best-detail">50% nombre + 50% ratio norm</div><div class="best-detail">origen: @${bC.origen} ${md(bC.mutual)}</div></div>`;
}
