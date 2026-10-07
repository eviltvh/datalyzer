// =====================================================
// POLPO ANALYTICS · APP ENTRY (AUTH + DB)
// -bynd
// =====================================================

// =====================================================
// SUPABASE INIT
// =====================================================
const POLPO_CFG = window.POLPO_CONFIG || {};
let polpoSupabase = null;
const CFG_INVALID = !POLPO_CFG.SUPABASE_URL
  || POLPO_CFG.SUPABASE_URL.includes('TU-PROYECTO')
  || !POLPO_CFG.SUPABASE_ANON_KEY
  || POLPO_CFG.SUPABASE_ANON_KEY.includes('PEGA_TU_ANON_KEY');

if (CFG_INVALID) {
  console.warn('[POLPO] config.js no está configurado. Edita config.js con tu URL y anon key de Supabase.');
} else {
  polpoSupabase = supabase.createClient(POLPO_CFG.SUPABASE_URL, POLPO_CFG.SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true }
  });
}

// =====================================================
// DOM REFS
// =====================================================
const loginScreen   = document.getElementById('loginScreen');
const loginEmail    = document.getElementById('loginEmail');
const loginPass     = document.getElementById('loginPass');
const loginBtn      = document.getElementById('loginBtn');
const loginError    = document.getElementById('loginError');
const topbar        = document.getElementById('topbar');
const headerEl      = document.getElementById('header');
const topbarUser    = document.getElementById('topbarUser');
const dbStatus      = document.getElementById('dbStatus');
const refreshBtn    = document.getElementById('refreshBtn');
const logoutBtn     = document.getElementById('logoutBtn');
const loadingScreen = document.getElementById('loadingScreen');
const loadingText   = document.getElementById('loadingText');
const dashboardEl   = document.getElementById('dashboard');

// =====================================================
// UI STATE HELPERS
// =====================================================
function showLogin() {
  loginScreen.style.display = 'flex';
  topbar.style.display = 'none';
  headerEl.style.display = 'none';
  dashboardEl.classList.remove('visible');
  loadingScreen.style.display = 'none';
}

function showApp(email) {
  loginScreen.style.display = 'none';
  topbar.style.display = 'flex';
  headerEl.style.display = 'flex';
  topbarUser.textContent = email || '—';
}

function showLoading(msg) {
  loadingScreen.style.display = 'flex';
  loadingText.textContent = msg || '[CARGANDO]';
  dashboardEl.classList.remove('visible');
}

function hideLoading() {
  loadingScreen.style.display = 'none';
}

function setStatus(text, ok) {
  dbStatus.textContent = text;
  dbStatus.style.color = ok ? '#E8FF00' : '#FF3366';
  dbStatus.style.borderColor = ok ? '#E8FF00' : '#FF3366';
}

// =====================================================
// AUTH
// =====================================================
async function checkSession() {
  if (CFG_INVALID) {
    showLogin();
    loginError.textContent = '✗ config.js no está configurado · revisa README';
    loginBtn.disabled = true;
    return;
  }
  try {
    const { data: { session } } = await polpoSupabase.auth.getSession();
    if (session) {
      showApp(session.user.email);
      await loadFromDB();
    } else {
      showLogin();
    }
  } catch (err) {
    console.error('[checkSession]', err);
    showLogin();
  }
}

async function doLogin() {
  if (CFG_INVALID) return;
  loginError.textContent = '';
  loginBtn.disabled = true;
  loginBtn.textContent = '→ AUTENTICANDO...';

  const email = loginEmail.value.trim();
  const password = loginPass.value;

  if (!email || !password) {
    loginError.textContent = '✗ falta email o password';
    loginBtn.disabled = false;
    loginBtn.textContent = '→ ENTRAR';
    return;
  }

  try {
    const { data, error } = await polpoSupabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    showApp(data.user.email);
    loginPass.value = '';
    await loadFromDB();
  } catch (err) {
    loginError.textContent = `✗ ${err.message || 'error de autenticación'}`;
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = '→ ENTRAR';
  }
}

async function doLogout() {
  if (!polpoSupabase) { showLogin(); return; }
  try { await polpoSupabase.auth.signOut(); } catch (e) { console.error(e); }
  destroyAllCharts();
  loginEmail.value = '';
  loginPass.value = '';
  setStatus('—', true);
  showLogin();
}

// =====================================================
// DB FETCH (paginado para soportar > 1000 rows)
// =====================================================
async function fetchAll(table, columns, label) {
  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;
  // Hard cap por seguridad (50k rows)
  const MAX_PAGES = 50;
  let pages = 0;

  while (pages < MAX_PAGES) {
    if (label) loadingText.textContent = `[${label} · ${all.length} rows]`;
    const { data, error } = await polpoSupabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data || data.length === 0) break;

    all = all.concat(data);
    if (data.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
    pages++;
  }
  return all;
}

// ey columnas base + las que agregaron migraciones posteriores (si no existen, se cae al set anterior) -bynd
const SU_BASE = 'username,status,mutual,origen,profile_followers,profile_following,profile_ratio,followed_at,last_updated';
const SU_TRIES = [
  SU_BASE + ',mutual_checked_at,unfollowed_at,request_state,is_private',
  SU_BASE + ',mutual_checked_at,unfollowed_at',
  SU_BASE,
];

async function fetchAllStandUsers() {
  let lastErr = null;
  for (const cols of SU_TRIES) {
    try {
      return await fetchAll('stand_users', cols, 'STAND_USERS');
    } catch (err) {
      lastErr = err;
      if (!/column/i.test(err?.message || '')) throw err;
      console.warn('[stand_users] columnas faltantes, reintento con menos:', err.message);
    }
  }
  throw lastErr;
}

