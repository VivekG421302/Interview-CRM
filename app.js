/**
 * app.js — Pipeline CRM v2
 * ------------------------------------------------------------
 * Full-featured client-side CRM with:
 * - Custom accent color
 * - No seed data (CSV-first)
 * - Work mode + working hours tracking
 * - Interview Q&A bank
 * - Complete sync export/import
 * - Mobile-first responsive design
 * ------------------------------------------------------------
 */

/* ============================================================
   REPOSITORY (localStorage layer)
   ============================================================ */
const DataRepository = {
  getCompanies(){
    const raw = localStorage.getItem(STORAGE_KEYS.companies);
    return raw ? JSON.parse(raw) : [];
  },
  saveCompanies(companies){
    localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(companies));
  },
  getApplications(){
    const raw = localStorage.getItem(STORAGE_KEYS.applications);
    return raw ? JSON.parse(raw) : [];
  },
  saveApplications(applications){
    localStorage.setItem(STORAGE_KEYS.applications, JSON.stringify(applications));
  },
  getQA(){
    const raw = localStorage.getItem(STORAGE_KEYS.qa);
    return raw ? JSON.parse(raw) : [];
  },
  saveQA(qa){
    localStorage.setItem(STORAGE_KEYS.qa, JSON.stringify(qa));
  },
  getTheme(){ return localStorage.getItem(STORAGE_KEYS.theme) || 'dark'; },
  saveTheme(theme){ localStorage.setItem(STORAGE_KEYS.theme, theme); },
  getAccent(){ return localStorage.getItem(STORAGE_KEYS.accent) || null; },
  saveAccent(color){ localStorage.setItem(STORAGE_KEYS.accent, color); },
  getSidebarCollapsed(){ return localStorage.getItem(STORAGE_KEYS.sidebar) === 'true'; },
  saveSidebarCollapsed(val){ localStorage.setItem(STORAGE_KEYS.sidebar, String(val)); },
  getHasData(){ return localStorage.getItem(STORAGE_KEYS.hasData) === 'true'; },
  setHasData(val){ localStorage.setItem(STORAGE_KEYS.hasData, String(val)); },
  getSort(){
    const raw = localStorage.getItem(STORAGE_KEYS.sort);
    return raw ? JSON.parse(raw) : { field: 'name', dir: 'asc' };
  },
  saveSort(sort){ localStorage.setItem(STORAGE_KEYS.sort, JSON.stringify(sort)); },
  clearAll(){
    localStorage.removeItem(STORAGE_KEYS.companies);
    localStorage.removeItem(STORAGE_KEYS.applications);
    localStorage.removeItem(STORAGE_KEYS.qa);
    localStorage.removeItem(STORAGE_KEYS.hasData);
    localStorage.removeItem(STORAGE_KEYS.sort);
  },
  exportAll(){
    return {
      version: 2,
      exportedAt: new Date().toISOString(),
      companies: this.getCompanies(),
      applications: this.getApplications(),
      qa: this.getQA(),
      settings: {
        theme: this.getTheme(),
        accent: this.getAccent(),
        sidebarCollapsed: this.getSidebarCollapsed(),
      }
    };
  },
  importAll(data){
    if (data.companies) this.saveCompanies(data.companies);
    if (data.applications) this.saveApplications(data.applications);
    if (data.qa) this.saveQA(data.qa);
    if (data.settings){
      if (data.settings.theme) this.saveTheme(data.settings.theme);
      if (data.settings.accent) this.saveAccent(data.settings.accent);
      if (data.settings.sidebarCollapsed !== undefined) this.saveSidebarCollapsed(data.settings.sidebarCollapsed);
    }
    this.setHasData(true);
  }
};

/* ============================================================
   UTILITIES
   ============================================================ */
const uid = (prefix) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const pad4 = (n) => String(n).padStart(4, '0');
const escapeHtml = (str) => String(str ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatCurrency = (n) => n ? `₹${Number(n).toLocaleString('en-IN')}` : '—';
const formatDate = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
};
const formatDateTime = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleString('en-IN', { day:'2-digit', month:'short', year:'numeric', hour:'2-digit', minute:'2-digit' });
};
const debounce = (fn, ms=250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const toast = (msg) => {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.add('hidden'), 2600);
};

/* ============================================================
   APP STATE
   ============================================================ */
const AppState = {
  companies: [],
  applications: [],
  qa: [],
  currentView: 'dashboard',
  kanbanChannelFilter: 'all',
  directory: { search: '', type: 'all', location: 'all', stage: 'all', page: 1, pageSize: 12 },
  qaFilter: { search: '', tag: 'all' },
  companiesFilter: { search: '', type: 'all', location: 'all', source: 'all' },
  sort: { field: 'name', dir: 'asc' },
  activeCompanyId: null,
  activeTab: 'meta',
  profileFromView: 'companies',
  charts: {},
  hasData: false,

  init(){
    this.hasData = DataRepository.getHasData();
    this.sort = DataRepository.getSort();
    if (!this.hasData){
      this.companies = [];
      this.applications = [];
      this.qa = [];
      return;
    }
    this.companies = DataRepository.getCompanies();
    this.applications = DataRepository.getApplications();
    this.qa = DataRepository.getQA();
  },

  persist(){
    DataRepository.saveCompanies(this.companies);
    DataRepository.saveApplications(this.applications);
    DataRepository.saveQA(this.qa);
    DataRepository.setHasData(true);
    this.hasData = true;
  },

  getApplicationForCompany(companyId){
    const apps = this.applications.filter(a => a.companyId === companyId);
    return apps.length ? apps[apps.length - 1] : null;
  },

  get uniqueLocations(){
    return [...new Set(this.companies.map(c => c.location))].sort();
  },

  get uniqueSources(){
    return [...new Set(this.companies.map(c => c.source).filter(Boolean))].sort();
  },

  get qaTags(){
    const tags = new Set();
    this.qa.forEach(q => q.tags?.forEach(t => tags.add(t)));
    return [...tags].sort();
  }
};


/* ============================================================
   CSV PARSER
   ============================================================ */
