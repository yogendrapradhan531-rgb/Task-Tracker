const API = '/api';
const $ = (id) => document.getElementById(id);
let isLogin = true, boardView = false, projects = [];
const selected = new Set();
const STATUSES = { pending: 'To Do', 'in-progress': 'In Progress', completed: 'Done' };

const getToken = () => localStorage.getItem('token');
const showMessage = (t, err = false) => { $('message').textContent = t; $('message').className = err ? 'error' : 'success'; };

async function request(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(getToken() && { Authorization: `Bearer ${getToken()}` }) },
  });
  const data = await res.json();
  if (res.status === 401 && getToken()) logout();
  if (!res.ok) throw new Error(data.message || 'Request failed');
  return data;
}
const safe = (fn) => async (...a) => { try { await fn(...a); } catch (e) { showMessage(e.message, true); } };

// ---------- Theme ----------
document.documentElement.dataset.theme = localStorage.getItem('theme') || 'light';
$('theme').onclick = () => {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t;
  localStorage.setItem('theme', t);
};

// ---------- Auth ----------
function showApp() {
  const on = !!getToken();
  $('auth-section').hidden = on;
  $('task-section').hidden = !on;
  if (on) { $('welcome').textContent = `Hello, ${localStorage.getItem('username')}`; refresh(); }
}
function logout() { localStorage.removeItem('token'); localStorage.removeItem('username'); showApp(); }
$('logout').onclick = logout;

$('toggle-auth').onclick = (e) => {
  e.preventDefault();
  isLogin = !isLogin;
  $('username').hidden = isLogin;
  $('username').required = !isLogin;
  $('auth-submit').textContent = isLogin ? 'Login' : 'Register';
  e.target.textContent = isLogin ? 'Need an account? Register' : 'Have an account? Login';
  showMessage('');
};

$('auth-form').onsubmit = safe(async (e) => {
  e.preventDefault();
  const body = { email: $('email').value.trim(), password: $('password').value };
  if (!isLogin) body.username = $('username').value.trim();
  const data = await request(`${API}/auth/${isLogin ? 'login' : 'register'}`, { method: 'POST', body: JSON.stringify(body) });
  localStorage.setItem('token', data.token);
  localStorage.setItem('username', data.user.username);
  $('auth-form').reset(); showMessage(''); showApp();
});

$('profile').onclick = safe(async () => {
  const username = prompt('New username (leave blank to keep):');
  const newPassword = prompt('New password (leave blank to keep):');
  const body = {};
  if (username) body.username = username;
  if (newPassword) { body.newPassword = newPassword; body.currentPassword = prompt('Current password:'); }
  if (!Object.keys(body).length) return;
  const { user } = await request(`${API}/auth/profile`, { method: 'PUT', body: JSON.stringify(body) });
  localStorage.setItem('username', user.username);
  showMessage('Profile updated'); showApp();
});

// ---------- Data ----------
const refresh = safe(async () => { await loadProjects(); await Promise.all([loadStats(), loadTasks()]); });

async function loadStats() {
  const { data: s } = await request(`${API}/tasks/stats`);
  renderCharts(s);
  const items = [['Total', s.total], ['To Do', s.pending], ['In Progress', s.inProgress], ['Done', s.completed], ['Overdue', s.overdue]];
  $('stats').innerHTML = '';
  items.forEach(([label, n]) => {
    const d = document.createElement('div');
    d.className = 'stat' + (label === 'Overdue' && n ? ' warn' : '');
    d.innerHTML = '<b></b><span></span>';
    d.firstChild.textContent = n; d.lastChild.textContent = label;
    $('stats').append(d);
  });
}

async function loadProjects() {
  ({ data: projects } = await request(`${API}/projects`));
  const fill = (sel, first, keep) => {
    sel.innerHTML = '';
    sel.append(new Option(first, ''));
    projects.forEach((p) => sel.append(new Option(`${p.name} (${p.progress}%)`, p._id)));
    sel.value = keep || '';
  };
  fill($('project'), 'No project', $('project').value);
  fill($('f-project'), 'All projects', $('f-project').value);
  $('del-project').hidden = !$('f-project').value;
}