// aaa tablas de red: opcionales, nunca tumban el dashboard -bynd
async function fetchOptional(table, columns, label) {
  try {
    return { rows: await fetchAll(table, columns, label), error: null };
  } catch (err) {
    console.warn(`[${table}]`, err);
    const msg = String(err?.message || '');
    const missing = err?.code === '42P01' || err?.code === 'PGRST205' || /does not exist|could not find|schema cache/i.test(msg);
    return { rows: [], error: missing ? `${table} no existe (corre la migración)` : `${table}: ${msg}` };
  }
}

function transformDbRow(row) {
  return {
    username: row.username || '',
    status: row.status || 'active',
    mutual: row.mutual === true,
    origen: row.origen || 'unknown',
    profile_followers: parseInt(row.profile_followers) || 0,
    profile_following: parseInt(row.profile_following) || 0,
    profile_ratio: parseFloat(row.profile_ratio) || 0,
    followed_at: row.followed_at || '',
    last_updated: row.last_updated || '',
    mutual_checked_at: row.mutual_checked_at || '',
    unfollowed_at: row.unfollowed_at || '',
    request_state: row.request_state || '',
    is_private: row.is_private ?? null,
    days_active: 0
  };
}

function transformRedRow(row) {
  return {
    username: row.username,
    score: row.score != null ? Number(row.score) : null,
    total_conns: Number(row.total_conns || 0),
    mutual_conns: Number(row.mutual_conns || 0),
    others: Number(row.others || 0),
    follows_you: row.follows_you === true,
    checked_at: row.checked_at || '',
  };
}

async function loadFromDB() {
  if (!polpoSupabase) return;
  showLoading('[CONECTANDO A SUPABASE...]');
  setStatus('cargando...', true);

  try {
    const rows = await fetchAllStandUsers();
    const transformed = rows.map(transformDbRow);

    if (!transformed.length) {
      hideLoading();
      setStatus('0 rows · vacío', false);
      alert('No hay datos en stand_users. Inserta filas con tu bot o revisa RLS.');
      return;
    }

    const [fb, red] = await Promise.all([
      fetchOptional('followed_by', 'username,connection', 'FOLLOWED_BY'),
      fetchOptional('red_perfil', 'username,score,total_conns,mutual_conns,others,follows_you,checked_at', 'RED_PERFIL'),
    ]);
    const missing = [fb.error, red.error].filter(Boolean);
    if (!fb.error && !fb.rows.length) missing.push('followed_by vacío (¿sin datos o falta policy RLS de select?)');
    if (!red.error && !red.rows.length) missing.push('red_perfil vacío (¿sin datos o falta policy RLS de select?)');

    setStatus(`${transformed.length} rows · ${fb.rows.length} conexiones · ok`, true);
    hideLoading();
    dashboardEl.classList.add('visible');
    destroyAllCharts();
    buildDashboard(transformed);
    setNetworkData({
      users: transformed,
      followedBy: fb.rows,
      red: red.rows.map(transformRedRow),
      missing,
    });
  } catch (err) {
    console.error('[loadFromDB]', err);
    hideLoading();
    setStatus('✗ error', false);
    const msg = err.message || 'desconocido';
    alert(`Error cargando de Supabase: ${msg}\n\n→ Verifica que tienes RLS configurado para permitir lectura a usuarios autenticados.\n→ Revisa README.md`);
  }
}

// =====================================================
// CHART CLEANUP (para refresh sin duplicar charts)
// =====================================================
function destroyAllCharts() {
  // ey todas las instancias vivas, asi no hay que mantener la lista de ids a mano -bynd
  Object.values(Chart.instances).forEach(ch => {
    try { ch.destroy(); } catch (e) { /* noop */ }
  });
  if (typeof NA !== 'undefined') NA.charts = [];
}

// =====================================================
// TABS (crecimiento / red · análisis)
// =====================================================
function showView(viewId, push = true) {
  const tabs = document.querySelectorAll('.view-tab');
  tabs.forEach(t => {
    const on = t.dataset.view === viewId;
    t.classList.toggle('active', on);
    t.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  document.querySelectorAll('.view').forEach(v => { v.hidden = v.id !== viewId; });
  if (push) history.replaceState(null, '', viewId === 'viewNetwork' ? '#red' : '#crecimiento');

  const view = document.getElementById(viewId);
  if (viewId === 'viewNetwork' && NA.dirty) {
    renderNetworkView();
  } else {
    // aaa charts creados mientras la vista estaba oculta quedan en 0px -bynd
    Object.values(Chart.instances).forEach(ch => {
      if (view.contains(ch.canvas)) ch.resize();
    });
  }
}
document.querySelectorAll('.view-tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
if (location.hash === '#red') showView('viewNetwork', false);

// =====================================================
// EVENT LISTENERS
// =====================================================
loginBtn.addEventListener('click', doLogin);
loginEmail.addEventListener('keypress', e => { if (e.key === 'Enter') loginPass.focus(); });
loginPass.addEventListener('keypress', e => { if (e.key === 'Enter') doLogin(); });
logoutBtn.addEventListener('click', doLogout);
refreshBtn.addEventListener('click', loadFromDB);

if (polpoSupabase) {
  polpoSupabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' || (event === 'TOKEN_REFRESHED' && !session)) {
      showLogin();
    }
  });
}

// =====================================================
// BOOT
// =====================================================
checkSession();