function parseCSV(text){
  const lines = text.split(/\r\n|\n/).filter(l => l.trim().length);
  if (!lines.length) return [];
  const parseLine = (line) => {
    const out = []; let cur = ''; let inQuotes = false;
    for (let i = 0; i < line.length; i++){
      const ch = line[i];
      if (ch === '"'){
        if (inQuotes && line[i+1] === '"'){ cur += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === ',' && !inQuotes){
        out.push(cur); cur = '';
      } else cur += ch;
    }
    out.push(cur);
    return out.map(s => s.trim());
  };
  const headers = parseLine(lines[0]);
  return lines.slice(1).map(line => {
    const values = parseLine(line);
    const row = {};
    headers.forEach((h, i) => row[h] = values[i] ?? '');
    return row;
  });
}

function cleanSalary(val){
  if (!val) return 0;
  const cleaned = String(val).replace(/[^\d.]/g, '');
  return Number(cleaned) || 0;
}

function importCSVRows(rows){
  let added = 0, updated = 0;
  rows.forEach(row => {
    const id = row['ID']?.trim();
    if (!id) return;
    const payload = {
      id,
      name: row['Name'] || 'Unnamed Company',
      type: (row['Type'] || 'Service').trim(),
      location: row['Location'] || 'Unknown',
      coreFocus: row['Product / Core Focus'] || '',
      averageSalary: cleanSalary(row['Average Salary']),
      contactNumber: row['Contact Number'] || '',
      linkedinUrl: row['Linkedin'] || '',
      workMode: row['Work Mode'] || 'On-Site',
      workingHours: row['Working Hours'] || '',
      source: row['Source'] || '',
      logoUrl: row['Logo URL'] || '',
    };
    const existingIdx = AppState.companies.findIndex(c => c.id === id);
    if (existingIdx >= 0){
      AppState.companies[existingIdx] = { ...AppState.companies[existingIdx], ...payload };
      updated++;
    } else {
      AppState.companies.push(payload);
      const currentStage = Number(row['Current Stage']) || 1;
      const createdAt = new Date().toISOString();
      AppState.applications.push({
        id: uid('APP'),
        companyId: id,
        currentStage: Math.min(Math.max(currentStage, 1), 5),
        createdAt,
        updatedAt: createdAt,
        timeline: [{ stage: 1, timestamp: createdAt, notes: 'Imported via CSV.' }],
        stageData: { 1: { channel: 'LinkedIn', vacancyFound: false, resumeSent: false, date: createdAt }, 2:null, 3:null, 4:null, 5:null }
      });
      added++;
    }
  });
  AppState.persist();
  return { added, updated };
}

function downloadFile(content, filename, mime){
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportSampleTemplate(){
  const header = 'ID,Name,Type,Location,Product / Core Focus,Average Salary,Contact Number,Linkedin,Current Stage,Work Mode,Working Hours,Source,Logo URL';
  const sample = 'CMP-9001,Sample Systems Pvt Ltd,Service,Bengaluru,Enterprise ERP,1200000,+91 9876543210,https://linkedin.com/company/sample-systems,1,Hybrid,9:00 AM - 6:00 PM,LinkedIn,https://example.com/logo.png';
  downloadFile(`${header}\n${sample}`, 'pipeline_companies_template.csv', 'text/csv');
}

function exportFullJSON(){
  const payload = DataRepository.exportAll();
  downloadFile(JSON.stringify(payload, null, 2), `pipeline_full_backup_${Date.now()}.json`, 'application/json');
  toast('Full backup exported');
}

function exportCSV(){
  const header = 'ID,Name,Type,Location,Product / Core Focus,Average Salary,Contact Number,Linkedin,Current Stage,Work Mode,Working Hours,Source,Logo URL';
  const rows = AppState.companies.map(c => {
    const app = AppState.getApplicationForCompany(c.id);
    return [
      c.id,
      `"${c.name.replace(/"/g,'""')}"`,
      c.type,
      c.location,
      `"${(c.coreFocus || '').replace(/"/g,'""')}"`,
      c.averageSalary,
      c.contactNumber,
      c.linkedinUrl,
      app?.currentStage || 1,
      c.workMode || 'On-Site',
      `"${(c.workingHours || '').replace(/"/g,'""')}"`,
      `"${(c.source || '').replace(/"/g,'""')}"`,
      c.logoUrl && !c.logoUrl.startsWith('data:') ? c.logoUrl : '',
    ].join(',');
  });
  downloadFile([header, ...rows].join('\n'), `pipeline_directory_${Date.now()}.csv`, 'text/csv');
  toast('CSV exported');
}

function logUpload(msg){
  const log = document.getElementById('uploadLog');
  const time = new Date().toLocaleTimeString('en-IN');
  log.textContent = `[${time}] ${msg}\n` + log.textContent;
}

/* ============================================================
   RENDER: SIDEBAR / SHELL
   ============================================================ */
function renderSidebarCounts(){
  document.getElementById('sidebarCompanyCount').textContent = AppState.companies.length;
}

function switchView(view){
  AppState.currentView = view;
  document.querySelectorAll('.view-panel').forEach(el => el.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.view === view));

  const titles = {
    dashboard: ['Executive Dashboard', 'STATUS_OVERVIEW / ALL_SYSTEMS'],
    kanban: ['Pipeline Board', 'KANBAN_VIEW / 5_STAGE_FLOW'],
    directory: ['Global Directory', `${AppState.companies.length}_RECORDS / SEARCHABLE`],
    companies: ['Companies', `${AppState.companies.length}_RECORDS / CARD_VIEW`],
    qa: ['Interview Q&A Bank', `${AppState.qa.length}_QUESTIONS / PREP_LIBRARY`],
    upload: ['Data Sync', 'IMPORT_EXPORT / FULL_SYNC'],
    profile: ['Company Profile', 'DETAILED_RECORD / FULL_VIEW'],
  };
  const t = titles[view] || ['Pipeline', ''];
  document.getElementById('viewTitle').textContent = t[0];
  document.getElementById('viewSubtitle').textContent = t[1];

  if (view === 'dashboard') renderDashboard();
  if (view === 'kanban') renderKanban();
  if (view === 'directory') renderDirectory();
  if (view === 'companies') renderCompanies();
  if (view === 'qa') renderQA();
  if (view === 'profile') renderProfile();

  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}


/* ============================================================
   RENDER: DASHBOARD
   ============================================================ */
function renderDashboard(){
  if (!AppState.hasData){
    document.getElementById('dashboardContent').classList.add('hidden');
    document.getElementById('dashboardEmpty').classList.remove('hidden');
    return;
  }
  document.getElementById('dashboardContent').classList.remove('hidden');
  document.getElementById('dashboardEmpty').classList.add('hidden');

  const apps = AppState.applications;
  const total = AppState.companies.length;
  const active = apps.filter(a => a.currentStage < 4 || (a.currentStage === 5 && a.stageData[5]?.acceptanceStatus === 'Pending')).length;
  const interviews = apps.filter(a => a.currentStage === 3).length;
  const offers = apps.filter(a => a.currentStage === 5 || (a.currentStage === 4 && a.stageData[4]?.status === 'Pass')).length;
  const rejections = apps.filter(a => (a.currentStage === 4 && a.stageData[4]?.status === 'Fail') || (a.currentStage === 5 && a.stageData[5]?.acceptanceStatus === 'Rejected')).length;

  document.getElementById('kpiTotal').textContent = total;
  document.getElementById('kpiActive').textContent = active;
  document.getElementById('kpiInterviews').textContent = interviews;
  document.getElementById('kpiOffers').textContent = offers;
  document.getElementById('kpiRejections').textContent = rejections;

  const style = getComputedStyle(document.documentElement);
  const cAccent = style.getPropertyValue('--accent').trim();
  const cAccent2 = style.getPropertyValue('--accent-2').trim();
  const cSuccess = style.getPropertyValue('--success').trim();
  const cDanger = style.getPropertyValue('--danger').trim();
  const cDim = style.getPropertyValue('--text-dim').trim();
  const cBorder = style.getPropertyValue('--border').trim();
  const cText = style.getPropertyValue('--text').trim();

  Chart.defaults.color = cDim;
  Chart.defaults.borderColor = cBorder;
  Chart.defaults.font.family = "'Inter', sans-serif";

  // Funnel
  const stageCounts = STAGES.map(s => apps.filter(a => a.currentStage === s.id).length);
  destroyChart('funnel');
  AppState.charts.funnel = new Chart(document.getElementById('funnelChart'), {
    type: 'bar',
    data: {
      labels: STAGES.map(s => s.tag),
      datasets: [{ data: stageCounts, backgroundColor: [cAccent, cAccent, cAccent2, cAccent2, cSuccess], borderRadius: 6, barThickness: 28 }]
    },
    options: {
      indexAxis: 'y',
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { grid: { color: cBorder } }, y: { grid: { display: false } } }
    }
  });

  // Type doughnut
  const productCount = AppState.companies.filter(c => c.type === 'Product').length;
  const serviceCount = AppState.companies.filter(c => c.type === 'Service').length;
  destroyChart('type');
  AppState.charts.type = new Chart(document.getElementById('typeChart'), {
    type: 'doughnut',
    data: {
      labels: ['Product', 'Service'],
      datasets: [{ data: [productCount, serviceCount], backgroundColor: [cAccent, cAccent2], borderColor: 'transparent' }]
    },
    options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom', labels: { color: cText, boxWidth: 10, font: { size: 11 } } } }, cutout: '65%' }
  });

  // Salary vs bond scatter
  const offerPoints = apps
    .filter(a => a.currentStage >= 4 && a.stageData[4]?.status === 'Pass')
    .map(a => ({ x: a.stageData[4].bondDurationMonths, y: a.stageData[4].baseSalary }));
  destroyChart('salaryBond');
  AppState.charts.salaryBond = new Chart(document.getElementById('salaryBondChart'), {
    type: 'scatter',
    data: { datasets: [{ label: 'Offers', data: offerPoints, backgroundColor: cAccent, pointRadius: 6, pointHoverRadius: 8 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: (ctx) => `Bond: ${ctx.parsed.x}mo · Salary: ${formatCurrency(ctx.parsed.y)}` } } },
      scales: {
        x: { title: { display: true, text: 'Bond Duration (months)', color: cDim }, grid: { color: cBorder } },
        y: { title: { display: true, text: 'Base Salary (₹)', color: cDim }, grid: { color: cBorder } }
      }
    }
  });
}
function destroyChart(key){ if (AppState.charts[key]) { AppState.charts[key].destroy(); delete AppState.charts[key]; } }


