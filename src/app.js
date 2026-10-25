import './styles/app.css';
import { loadSubmissions } from './data/data-adapter.js';
import { statuses, completedStatuses, isCompleted, checkerNames, selectRuns, summarize } from './data/submissions.js';

let runs = [];
let source = null;
let loadError = '';
let loading = true;
let previewChecker = '';
const filters = { search: '', game: '', tier: '', status: '', checker: '', sort: 'newest' };

const paths = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1Z"/>',
  queue: '<rect x="4" y="4" width="16" height="17" rx="2"/><path d="M9 4V2h6v2M8 9h8M8 13h8M8 17h5"/>',
  claims: '<path d="M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM2 21v-3a6 6 0 0 1 12 0v3m2-8 2 2 4-4"/>',
  more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  arrow: '<path d="M4 12h16m-6-6 6 6-6 6"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v1"/>',
  tier: '<path d="m12 2 7 10-7 10-7-10Z"/>',
  calendar: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 11h18"/>',
  platform: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8m-4-4v4"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
  sync: '<path d="M20 7a9 9 0 0 0-15-2L2 8m0-5v5h5m-3 9a9 9 0 0 0 15 2l3-3m0 5v-5h-5"/>',
  chart: '<path d="M4 3v18h17M9 17v-5m5 5V7m5 10V4"/>',
  shield: '<path d="m12 2 8 3v6c0 5-8 11-8 11S4 16 4 11V5Z"/><path d="M12 7v6m0 3v1"/>',
  close: '<path d="m6 6 12 12M6 18 18 6"/>',
};
const icon = (name, className = '') => `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[character]));
const date = (value, full = false) => {
  if (!value) return '';
  const parsed = new Date(value + 'Z');
  if (Number.isNaN(parsed.getTime())) return 'Unrecognized date';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', ...(full ? { hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' } : {}), timeZone: 'UTC' }).format(parsed);
};
const statusClass = (status) => status === 'New' ? 'new' : status === 'In Progress' ? 'progress' : status === 'Rejected' ? 'rejected' : 'accepted';
const navigation = [['home', 'Home'], ['queue', 'Queue'], ['claims', 'My Claims'], ['more', 'More']];
const nav = (route) => navigation.map(([id, label]) => `<a class="nav-item" href="#/${id}" ${id === route ? 'aria-current="page"' : ''}>${icon(id)}<span>${label}</span></a>`).join('');

function checkerLabel(run) {
  if (!run.checker.trim()) return run.status === 'New' ? 'Unclaimed' : 'Checker not recorded';
  return `${isCompleted(run) ? 'Checked by' : run.status === 'In Progress' ? 'Claimed by' : 'Recorded checker:'} ${run.checker}`;
}

function card(run, showChecker = false) {
  const color = run.tier.includes('Hitless') ? 'blue' : run.tier === 'Champion' ? 'gold' : 'ember';
  return `<button type="button" class="run-card" data-run="${escape(run.id)}" aria-label="Open run details for ${escape(run.runner)}">
    <span class="card-top"><span class="game-name">${escape(run.game)}</span><span class="status ${statusClass(run.status)}"><span class="dot"></span>${escape(run.status || 'Not recorded')}</span></span>
    <span class="card-bottom"><span class="run-summary"><span class="runner">${escape(run.runner)}</span><span class="tier ${color}">${escape(run.tier)}</span></span>${run.submitted ? `<time class="submission-date" datetime="${run.submitted}">${date(run.submitted)}</time>` : ''}</span>
    ${showChecker ? `<span class="card-checker">${escape(checkerLabel(run))}</span>` : ''}
  </button>`;
}

const empty = message => `<p class="empty-results">${escape(message)}</p>`;
const sortedRuns = list => selectRuns(list, { search: '', sort: 'newest' });
const options = (values, selected) => values.map(value => `<option value="${escape(value)}" ${value === selected ? 'selected' : ''}>${escape(value)}</option>`).join('');
function checkerPicker() {
  return `<div class="checker-preview"><label for="preview-checker">Preview checker</label><select id="preview-checker"><option value="">Select a checker</option>${options(checkerNames(runs),previewChecker)}</select><p>Local preview filter only. This is not authentication.</p></div>`;
}
function claimCards() {
  const selected = sortedRuns(runs.filter(run => previewChecker && run.checker === previewChecker && run.status === 'In Progress'));
  return selected.length ? selected.map(run => card(run,true)).join('') : empty(previewChecker ? 'No In Progress runs for this checker.' : 'Select a checker to preview assigned runs.');
}
function home() {
  const available = sortedRuns(runs.filter(run => run.status === 'New' && !run.checker.trim()));
  const stats = summarize(runs);
  const counters = [['Pending',stats.byStatus.New,'new','New'],['In Progress',stats.byStatus['In Progress'],'progress','In Progress'],['Completed',stats.completed,'accepted','__completed']];
  return `<h1 class="home-title">Checker Dashboard</h1><section class="counters" aria-label="Submission counts">${counters.map(([label,count,color,status]) => `<button type="button" class="counter" data-status="${status}" aria-label="${label}: ${count} runs. Open filtered Queue"><span class="dot ${color}"></span><span>${label}</span><strong>${count}</strong></button>`).join('')}</section>
    <div class="home-sections"><section aria-labelledby="available-title"><div class="section-heading"><h2 id="available-title">Available Runs <span class="section-count">${available.length}</span></h2><a class="text-link" href="#/queue">Full Queue ${icon('arrow')}</a></div><div class="cards">${available.length ? available.map(run => card(run)).join('') : empty('No available runs in this data set.')}</div></section>
    <section aria-labelledby="claims-title"><div class="section-heading"><h2 id="claims-title">My Claims</h2><a class="text-link" href="#/claims">View ${icon('arrow')}</a></div>${checkerPicker()}<div class="cards">${claimCards()}</div></section></div>`;
}
function queue() {
  const unique = key => [...new Set(runs.map(run => run[key]).filter(Boolean))].sort((a,b)=>a.localeCompare(b));
  return `<h1 class="home-title">Submission Queue</h1><form class="queue-filters" role="search" aria-label="Submission filters"><label class="search-field">Runner<input type="search" name="search" placeholder="Search by runner" value="${escape(filters.search)}"></label>
    ${[['game','Game',unique('game')],['tier','Tier',unique('tier')],['status','Status',statuses],['checker','Checker',checkerNames(runs)]].map(([key,label,values]) => `<label>${label}<select name="${key}"><option value="">All ${label.toLowerCase()}s</option>${key==='checker'?`<option value="__unassigned" ${filters.checker==='__unassigned'?'selected':''}>Not assigned</option>`:''}${key==='status'?`<option value="__completed" ${filters.status==='__completed'?'selected':''}>Completed (all verdicts)</option>`:''}${options(values,filters[key])}</select></label>`).join('')}
    <label>Submission date<select name="sort"><option value="newest" ${filters.sort==='newest'?'selected':''}>Newest first</option><option value="oldest" ${filters.sort==='oldest'?'selected':''}>Oldest first</option></select></label><button class="btn" type="reset">Clear filters</button></form>
    <div id="active-status-filter" class="active-filter" hidden></div><p class="result-count" id="result-count" role="status"></p><section class="cards" id="queue-results" aria-label="Filtered submissions"></section>`;
}
function updateQueue() {
  const selected = selectRuns(runs,filters);
  const active = document.querySelector('#active-status-filter');
  active.hidden = !filters.status;
  active.innerHTML = filters.status ? `<span>Status: ${escape(filters.status === '__completed' ? `Completed (${completedStatuses.join(', ')})` : filters.status)}</span><button type="button" aria-label="Remove status filter">Remove ${icon('close')}</button>` : '';
  active.querySelector('button')?.addEventListener('click', () => {
    filters.status = '';
    const select = document.querySelector('[name=status]');
    select.value = '';
    updateQueue();
    select.focus({ preventScroll: true });
  });
  document.querySelector('#result-count').textContent = `${selected.length} of ${runs.length} submissions`;
  document.querySelector('#queue-results').innerHTML = selected.length ? selected.map(run=>card(run,true)).join('') : empty('No submissions match these filters.');
  bindCards();
}
function claims() {
  return `<h1 class="home-title">My Claims</h1>${checkerPicker()}<section class="cards" aria-label="Preview checker claims">${claimCards()}</section>`;
}
function statistics() {
  const stats = summarize(runs);
  const group = (title,entries) => `<section class="panel stats-panel"><h2>${title}</h2><dl class="statistics-list">${entries.map(([label,count])=>`<div><dt>${escape(label)}</dt><dd>${count}</dd></div>`).join('')}</dl></section>`;
  return `<h1 class="home-title">Statistics</h1><p class="section-caption">${runs.length} runs from ${source?.kind === 'demo' ? 'synthetic preview data' : 'the local snapshot'}. Pending means New. Completed includes both Accepted statuses and Rejected.</p><div class="statistics-grid">${group('Runs per game',Object.entries(stats.games))}${group('Verification status',[['Pending (New)',stats.byStatus.New],...statuses.slice(1).map(status=>[status,stats.byStatus[status]])])}${group('Completed runs per checker',Object.entries(stats.checkers).sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0])))}</div><p class="section-caption">Checker names identify the recorded verification responsibility, not the author of every historical action. Aliases have not been merged.</p>`;
}
function more() {
  return `<h1 class="home-title">More</h1><div class="more-grid"><a class="panel more-item" href="#/statistics">${icon('chart')}<div><h2>Statistics</h2><p>Submission and review counts.</p></div>${icon('arrow')}</a><section class="panel more-item">${icon('shield')}<div><h2>Integrity Monitor</h2><p>Not enabled. Historical values are preserved.</p></div><span class="soon">Planned</span></section></div><section class="panel source-panel"><h2>Data source</h2><p>${escape(source?.filename || 'No local snapshot loaded')}</p>${source && source.kind !== 'demo' ? `<p>Imported locally: ${escape(source.importedAt)}</p><p>Latest submission in snapshot: ${date(source.latestSubmission,true)}</p>` : ''}${source?.kind === 'demo' ? '<p>This team preview contains only fictional runners, reviews and dates. No private submissions are loaded. There is no login, live synchronization or write access.</p>' : '<p>Excel snapshot only. No live connection or automatic synchronization. Import time is not the export date. Worksheet timezone is not recorded; dates retain the worksheet clock values.</p><p>No login or write operations. Private data is available only through the loopback development server.</p>'}</section>`;
}

function render() {
  const requested = location.hash.replace(/^#\/?/, '');
  const route = [...navigation.map(([id]) => id), 'statistics'].includes(requested) ? requested : 'home';
  const views = { home, queue, claims, more, statistics };
  document.title = `${(navigation.find(([id]) => id === route)?.[1] || 'Statistics')} · OneBros Checker Dashboard`;
  document.querySelector('#app').innerHTML = `<header class="site-header"><a class="brand" href="#/home" aria-label="OneBros Checker Dashboard home"><svg class="brand-symbol" viewBox="0 0 32 40" fill="none" aria-hidden="true"><path d="M16 2 30 20 16 38 2 20Z" stroke="currentColor"/><path d="m16 12 6 8-6 8-6-8Z" fill="currentColor"/></svg><span><span class="brand-name">OneBros</span><span class="brand-caption">Checker Dashboard</span></span></a><div class="header-right"><nav class="desktop-nav" aria-label="Main">${nav(route)}</nav><span class="preview-badge">${source?.kind === 'demo' ? 'PREVIEW' : 'LOCAL PREVIEW'}</span></div></header>
    <main id="main" class="workspace ${route === 'home' ? 'home-workspace' : ''}" tabindex="-1"><div class="preview-notice">${icon('info')}<span>${source?.kind === 'demo' ? 'Team preview &middot; Synthetic data only' : source ? 'Excel snapshot &middot; Read-only &middot; Not live' : 'Preview &middot; No live connection'}</span></div>${loading ? empty('Loading local snapshot...') : loadError ? empty(loadError) : views[route]()}<footer class="shell-footer"><span>OneBros Checker Dashboard</span><span>${source?.kind === 'demo' ? 'Synthetic data only' : 'Local preview'}</span></footer></main>
    <nav class="bottom-nav" aria-label="Main">${nav(route)}</nav><dialog aria-labelledby="detail-title"><div id="dialog-content"></div></dialog>`;
  if (loading || loadError) return;
  bindCards();
  document.querySelectorAll('[data-status]').forEach(button => button.addEventListener('click', () => {
    Object.assign(filters, { search: '', game: '', tier: '', status: button.dataset.status, checker: '', sort: 'newest' });
    location.hash = '/queue';
  }));
  document.querySelector('#preview-checker')?.addEventListener('change', event => {
    previewChecker = event.target.value;
    render();
    document.querySelector('#preview-checker').focus({ preventScroll: true });
  });
  const form = document.querySelector('.queue-filters');
  if (form) {
    updateQueue();
    form.addEventListener('submit',event=>event.preventDefault());
    const update = event => { if(event.target.name) { filters[event.target.name]=event.target.value; updateQueue(); } };
    form.addEventListener('input',event => { if (event.target.name === 'search') update(event); });
    form.addEventListener('change',event => { if (event.target.name !== 'search') update(event); });
    form.addEventListener('reset',event=>{ event.preventDefault(); Object.assign(filters,{search:'',game:'',tier:'',status:'',checker:'',sort:'newest'}); render(); document.querySelector('[name=search]').focus(); });
  }
}

function bindCards() {
  document.querySelectorAll('[data-run]').forEach(button => { button.onclick = () => openDetails(button.dataset.run); });
}
function safeEvidence(value) {
  try { const url = new URL(value); return ['https:','http:'].includes(url.protocol) ? url.href : null; } catch { return null; }
}
function openDetails(id) {
  const run = runs.find(item => item.id === id);
  if (!run) return;
  const dialog = document.querySelector('dialog');
  const fields = [['Runner',run.runner],['Game',run.game],['Tier',run.tier],['Restrictions',run.restrictions],['Extra Restrictions',run.extraRestrictions],['Platform',run.platform],['Submission date',run.submitted && date(run.submitted,true)],['Status',run.status],['Checker',run.checker.trim()?run.checker:'Not recorded'],['Claimed Date',run.claimed && date(run.claimed,true)],['Checked Date',run.checked && date(run.checked,true)],['Checker Notes',run.notes]];
  const evidence = safeEvidence(run.evidence);
  document.querySelector('#dialog-content').innerHTML = `<div class="dialog-heading"><h2 id="detail-title">Run Details</h2><button class="close-button" aria-label="Close run details">${icon('close')}</button></div><p class="section-caption">${source?.kind === 'demo' ? 'Synthetic run for preview only. No verification actions are enabled.' : 'Read-only Excel snapshot. Dates use the worksheet clock; timezone is unspecified.'}</p><dl class="detail-list">${fields.filter(([key,value])=>value !== null && value !== false && value !== undefined).map(([key,value])=>`<div><dt>${key}</dt><dd>${value ? escape(value) : '<span class="not-recorded">Not recorded</span>'}</dd></div>`).join('')}<div><dt>Evidence link</dt><dd>${evidence ? `<a class="evidence-link" href="${escape(evidence)}" target="_blank" rel="noopener noreferrer">${escape(run.evidence)}</a>` : escape(run.evidence || 'Not recorded')}</dd></div></dl>${isCompleted(run)?'<p class="section-caption">The checker is the recorded verification responsible person, not a confirmed author of every historical action.</p>':''}${run.warnings.length?`<ul class="date-warnings">${run.warnings.map(warning=>`<li>${escape(warning)}</li>`).join('')}</ul>`:''}`;
  dialog.querySelector('button').addEventListener('click', () => dialog.close());
  dialog.showModal();
}

window.addEventListener('hashchange', () => { render(); document.querySelector('main').focus({ preventScroll: true }); window.scrollTo(0,0); });
render();

try { const data = await loadSubmissions(); runs = data.runs; source = data.source; } catch (error) { loadError = error.message; } finally { loading = false; render(); }
