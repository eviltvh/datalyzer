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
async function fetchAllStandUsers() {
  const PAGE_SIZE = 1000;
  let all = [];
  let from = 0;
  // Hard cap por seguridad (50k rows)
  const MAX_PAGES = 50;
  let pages = 0;

  while (pages < MAX_PAGES) {
    const { data, error } = await polpoSupabase
      .from('stand_users')
      .select('username,status,mutual,origen,profile_followers,profile_following,profile_ratio,followed_at,last_updated')
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
    days_active: 0
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

    setStatus(`${transformed.length} rows · ok`, true);
    hideLoading();
    dashboardEl.classList.add('visible');
    destroyAllCharts();
    buildDashboard(transformed);
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
  const canvasIds = [
    'pieMutuals', 'pieGhosts',
    'lineMutuals', 'lineGhosts',
    'histMutuals', 'histGhosts', 'polyCompare',
    'histMutualsPct', 'histGhostsPct', 'polyComparePct',
    'mutualityRate', 'avgRatioByOrigin', 'maxRatioByOrigin',
    'versusBar', 'scatterUqRatio', 'uqByOrigin',
    'selfFollowersLine', 'selfFollowingLine', 'selfRatioLine'
  ];
  canvasIds.forEach(id => {
    const ch = Chart.getChart(id);
    if (ch) {
      try { ch.destroy(); } catch (e) { /* noop */ }
    }
  });
}

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