/* ============================================================
   RENDER: KANBAN
   ============================================================ */
function channelForApp(app){ return app.stageData[1]?.channel || '—'; }

function renderKanban(){
  const board = document.getElementById('kanbanBoard');
  board.innerHTML = '';
  const filter = AppState.kanbanChannelFilter;

  STAGES.forEach(stage => {
    let apps = AppState.applications.filter(a => a.currentStage === stage.id);
    if (filter !== 'all') apps = apps.filter(a => channelForApp(a) === filter);

    const col = document.createElement('div');
    col.className = 'kanban-column';
    col.innerHTML = `
      <div class="kanban-column-head">
        <span class="kanban-column-title">${stage.label}</span>
        <div class="flex items-center justify-between">
          <span class="kanban-column-tag font-mono">[${stage.tag}]</span>
          <span class="kanban-column-count font-mono">${apps.length}</span>
        </div>
      </div>
      <div class="kanban-cards"></div>
    `;
    const cardsWrap = col.querySelector('.kanban-cards');

    apps.forEach(app => {
      const company = AppState.companies.find(c => c.id === app.companyId);
      if (!company) return;
      let overdue = false;
      if (stage.id === 2 && app.stageData[2]?.followUpDate){
        overdue = new Date(app.stageData[2].followUpDate) < new Date() && app.stageData[2].status === 'Pending';
      }
      const card = document.createElement('div');
      card.className = `kanban-card${overdue ? ' flagged' : ''}`;
      card.innerHTML = `
        <div class="kanban-card-title">${escapeHtml(company.name)}</div>
        <div class="kanban-card-meta">
          <span class="kanban-card-badge">${escapeHtml(company.type)}</span>
          <span class="font-mono">${channelForApp(app)}</span>
        </div>
        <div class="kanban-card-meta" style="margin-top:0.35rem;">
          <span class="font-mono">${escapeHtml(company.id)}</span>
          <span>${formatDate(app.updatedAt)}</span>
        </div>
        ${overdue ? `<div class="kanban-card-flag"><i data-lucide="alert-triangle"></i> Follow-up overdue</div>` : ''}
      `;
      card.addEventListener('click', () => openCompanyProfile(company.id, 'kanban'));
      cardsWrap.appendChild(card);
    });

    board.appendChild(col);
  });

  lucide.createIcons();
}

/* ============================================================
   RENDER: DIRECTORY
   ============================================================ */
function populateLocationFilter(){
  const sel = document.getElementById('filterLocation');
  const current = sel.value;
  sel.innerHTML = '<option value="all">All Locations</option>' +
    AppState.uniqueLocations.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  sel.value = current || 'all';
}

function getFilteredCompanies(){
  const { search, type, location, stage } = AppState.directory;
  return AppState.companies.filter(c => {
    const app = AppState.getApplicationForCompany(c.id);
    if (search){
      const s = search.toLowerCase();
      if (!(c.name.toLowerCase().includes(s) || c.location.toLowerCase().includes(s) || c.coreFocus.toLowerCase().includes(s) || c.id.toLowerCase().includes(s))) return false;
    }
    if (type !== 'all' && c.type !== type) return false;
    if (location !== 'all' && c.location !== location) return false;
    if (stage !== 'all' && (!app || app.currentStage !== Number(stage))) return false;
    return true;
  });
}

function renderDirectory(){
  populateLocationFilter();
  const filtered = getFilteredCompanies();
  const { page, pageSize } = AppState.directory;
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const clampedPage = Math.min(page, totalPages);
  AppState.directory.page = clampedPage;
  const pageItems = filtered.slice((clampedPage - 1) * pageSize, clampedPage * pageSize);

  const tbody = document.getElementById('directoryTableBody');
  tbody.innerHTML = pageItems.map(c => {
    const app = AppState.getApplicationForCompany(c.id);
    const stage = STAGES.find(s => s.id === (app?.currentStage || 1));
    return `
      <tr data-id="${c.id}">
        <td class="font-mono text-dim">${c.id}</td>
        <td class="font-semibold">${escapeHtml(c.name)}</td>
        <td>${escapeHtml(c.type)}</td>
        <td>${escapeHtml(c.location)}</td>
        <td><span class="stage-tag">[${stage.tag}]</span></td>
        <td class="text-dim text-sm">${formatDate(app?.updatedAt)}</td>
        <td><i data-lucide="chevron-right" class="text-dim" style="width:16px;height:16px;"></i></td>
      </tr>
    `;
  }).join('') || `<tr><td colspan="7" class="text-center text-dim" style="padding:2rem;">No companies match these filters.</td></tr>`;

  tbody.querySelectorAll('tr[data-id]').forEach(row => {
    row.addEventListener('click', () => openCompanyProfile(row.dataset.id, 'directory'));
  });

  // pagination
  const pag = document.getElementById('directoryPagination');
  let html = '';
  const maxButtons = 7;
  let start = Math.max(1, clampedPage - 3);
  let end = Math.min(totalPages, start + maxButtons - 1);
  start = Math.max(1, end - maxButtons + 1);
  for (let p = start; p <= end; p++){
    html += `<button class="page-btn${p === clampedPage ? ' active' : ''}" data-page="${p}">${p}</button>`;
  }
  pag.innerHTML = html;
  pag.querySelectorAll('.page-btn').forEach(btn => {
    btn.addEventListener('click', () => { AppState.directory.page = Number(btn.dataset.page); renderDirectory(); });
  });

  lucide.createIcons();
}


