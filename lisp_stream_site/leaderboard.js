let period = 'weekly', currentData = [], source = 'loading';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const fmt = n => Number(n || 0).toLocaleString('en-US');

function findEntries(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return null;

  // Common API response wrappers; retain only arrays that look like entry lists.
  const keys = ['data', 'leaderboard', 'entries', 'users', 'results', 'standings', 'items', 'participants'];
  for (const key of keys) {
    const value = payload[key];
    if (Array.isArray(value)) return value;
    if (value && typeof value === 'object') {
      const nested = findEntries(value);
      if (nested) return nested;
    }
  }
  return null;
}
function normalize(payload) {
  const entries = findEntries(payload);
  if (!entries) {
    const keys = payload && typeof payload === 'object' ? Object.keys(payload).join(', ') : typeof payload;
    throw new Error('API responded, but no leaderboard array was found. Top-level fields: ' + (keys || '(none)'));
  }
  return entries.map((x, i) => {
    const name = x.name ?? x.username ?? x.userName ?? x.displayName ?? x.display_name ??
      x.steamName ?? x.steam_name ?? x.playerName ?? x.player_name ?? x.user?.name ??
      x.user?.username ?? x.player?.name ?? `Player ${i + 1}`;
    const hours = x.watchHours ?? x.watch_hours ?? x.hours ?? x.totalHours ?? x.total_hours ??
      x.watchTime ?? x.watch_time ?? x.timeWatched ?? x.time_watched ?? x.value ?? x.score ?? 0;
    return {
      name: String(name),
      avatar: String(x.avatar ?? x.initials ?? String(name).slice(0, 1)).slice(0, 3),
      color: ['red-avatar', 'blue-avatar', 'gold-avatar', 'green-avatar'][i % 4],
      weekly: Number(x.weeklyHours ?? x.weekly_hours ?? x.weekly ?? hours) || 0,
      monthly: Number(x.monthlyHours ?? x.monthly_hours ?? x.monthly ?? hours) || 0,
      all: Number(x.allTimeHours ?? x.all_time_hours ?? x.totalHours ?? x.total_hours ?? hours) || 0
    };
  });
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function render() {
  const key = period === 'weekly' ? 'weekly' : period === 'monthly' ? 'monthly' : 'all';
  const sorted = [...currentData].sort((a, b) => b[key] - a[key]);
  $('#leaderRows').innerHTML = sorted.map((s, i) =>
    `<div class="leader-row"><span class="rank">${i + 1}</span><span class="streamer-cell"><span class="mini-avatar ${s.color}">${escapeHtml(s.avatar)}</span><b>${escapeHtml(s.name)}</b></span><span class="hours">${fmt(s[key])}</span><span class="reward">▤ Nothing currently</span></div>`
  ).join('') || '<div class="empty-state">No leaderboard entries returned by the API.</div>';
}
$$('[data-period]').forEach(btn => btn.addEventListener('click', async () => {
  period = btn.dataset.period;
  $$('[data-period]').forEach(b => b.classList.toggle('active', b === btn));
  await loadLeaderboard();
}));
async function loadLeaderboard() {
  const status = $('#dataStatus');
  status.textContent = 'Loading leaderboard data…';
  try {
    const response = await fetch('/.netlify/functions/leaderboard?period=' + encodeURIComponent(period), {
      headers: { 'Accept': 'application/json' },
      cache: 'no-store'
    });
    const raw = await response.text();
    let payload;
    try { payload = JSON.parse(raw); }
    catch { throw new Error(`Netlify function returned non-JSON (HTTP ${response.status}). Check the function deployment and logs.`); }

    if (!response.ok) {
      const detail = payload?.error || payload?.message || payload?.detail || raw.slice(0, 240);
      throw new Error(`API request failed (HTTP ${response.status}): ${detail}`);
    }
    currentData = normalize(payload);
    source = 'api';
    render();
    status.textContent = currentData.length
      ? `Loaded ${currentData.length} leaderboard entr${currentData.length === 1 ? 'y' : 'ies'}.`
      : 'The API responded successfully but returned zero entries for this leaderboard/period.';
  } catch (error) {
    currentData = [];
    source = 'unavailable';
    render();
    status.textContent = 'Leaderboard error: ' + (error?.message || String(error));
  }
}
render();
loadLeaderboard();