$('new-project').onclick = safe(async () => {
  const name = prompt('Project name:');
  if (!name || !name.trim()) return;
  await request(`${API}/projects`, { method: 'POST', body: JSON.stringify({ name: name.trim() }) });
  refresh();
});
$('del-project').onclick = safe(async () => {
  if (!confirm('Delete this project? Its tasks are kept.')) return;
  await request(`${API}/projects/${$('f-project').value}`, { method: 'DELETE' });
  $('f-project').value = ''; refresh();
});

const loadTasks = safe(async () => {
  const q = new URLSearchParams({ sort: $('f-sort').value, order: $('f-sort').value === 'createdAt' ? 'desc' : 'asc' });
  [['search', 'f-search'], ['status', 'f-status'], ['priority', 'f-priority'], ['project', 'f-project']]
    .forEach(([k, id]) => $(id).value && q.set(k, $(id).value));
  const { data } = await request(`${API}/tasks?${q}`);
  render(data);
});

['f-status', 'f-priority', 'f-project', 'f-sort'].forEach((id) => ($(id).onchange = () => { $('del-project').hidden = !$('f-project').value; loadTasks(); }));
let timer;
$('f-search').oninput = () => { clearTimeout(timer); timer = setTimeout(loadTasks, 300); };
$('view').onclick = () => { boardView = !boardView; $('view').textContent = boardView ? 'List view' : 'Board view'; loadTasks(); };

// ---------- Render ----------
// ---------- Charts (plain CSS bars, no library needed) ----------
function bars(title, rows) {
  const box = document.createElement('div'); box.className = 'chart';
  const h = document.createElement('h4'); h.textContent = title;
  const wrap = document.createElement('div'); wrap.className = 'bars';
  const max = Math.max(1, ...rows.map((r) => r[1]));
  rows.forEach(([label, val]) => {
    const c = document.createElement('div'); c.className = 'bar';
    const v = document.createElement('em'); v.textContent = val;
    const b = document.createElement('i'); b.style.height = Math.round((val / max) * 80) + 'px';
    const l = document.createElement('span'); l.textContent = label;
    c.append(v, b, l); wrap.append(c);
  });
  box.append(h, wrap);
  return box;
}
function renderCharts(s) {
  $('charts').innerHTML = '';
  $('charts').append(
    bars('Tasks by priority', Object.entries(s.byPriority)),
    bars('Completed (last 7 days)', s.last7.map((d) => [d.date.slice(5), d.count]))
  );
}

// ---------- Bulk actions ----------
function updateBulk() {
  $('bulk').hidden = selected.size === 0;
  $('sel-count').textContent = `${selected.size} selected`;
}
const bulk = safe(async (action) => {
  if (action === 'delete' && !confirm(`Delete ${selected.size} task(s)?`)) return;
  await request(`${API}/tasks/bulk`, { method: 'POST', body: JSON.stringify({ ids: [...selected], action }) });
  selected.clear(); updateBulk(); refresh();
});
$('bulk-done').onclick = () => bulk('complete');
$('bulk-del').onclick = () => bulk('delete');