/* ============================================================
   RENDER: COMPANIES (Card Grid) + CRUD
   ============================================================ */
function populateCompaniesFilters(){
  const locSel = document.getElementById('companiesFilterLocation');
  const curLoc = locSel.value;
  locSel.innerHTML = '<option value="all">All Locations</option>' +
    AppState.uniqueLocations.map(l => `<option value="${escapeHtml(l)}">${escapeHtml(l)}</option>`).join('');
  locSel.value = curLoc || 'all';

  const srcSel = document.getElementById('companiesFilterSource');
  const curSrc = srcSel.value;
  srcSel.innerHTML = '<option value="all">All Sources</option>' +
    AppState.uniqueSources.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  srcSel.value = curSrc || 'all';
}

function getFilteredSortedCompanies(){
  const { search, type, location, source } = AppState.companiesFilter;
  let list = AppState.companies.filter(c => {
    if (search){
      const s = search.toLowerCase();
      if (!(c.name.toLowerCase().includes(s) || c.location.toLowerCase().includes(s) || (c.coreFocus || '').toLowerCase().includes(s) || c.id.toLowerCase().includes(s))) return false;
    }
    if (type !== 'all' && c.type !== type) return false;
    if (location !== 'all' && c.location !== location) return false;
    if (source !== 'all' && (c.source || '') !== source) return false;
    return true;
  });

  const { field, dir } = AppState.sort;
  list = [...list].sort((a, b) => {
    let av = a[field], bv = b[field];
    if (typeof av === 'string') av = av.toLowerCase();
    if (typeof bv === 'string') bv = bv.toLowerCase();
    if (av == null) av = '';
    if (bv == null) bv = '';
    if (av < bv) return dir === 'asc' ? -1 : 1;
    if (av > bv) return dir === 'asc' ? 1 : -1;
    return 0;
  });
  return list;
}