// ---------- Task card ----------
function taskCard(t) {
  const li = document.createElement('li');
  const overdue = t.dueDate && t.status !== 'completed' && new Date(t.dueDate) < new Date();
  li.className = `task ${t.status} ${overdue ? 'overdue' : ''}`;
  li.draggable = true;
  li.ondragstart = (e) => e.dataTransfer.setData('id', t._id);

  const cb = document.createElement('input'); cb.type = 'checkbox'; cb.className = 'sel'; cb.checked = selected.has(t._id);
  cb.onchange = () => { cb.checked ? selected.add(t._id) : selected.delete(t._id); updateBulk(); };

  const info = document.createElement('div'); info.className = 'info';
  const title = document.createElement('strong'); title.textContent = t.title;
  const badge = document.createElement('span'); badge.className = `badge ${t.priority}`; badge.textContent = t.priority;
  const desc = document.createElement('p'); desc.textContent = t.description || '';
  const meta = document.createElement('small');
  meta.textContent = [t.project && t.project.name, t.dueDate && `Due ${new Date(t.dueDate).toLocaleDateString()}${overdue ? ' (overdue)' : ''}`, ...(t.tags || []).map((g) => '#' + g)].filter(Boolean).join(' · ');

  // Subtask checklist
  const subs = document.createElement('div'); subs.className = 'subs';
  (t.subtasks || []).forEach((s, i) => {
    const l = document.createElement('label'); const c = document.createElement('input');
    c.type = 'checkbox'; c.checked = s.done;
    c.onchange = () => {
      const arr = t.subtasks.map((x) => ({ text: x.text, done: x.done }));
      arr[i].done = c.checked; update(t._id, { subtasks: arr });
    };
    l.append(c, ' ' + s.text); subs.append(l);
  });

  // Latest comments
  const com = document.createElement('div'); com.className = 'comments';
  (t.comments || []).slice(-3).forEach((c) => { const p = document.createElement('p'); p.textContent = '- ' + c.text; com.append(p); });

  info.append(title, ' ', badge, desc, meta, subs, com);

  const actions = document.createElement('div'); actions.className = 'actions';
  const btn = (text, fn, cls = '') => { const b = document.createElement('button'); b.textContent = text; b.className = cls; b.onclick = fn; return b; };
  actions.append(
    btn(t.status === 'completed' ? 'Undo' : 'Complete', () => update(t._id, { status: t.status === 'completed' ? 'pending' : 'completed' })),
    btn('Edit', () => { const v = prompt('Edit title:', t.title); if (v && v.trim()) update(t._id, { title: v.trim() }); }),
    btn('+ Subtask', () => {
      const v = prompt('Subtask:');
      if (v && v.trim()) update(t._id, { subtasks: [...(t.subtasks || []).map((x) => ({ text: x.text, done: x.done })), { text: v.trim() }] });
    }, 'ghost'),
    btn('Comment', safe(async () => {
      const v = prompt('Comment:');
      if (v && v.trim()) { await request(`${API}/tasks/${t._id}/comments`, { method: 'POST', body: JSON.stringify({ text: v.trim() }) }); refresh(); }
    }), 'ghost'),
    btn('Delete', () => remove(t._id), 'danger')
  );
  li.append(cb, info, actions);
  return li;
}

function render(tasks) {
  $('task-list').hidden = boardView;
  $('board').hidden = !boardView;
  if (!boardView) {
    $('task-list').innerHTML = tasks.length ? '' : '<li class="empty">No tasks found.</li>';
    tasks.forEach((t) => $('task-list').append(taskCard(t)));
    return;
  }
  $('board').innerHTML = '';
  Object.entries(STATUSES).forEach(([status, label]) => {
    const col = document.createElement('div'); col.className = 'column';
    const h = document.createElement('h3'); h.textContent = label;
    const ul = document.createElement('ul');
    tasks.filter((t) => t.status === status).forEach((t) => ul.append(taskCard(t)));
    col.ondragover = (e) => e.preventDefault();
    col.ondrop = (e) => { e.preventDefault(); update(e.dataTransfer.getData('id'), { status }); };
    col.append(h, ul);
    $('board').append(col);
  });
}

// ---------- CRUD ----------
$('task-form').onsubmit = safe(async (e) => {
  e.preventDefault();
  const body = {
    title: $('title').value.trim(),
    description: $('description').value.trim(),
    priority: $('priority').value,
    project: $('project').value,
    dueDate: $('dueDate').value || undefined,
    tags: $('tags').value.split(',').map((s) => s.trim()).filter(Boolean),
  };
  await request(`${API}/tasks`, { method: 'POST', body: JSON.stringify(body) });
  $('task-form').reset(); showMessage('Task added'); refresh();
});
const update = safe(async (id, changes) => { await request(`${API}/tasks/${id}`, { method: 'PUT', body: JSON.stringify(changes) }); refresh(); });
const remove = safe(async (id) => { if (confirm('Delete this task?')) { await request(`${API}/tasks/${id}`, { method: 'DELETE' }); refresh(); } });

showApp();