function renderCompanies(){
  populateCompaniesFilters();
  const list = getFilteredSortedCompanies();

  // reflect sort state on toolbar buttons
  document.querySelectorAll('.sort-btn').forEach(btn => {
    const active = btn.dataset.sort === AppState.sort.field;
    btn.classList.toggle('active', active);
    const icon = btn.querySelector('.sort-icon');
    if (icon) icon.textContent = active ? (AppState.sort.dir === 'asc' ? '↑' : '↓') : '⇅';
  });

  const grid = document.getElementById('companiesGrid');
  if (!list.length){
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="building-2" class="empty-state-icon"></i>
        <h2>No companies found</h2>
        <p>Try adjusting your filters, or add a new company to get started.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = list.map(c => {
    const app = AppState.getApplicationForCompany(c.id);
    const stage = STAGES.find(s => s.id === (app?.currentStage || 1));
    const logoHtml = c.logoUrl
      ? `<img src="${escapeHtml(c.logoUrl)}" class="company-card-logo" alt="" />`
      : `<div class="company-card-logo-placeholder">${initialsOf(c.name)}</div>`;
    return `
      <div class="company-card" data-id="${c.id}">
        <div class="company-card-top">
          ${logoHtml}
          <div class="company-card-actions">
            <button class="icon-btn cc-edit-btn" data-id="${c.id}" aria-label="Edit company"><i data-lucide="pencil"></i></button>
            <button class="icon-btn cc-del-btn" data-id="${c.id}" aria-label="Delete company"><i data-lucide="trash-2"></i></button>
          </div>
        </div>
        <div class="company-card-name">${escapeHtml(c.name)}</div>
        <div class="company-card-meta">
          <span class="kanban-card-badge">${escapeHtml(c.type)}</span>
          <span class="font-mono text-xs text-dim">${escapeHtml(c.location)}</span>
        </div>
        <div class="company-card-focus">${escapeHtml(c.coreFocus || 'No core focus set')}</div>
        <div class="company-card-footer">
          <span class="font-mono text-xs">${formatCurrency(c.averageSalary)}</span>
          <span class="stage-tag">[${stage.tag}]</span>
        </div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.company-card').forEach(card => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.cc-edit-btn') || e.target.closest('.cc-del-btn')) return;
      openCompanyProfile(card.dataset.id, 'companies');
    });
  });
  grid.querySelectorAll('.cc-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openCompanyForm(btn.dataset.id); });
  });
  grid.querySelectorAll('.cc-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteCompany(btn.dataset.id); });
  });

  lucide.createIcons();
}

let companyFormLogoData = null;

function openCompanyForm(id){
  const existing = id ? AppState.companies.find(c => c.id === id) : null;
  companyFormLogoData = null;

  document.getElementById('companyFormTitle').textContent = existing ? 'Edit Company' : 'Add Company';
  document.getElementById('companyFormId').value = existing?.id || '';
  document.getElementById('cfName').value = existing?.name || '';
  document.getElementById('cfType').value = existing?.type || 'Product';
  document.getElementById('cfWorkMode').value = existing?.workMode || 'On-Site';
  document.getElementById('cfLocation').value = existing?.location || '';
  document.getElementById('cfFocus').value = existing?.coreFocus || '';
  document.getElementById('cfSalary').value = existing?.averageSalary || '';
  document.getElementById('cfHours').value = existing?.workingHours || '';
  document.getElementById('cfPhone').value = existing?.contactNumber || '';
  document.getElementById('cfLinkedin').value = existing?.linkedinUrl || '';
  document.getElementById('cfSource').value = existing?.source || '';
  document.getElementById('cfLogoFile').value = '';
  document.getElementById('cfLogoUrl').value = (existing?.logoUrl && !existing.logoUrl.startsWith('data:')) ? existing.logoUrl : '';

  const preview = document.getElementById('companyLogoPreview');
  const placeholder = document.getElementById('companyLogoPlaceholder');
  if (existing?.logoUrl){
    preview.src = existing.logoUrl;
    preview.classList.remove('hidden');
    placeholder.classList.add('hidden');
  } else {
    preview.classList.add('hidden');
    placeholder.classList.remove('hidden');
    placeholder.textContent = existing ? initialsOf(existing.name) : '??';
  }

  document.getElementById('companyFormOverlay').classList.remove('hidden');
  lucide.createIcons();
}

function closeCompanyForm(){
  document.getElementById('companyFormOverlay').classList.add('hidden');
  companyFormLogoData = null;
}

function handleLogoFileSelect(e){
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    companyFormLogoData = reader.result;
    document.getElementById('cfLogoUrl').value = '';
    const preview = document.getElementById('companyLogoPreview');
    preview.src = companyFormLogoData;
    preview.classList.remove('hidden');
    document.getElementById('companyLogoPlaceholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function saveCompany(){
  const id = document.getElementById('companyFormId').value;
  const name = document.getElementById('cfName').value.trim();
  if (!name){ toast('Company name is required'); return; }

  const urlVal = document.getElementById('cfLogoUrl').value.trim();
  const existing = id ? AppState.companies.find(c => c.id === id) : null;
  const logoUrl = companyFormLogoData || urlVal || existing?.logoUrl || '';

  const payload = {
    name,
    type: document.getElementById('cfType').value,
    workMode: document.getElementById('cfWorkMode').value,
    location: document.getElementById('cfLocation').value.trim() || 'Unknown',
    coreFocus: document.getElementById('cfFocus').value.trim(),
    averageSalary: Number(document.getElementById('cfSalary').value) || 0,
    workingHours: document.getElementById('cfHours').value.trim(),
    contactNumber: document.getElementById('cfPhone').value.trim(),
    linkedinUrl: document.getElementById('cfLinkedin').value.trim(),
    source: document.getElementById('cfSource').value.trim(),
    logoUrl,
  };

  if (id){
    const idx = AppState.companies.findIndex(c => c.id === id);
    if (idx >= 0){
      AppState.companies[idx] = { ...AppState.companies[idx], ...payload };
      toast('Company updated');
    }
  } else {
    const newId = uid('CMP');
    AppState.companies.push({ id: newId, ...payload });
    const createdAt = new Date().toISOString();
    AppState.applications.push({
      id: uid('APP'),
      companyId: newId,
      currentStage: 1,
      createdAt,
      updatedAt: createdAt,
      timeline: [{ stage: 1, timestamp: createdAt, notes: 'Company added manually.' }],
      stageData: { 1: { channel: 'LinkedIn', vacancyFound: false, resumeSent: false, date: createdAt }, 2: null, 3: null, 4: null, 5: null }
    });
    toast('Company added');
  }

  AppState.persist();
  closeCompanyForm();
  renderSidebarCounts();
  document.getElementById('uploadEmptyNotice').classList.add('hidden');

  if (AppState.currentView === 'companies') renderCompanies();
  if (AppState.currentView === 'directory') renderDirectory();
  if (AppState.currentView === 'dashboard') renderDashboard();
  if (AppState.currentView === 'kanban') renderKanban();
  if (AppState.currentView === 'profile' && AppState.activeCompanyId === (id || AppState.activeCompanyId)) renderProfile();
}

function deleteCompany(id){
  if (!confirm('Delete this company and all its application data? This cannot be undone.')) return;
  AppState.companies = AppState.companies.filter(c => c.id !== id);
  AppState.applications = AppState.applications.filter(a => a.companyId !== id);
  AppState.persist();
  toast('Company deleted');
  renderSidebarCounts();

  if (AppState.currentView === 'companies') renderCompanies();
  if (AppState.currentView === 'directory') renderDirectory();
  if (AppState.currentView === 'dashboard') renderDashboard();
  if (AppState.currentView === 'kanban') renderKanban();
  if (AppState.currentView === 'profile' && AppState.activeCompanyId === id) switchView(AppState.profileFromView || 'companies');
}


/* ============================================================
   COMPANY PROFILE — FULL PAGE VIEW
   ============================================================ */
function openCompanyProfile(companyId, fromView){
  AppState.activeCompanyId = companyId;
  AppState.activeTab = 'meta';
  AppState.profileFromView = fromView || (AppState.currentView !== 'profile' ? AppState.currentView : AppState.profileFromView) || 'companies';
  switchView('profile');
}

function closeCompanyProfile(){
  switchView(AppState.profileFromView || 'companies');
}

function initialsOf(name){
  return (name || '').split(' ').filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '??';
}

function renderProfile(){
  const company = AppState.companies.find(c => c.id === AppState.activeCompanyId);
  if (!company){ switchView('companies'); return; }
  const app = AppState.getApplicationForCompany(company.id);
  const stage = STAGES.find(s => s.id === app.currentStage);

  document.getElementById('modalCompanyName').textContent = company.name;
  document.getElementById('modalCompanyId').textContent = `#${company.id}`;
  document.getElementById('modalStageTag').textContent = `[${stage.tag}]`;

  // Logo
  const logo = document.getElementById('modalCompanyLogo');
  const logoPlaceholder = document.getElementById('modalCompanyLogoPlaceholder');
  if (company.logoUrl){
    logo.src = company.logoUrl;
    logo.classList.remove('hidden');
    logoPlaceholder.classList.add('hidden');
  } else {
    logo.classList.add('hidden');
    logoPlaceholder.classList.remove('hidden');
    logoPlaceholder.textContent = initialsOf(company.name);
  }

  // Offer banner
  const banner = document.getElementById('modalOfferBanner');
  if (app.currentStage >= 4 && app.stageData[4]?.status === 'Pass'){
    banner.classList.remove('hidden');
    document.getElementById('bannerRole').textContent = app.stageData[4].offerRole || '—';
    document.getElementById('bannerSalary').textContent = formatCurrency(app.stageData[4].baseSalary);
    document.getElementById('bannerBond').textContent = app.stageData[4].bondDurationMonths ? `${app.stageData[4].bondDurationMonths} months` : 'None';
  } else {
    banner.classList.add('hidden');
  }

  // Metadata — 3 columns with work mode & hours
  document.getElementById('metaType').textContent = company.type;
  document.getElementById('metaLocation').textContent = company.location;
  document.getElementById('metaFocus').textContent = company.coreFocus || '—';
  document.getElementById('metaSalary').textContent = formatCurrency(company.averageSalary);
  document.getElementById('metaWorkMode').textContent = company.workMode || '—';
  document.getElementById('metaWorkingHours').textContent = company.workingHours || '—';
  document.getElementById('metaSource').textContent = company.source || '—';
  const phoneEl = document.getElementById('metaPhone');
  phoneEl.href = company.contactNumber ? `tel:${company.contactNumber.replace(/\s+/g,'')}` : '#';
  phoneEl.innerHTML = `<i data-lucide="phone"></i> ${escapeHtml(company.contactNumber || '—')}`;
  const liEl = document.getElementById('metaLinkedin');
  liEl.href = company.linkedinUrl || '#';

  renderStepper(app);
  renderStageForm(app);
  renderTimeline(app);
  setActiveTab(AppState.activeTab);
  lucide.createIcons();
}

function setActiveTab(tab){
  AppState.activeTab = tab;
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('.modal-tab-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
}

function renderStepper(app){
  const container = document.getElementById('stepperContainer');
  container.innerHTML = STAGES.map(s => {
    const cls = s.id < app.currentStage ? 'done' : (s.id === app.currentStage ? 'current' : '');
    return `
      <div class="step-item ${cls}" data-stage="${s.id}">
        <div class="step-circle">${s.id < app.currentStage ? '✓' : s.id}</div>
        <span class="step-label">${s.label.split(' ')[0]}</span>
      </div>
    `;
  }).join('');
  container.querySelectorAll('.step-item').forEach(el => {
    el.addEventListener('click', () => {
      AppState.viewingStage = Number(el.dataset.stage);
      renderStageForm(app, AppState.viewingStage);
    });
  });
}

function renderStageForm(app, viewStage){
  const stageId = viewStage || app.currentStage;
  const container = document.getElementById('stageFormContainer');
  const data = app.stageData[stageId] || {};

  let html = '';
  if (stageId === 1){
    html = `
      <div class="form-row"><label>Channel</label>
        <select id="f_channel">
          ${['LinkedIn','Call','Walk-In/Connection'].map(c => `<option value="${c}" ${data.channel===c?'selected':''}>${c}</option>`).join('')}
        </select>
      </div>
      <div class="checkbox-row"><input type="checkbox" id="f_vacancy" ${data.vacancyFound?'checked':''} /><label for="f_vacancy">Vacancy confirmed</label></div>
      <div class="checkbox-row"><input type="checkbox" id="f_resume" ${data.resumeSent?'checked':''} /><label for="f_resume">Resume sent</label></div>
    `;
  } else if (stageId === 2){
    html = `
      <div class="form-row"><label>Follow-up Date</label><input type="date" id="f_followupDate" value="${data.followUpDate || ''}" /></div>
      <div class="form-row"><label>Status</label>
        <select id="f_followupStatus">
          ${['Pending','No Response','Moving Forward','Closed'].map(s => `<option value="${s}" ${data.status===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    `;
  } else if (stageId === 3){
    const rounds = data.rounds && data.rounds.length ? data.rounds : [{ roundNumber:1, type:'', location:'', dateTime:'' }];
    html = `<div id="roundsList">` + rounds.map((r,idx) => `
      <div class="round-block" data-idx="${idx}">
        <div class="form-row"><label>Round ${idx+1} Type</label><input type="text" class="r_type" value="${escapeHtml(r.type||'')}" placeholder="e.g. Technical Screen" /></div>
        <div class="form-row"><label>Location</label><input type="text" class="r_location" value="${escapeHtml(r.location||'')}" placeholder="Office / Google Meet" /></div>
        <div class="form-row"><label>Date & Time</label><input type="datetime-local" class="r_datetime" value="${r.dateTime ? new Date(r.dateTime).toISOString().slice(0,16) : ''}" /></div>
      </div>
    `).join('') + `</div><button type="button" class="btn-secondary" id="addRoundBtn"><i data-lucide="plus"></i> Add Round</button>`;
  } else if (stageId === 4){
    html = `
      <div class="form-row"><label>Result</label>
        <select id="f_status">
          <option value="Pass" ${data.status==='Pass'?'selected':''}>Pass</option>
          <option value="Fail" ${data.status==='Fail'?'selected':''}>Fail</option>
        </select>
      </div>
      <div class="form-row"><label>Failure Reason (if any)</label><input type="text" id="f_failReason" value="${escapeHtml(data.failureReason||'')}" /></div>
      <div class="form-row"><label>Offer Role</label><input type="text" id="f_offerRole" value="${escapeHtml(data.offerRole||'')}" /></div>
      <div class="form-row"><label>Base Salary (₹)</label><input type="number" id="f_baseSalary" value="${data.baseSalary||''}" /></div>
      <div class="form-row"><label>Bond Duration (months)</label><input type="number" id="f_bondMonths" value="${data.bondDurationMonths||''}" /></div>
    `;
  } else if (stageId === 5){
    html = `
      <div class="form-row"><label>Final Rank</label><input type="number" id="f_rank" value="${data.finalRank||''}" min="1" /></div>
      <div class="form-row"><label>Acceptance Status</label>
        <select id="f_acceptance">
          ${['Selected','Rejected','Pending'].map(s => `<option value="${s}" ${data.acceptanceStatus===s?'selected':''}>${s}</option>`).join('')}
        </select>
      </div>
    `;
  }

  html += `
    <div class="form-row"><label>Notes for timeline</label><textarea id="f_notes" placeholder="What happened at this stage?"></textarea></div>
    <div class="form-actions">
      <button class="btn-secondary" id="saveStageOnlyBtn">Save Stage Data</button>
      <button class="btn-primary" id="advanceStageBtn">${stageId < 5 ? 'Save & Advance →' : 'Save'}</button>
    </div>
  `;
  container.innerHTML = html;

  if (stageId === 3){
    document.getElementById('addRoundBtn')?.addEventListener('click', () => {
      const list = document.getElementById('roundsList');
      const idx = list.children.length;
      const block = document.createElement('div');
      block.className = 'round-block';
      block.dataset.idx = idx;
      block.innerHTML = `
        <div class="form-row"><label>Round ${idx+1} Type</label><input type="text" class="r_type" placeholder="e.g. Technical Screen" /></div>
        <div class="form-row"><label>Location</label><input type="text" class="r_location" placeholder="Office / Google Meet" /></div>
        <div class="form-row"><label>Date & Time</label><input type="datetime-local" class="r_datetime" /></div>
      `;
      list.appendChild(block);
    });
  }

  document.getElementById('saveStageOnlyBtn').addEventListener('click', () => commitStage(app, stageId, false));
  document.getElementById('advanceStageBtn').addEventListener('click', () => commitStage(app, stageId, true));
  lucide.createIcons();
}

function commitStage(app, stageId, advance){
  let notes = document.getElementById('f_notes').value.trim();

  if (stageId === 1){
    app.stageData[1] = {
      channel: document.getElementById('f_channel').value,
      vacancyFound: document.getElementById('f_vacancy').checked,
      resumeSent: document.getElementById('f_resume').checked,
      date: app.stageData[1]?.date || new Date().toISOString(),
    };
    if (!notes) notes = `Outreach updated via ${app.stageData[1].channel}.`;
  } else if (stageId === 2){
    app.stageData[2] = {
      followUpDate: document.getElementById('f_followupDate').value,
      status: document.getElementById('f_followupStatus').value,
    };
    if (!notes) notes = `Follow-up status: ${app.stageData[2].status}.`;
  } else if (stageId === 3){
    const rounds = [...document.querySelectorAll('.round-block')].map((block, idx) => ({
      roundNumber: idx + 1,
      type: block.querySelector('.r_type').value,
      location: block.querySelector('.r_location').value,
      dateTime: block.querySelector('.r_datetime').value ? new Date(block.querySelector('.r_datetime').value).toISOString() : null,
    }));
    app.stageData[3] = { rounds };
    if (!notes) notes = `${rounds.length} interview round(s) scheduled.`;
  } else if (stageId === 4){
    app.stageData[4] = {
      status: document.getElementById('f_status').value,
      failureReason: document.getElementById('f_failReason').value,
      offerRole: document.getElementById('f_offerRole').value,
      baseSalary: Number(document.getElementById('f_baseSalary').value) || 0,
      bondDurationMonths: Number(document.getElementById('f_bondMonths').value) || 0,
    };
    if (!notes) notes = `Interview result: ${app.stageData[4].status}.`;
  } else if (stageId === 5){
    app.stageData[5] = {
      finalRank: Number(document.getElementById('f_rank').value) || null,
      acceptanceStatus: document.getElementById('f_acceptance').value,
    };
    if (!notes) notes = `Offer comparison updated: ${app.stageData[5].acceptanceStatus}.`;
  }

  const now = new Date().toISOString();
  app.updatedAt = now;
  app.timeline.push({ stage: stageId, timestamp: now, notes });

  if (advance && stageId < 5 && stageId === app.currentStage){
    app.currentStage = stageId + 1;
  } else if (stageId > app.currentStage){
    app.currentStage = stageId;
  }

  AppState.persist();
  toast('Stage updated');
  renderProfile();
  if (AppState.currentView === 'kanban') renderKanban();
  if (AppState.currentView === 'directory') renderDirectory();
  if (AppState.currentView === 'companies') renderCompanies();
  if (AppState.currentView === 'dashboard') renderDashboard();
  renderSidebarCounts();
  setActiveTab('timeline');
}

function renderTimeline(app){
  const log = document.getElementById('timelineLog');
  if (!app.timeline.length){
    log.innerHTML = `<div class="timeline-empty">No activity yet.</div>`;
    return;
  }
  const sorted = [...app.timeline].sort((a,b) => new Date(b.timestamp) - new Date(a.timestamp));
  log.innerHTML = sorted.map(entry => {
    const stage = STAGES.find(s => s.id === entry.stage);
    return `
      <div class="timeline-entry">
        <div class="timeline-entry-time">${formatDateTime(entry.timestamp)}</div>
        <div class="timeline-entry-title">[${stage?.tag || entry.stage}]</div>
        <div class="timeline-entry-notes">${escapeHtml(entry.notes)}</div>
      </div>
    `;
  }).join('');
}


/* ============================================================
   RENDER: Q&A BANK
   ============================================================ */
function renderQA(){
  const { search, tag } = AppState.qaFilter;
  let items = AppState.qa;
  if (search){
    const s = search.toLowerCase();
    items = items.filter(q => q.question.toLowerCase().includes(s) || q.answer.toLowerCase().includes(s) || q.tags.some(t => t.toLowerCase().includes(s)));
  }
  if (tag !== 'all'){
    items = items.filter(q => q.tags.includes(tag));
  }

  // Populate tag filter
  const tagSel = document.getElementById('qaTagFilter');
  const currentTag = tagSel?.value || 'all';
  if (tagSel){
    tagSel.innerHTML = '<option value="all">All Tags</option>' +
      AppState.qaTags.map(t => `<option value="${escapeHtml(t)}">${escapeHtml(t)}</option>`).join('');
    tagSel.value = currentTag;
  }

  const grid = document.getElementById('qaGrid');
  if (!items.length){
    grid.innerHTML = `
      <div class="empty-state" style="grid-column: 1 / -1;">
        <i data-lucide="book-open" class="empty-state-icon"></i>
        <h2>No questions yet</h2>
        <p>Add your first interview question to start building your prep library.</p>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  grid.innerHTML = items.map(q => `
    <div class="qa-card" data-id="${q.id}">
      <div class="qa-card-header">
        <div class="qa-card-tags">
          ${q.tags.map(t => `<span class="qa-tag">${escapeHtml(t)}</span>`).join('')}
        </div>
        <div class="qa-card-actions">
          <button class="icon-btn qa-edit-btn" data-id="${q.id}" aria-label="Edit"><i data-lucide="pencil"></i></button>
          <button class="icon-btn qa-del-btn" data-id="${q.id}" aria-label="Delete"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <div class="qa-question">${escapeHtml(q.question)}</div>
      <div class="qa-answer">${escapeHtml(q.answer)}</div>
    </div>
  `).join('');

  grid.querySelectorAll('.qa-edit-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openQAForm(btn.dataset.id); });
  });
  grid.querySelectorAll('.qa-del-btn').forEach(btn => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); deleteQA(btn.dataset.id); });
  });

  lucide.createIcons();
}

function openQAForm(id){
  const existing = id ? AppState.qa.find(q => q.id === id) : null;
  document.getElementById('qaFormTitle').textContent = existing ? 'Edit Question' : 'Add Question';
  document.getElementById('qaFormId').value = existing?.id || '';
  document.getElementById('qaFormQuestion').value = existing?.question || '';
  document.getElementById('qaFormAnswer').value = existing?.answer || '';
  document.getElementById('qaFormTags').value = existing?.tags?.join(', ') || '';
  document.getElementById('qaFormOverlay').classList.remove('hidden');
  document.getElementById('qaFormQuestion').focus();
}

function closeQAForm(){
  document.getElementById('qaFormOverlay').classList.add('hidden');
}

function saveQA(){
  const id = document.getElementById('qaFormId').value;
  const question = document.getElementById('qaFormQuestion').value.trim();
  const answer = document.getElementById('qaFormAnswer').value.trim();
  const tags = document.getElementById('qaFormTags').value.split(',').map(t => t.trim()).filter(Boolean);

  if (!question) { toast('Question is required'); return; }

  if (id){
    const idx = AppState.qa.findIndex(q => q.id === id);
    if (idx >= 0){
      AppState.qa[idx] = { ...AppState.qa[idx], question, answer, tags, updatedAt: new Date().toISOString() };
      toast('Question updated');
    }
  } else {
    AppState.qa.push({
      id: uid('QA'),
      question,
      answer,
      tags,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    toast('Question added');
  }

  AppState.persist();
  closeQAForm();
  renderQA();
  if (AppState.currentView !== 'qa') renderSidebarCounts();
}

function deleteQA(id){
  if (!confirm('Delete this question?')) return;
  AppState.qa = AppState.qa.filter(q => q.id !== id);
  AppState.persist();
  toast('Question deleted');
  renderQA();
}


/* ============================================================
   THEME + COLOR PICKER + SIDEBAR
   ============================================================ */
function applyAccent(color){
  if (color){
    document.documentElement.style.setProperty('--user-accent', color);
  } else {
    document.documentElement.style.removeProperty('--user-accent');
  }
}

function applyTheme(theme){
  document.documentElement.classList.toggle('light', theme === 'light');
  DataRepository.saveTheme(theme);
  if (AppState.currentView === 'dashboard') renderDashboard();
}

function toggleTheme(){
  const isLight = document.documentElement.classList.contains('light');
  applyTheme(isLight ? 'dark' : 'light');
}

function toggleSidebarCollapse(){
  const sidebar = document.getElementById('sidebar');
  const collapsed = sidebar.classList.toggle('collapsed');
  DataRepository.saveSidebarCollapsed(collapsed);
}

function openMobileSidebar(){
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('sidebarOverlay').classList.add('open');
}
function closeMobileSidebar(){
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ============================================================
   INIT + EVENT WIRING
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  AppState.init();

  // Theme & accent
  applyTheme(DataRepository.getTheme());
  const savedAccent = DataRepository.getAccent();
  if (savedAccent){
    applyAccent(savedAccent);
    document.getElementById('accentPicker').value = savedAccent;
  }
  if (DataRepository.getSidebarCollapsed()) document.getElementById('sidebar').classList.add('collapsed');

  renderSidebarCounts();

  // If no data, go straight to upload view
  if (!AppState.hasData){
    switchView('upload');
    document.getElementById('uploadEmptyNotice').classList.remove('hidden');
  } else {
    switchView('dashboard');
    document.getElementById('uploadEmptyNotice').classList.add('hidden');
  }

  lucide.createIcons();

  // Nav
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  // Theme toggles
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);

  // Color picker
  document.getElementById('accentPicker').addEventListener('input', (e) => {
    applyAccent(e.target.value);
    DataRepository.saveAccent(e.target.value);
  });

  // Sidebar collapse / mobile drawer
  document.getElementById('collapseBtn').addEventListener('click', toggleSidebarCollapse);
  document.getElementById('burgerBtn').addEventListener('click', openMobileSidebar);
  document.getElementById('closeSidebarBtn').addEventListener('click', closeMobileSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click', closeMobileSidebar);

  // Global + directory search
  const applyGlobalSearch = debounce((val) => {
    AppState.directory.search = val; AppState.directory.page = 1;
    if (AppState.currentView !== 'directory') switchView('directory');
    else renderDirectory();
  }, 200);
  document.getElementById('globalSearch').addEventListener('input', (e) => applyGlobalSearch(e.target.value));
  document.getElementById('directorySearch').addEventListener('input', debounce((e) => {
    AppState.directory.search = e.target.value; AppState.directory.page = 1; renderDirectory();
  }, 200));

  // Directory filters
  document.getElementById('filterType').addEventListener('change', (e) => { AppState.directory.type = e.target.value; AppState.directory.page = 1; renderDirectory(); });
  document.getElementById('filterLocation').addEventListener('change', (e) => { AppState.directory.location = e.target.value; AppState.directory.page = 1; renderDirectory(); });
  document.getElementById('filterStage').addEventListener('change', (e) => { AppState.directory.stage = e.target.value; AppState.directory.page = 1; renderDirectory(); });

  // Companies filters
  document.getElementById('companiesSearch').addEventListener('input', debounce((e) => { AppState.companiesFilter.search = e.target.value; renderCompanies(); }, 200));
  document.getElementById('companiesFilterType').addEventListener('change', (e) => { AppState.companiesFilter.type = e.target.value; renderCompanies(); });
  document.getElementById('companiesFilterLocation').addEventListener('change', (e) => { AppState.companiesFilter.location = e.target.value; renderCompanies(); });
  document.getElementById('companiesFilterSource').addEventListener('change', (e) => { AppState.companiesFilter.source = e.target.value; renderCompanies(); });

  // Companies sort
  document.querySelectorAll('.sort-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const field = btn.dataset.sort;
      if (AppState.sort.field === field) AppState.sort.dir = AppState.sort.dir === 'asc' ? 'desc' : 'asc';
      else { AppState.sort.field = field; AppState.sort.dir = 'asc'; }
      DataRepository.saveSort(AppState.sort);
      renderCompanies();
    });
  });
  document.getElementById('addCompanyBtn').addEventListener('click', () => openCompanyForm());

  // Kanban channel pills
  document.querySelectorAll('#channelFilterPills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#channelFilterPills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.kanbanChannelFilter = pill.dataset.channel;
      renderKanban();
    });
  });

  // Company Profile (full page)
  document.getElementById('profileBackBtn').addEventListener('click', closeCompanyProfile);
  document.getElementById('profileEditBtn').addEventListener('click', () => openCompanyForm(AppState.activeCompanyId));
  document.getElementById('profileDeleteBtn').addEventListener('click', () => deleteCompany(AppState.activeCompanyId));
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

  // Company Form Modal
  document.getElementById('companyFormClose').addEventListener('click', closeCompanyForm);
  document.getElementById('companyFormClose2').addEventListener('click', closeCompanyForm);
  document.getElementById('companyFormOverlay').addEventListener('click', (e) => { if (e.target.id === 'companyFormOverlay') closeCompanyForm(); });
  document.getElementById('companyFormSave').addEventListener('click', saveCompany);
  document.getElementById('cfLogoFile').addEventListener('change', handleLogoFileSelect);
  document.getElementById('cfLogoUrl').addEventListener('input', () => {
    const url = document.getElementById('cfLogoUrl').value.trim();
    if (url){
      companyFormLogoData = null;
      document.getElementById('cfLogoFile').value = '';
      document.getElementById('companyLogoPreview').src = url;
      document.getElementById('companyLogoPreview').classList.remove('hidden');
      document.getElementById('companyLogoPlaceholder').classList.add('hidden');
    }
  });

  // Q&A
  document.getElementById('addQABtn').addEventListener('click', () => openQAForm());
  document.getElementById('qaFormClose').addEventListener('click', closeQAForm);
  document.getElementById('qaFormClose2').addEventListener('click', closeQAForm);
  document.getElementById('qaFormOverlay').addEventListener('click', (e) => { if (e.target.id === 'qaFormOverlay') closeQAForm(); });
  document.getElementById('qaFormSave').addEventListener('click', saveQA);
  document.getElementById('qaSearch').addEventListener('input', debounce((e) => {
    AppState.qaFilter.search = e.target.value; renderQA();
  }, 200));
  document.getElementById('qaTagFilter').addEventListener('change', (e) => {
    AppState.qaFilter.tag = e.target.value; renderQA();
  });

  // Upload / drag-drop CSV
  const dropZone = document.getElementById('dropZone');
  const csvInput = document.getElementById('csvFileInput');
  dropZone.addEventListener('click', () => csvInput.click());
  dropZone.addEventListener('dragover', (e) => { e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault(); dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) handleCSVFile(file);
  });
  csvInput.addEventListener('change', (e) => { if (e.target.files[0]) handleCSVFile(e.target.files[0]); });

  function handleCSVFile(file){
    if (!file.name.toLowerCase().endsWith('.csv')){ logUpload(`Rejected "${file.name}" — not a .csv file.`); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const rows = parseCSV(reader.result);
      const { added, updated } = importCSVRows(rows);
      logUpload(`Imported "${file.name}": ${added} added, ${updated} updated.`);
      toast(`CSV imported: ${added} added, ${updated} updated`);
      renderSidebarCounts();
      document.getElementById('uploadEmptyNotice').classList.add('hidden');
      if (AppState.currentView === 'dashboard') renderDashboard();
      if (AppState.currentView === 'directory') renderDirectory();
      if (AppState.currentView === 'kanban') renderKanban();
      if (AppState.currentView === 'companies') renderCompanies();
    };
    reader.readAsText(file);
  }

  document.getElementById('downloadTemplateBtn').addEventListener('click', (e) => { e.stopPropagation(); exportSampleTemplate(); });

  // Export / Import
  document.getElementById('exportBtnTop').addEventListener('click', exportFullJSON);
  document.getElementById('exportJsonBtn').addEventListener('click', exportFullJSON);
  document.getElementById('exportCsvBtn').addEventListener('click', exportCSV);

  const jsonInput = document.getElementById('jsonFileInput');
  document.getElementById('importJsonBtn').addEventListener('click', () => jsonInput.click());
  jsonInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        if (!data.companies || !Array.isArray(data.companies)) throw new Error('Invalid schema — missing companies array');
        DataRepository.importAll(data);
        AppState.init();
        renderSidebarCounts();
        switchView('dashboard');
        logUpload(`Imported full backup: ${data.companies.length} companies, ${data.applications?.length || 0} applications, ${data.qa?.length || 0} Q&A items.`);
        toast('Full backup restored successfully');
        document.getElementById('uploadEmptyNotice').classList.add('hidden');
      } catch (err){
        logUpload(`Failed to import JSON: ${err.message}`);
        toast('Import failed — invalid JSON backup');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (!confirm('This clears ALL locally stored data (companies, applications, Q&A). This cannot be undone. Continue?')) return;
    DataRepository.clearAll();
    AppState.init();
    renderSidebarCounts();
    switchView('upload');
    document.getElementById('uploadEmptyNotice').classList.remove('hidden');
    logUpload('All local data cleared.');
    toast('All data cleared');
  });
});
