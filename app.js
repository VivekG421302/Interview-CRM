/**
 * app.js — Pipeline CRM
 * ------------------------------------------------------------
 * Central state object (AppState) + a Repository pattern
 * (DataRepository) that currently persists to localStorage but
 * is the single seam where a future MongoDB/Node.js backend
 * would be wired in (see config.js -> BACKEND_CONFIG).
 * ------------------------------------------------------------
 */

/* ============================================================
   REPOSITORY (swap-friendly data layer)
   ============================================================ */
const DataRepository = {
  getCompanies(){
    const raw = localStorage.getItem(STORAGE_KEYS.companies);
    return raw ? JSON.parse(raw) : [];
  },
  saveCompanies(companies){
    localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(companies));
    if (BACKEND_CONFIG.enabled) this._remoteSync('companies', companies);
  },
  getApplications(){
    const raw = localStorage.getItem(STORAGE_KEYS.applications);
    return raw ? JSON.parse(raw) : [];
  },
  saveApplications(applications){
    localStorage.setItem(STORAGE_KEYS.applications, JSON.stringify(applications));
    if (BACKEND_CONFIG.enabled) this._remoteSync('applications', applications);
  },
  getTheme(){ return localStorage.getItem(STORAGE_KEYS.theme) || 'dark'; },
  saveTheme(theme){ localStorage.setItem(STORAGE_KEYS.theme, theme); },
  getSidebarCollapsed(){ return localStorage.getItem(STORAGE_KEYS.sidebar) === 'true'; },
  saveSidebarCollapsed(val){ localStorage.setItem(STORAGE_KEYS.sidebar, String(val)); },
  clearAll(){
    localStorage.removeItem(STORAGE_KEYS.companies);
    localStorage.removeItem(STORAGE_KEYS.applications);
  },
  // Placeholder — implement when BACKEND_CONFIG.enabled = true
  _remoteSync(resource, payload){
    // fetch(`${BACKEND_CONFIG.baseUrl}${BACKEND_CONFIG.endpoints[resource]}`, {
    //   method: 'POST', headers: { 'Content-Type': 'application/json', ...BACKEND_CONFIG.authHeader },
    //   body: JSON.stringify(payload)
    // });
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
   SEED DATA GENERATOR (first run only)
   ============================================================ */
function generateSeedData(){
  const prefixes = ['Nova','Bright','Quantum','Silver','Delta','Vertex','Crimson','Orbit','Nimbus','Pixel','Atlas','Cobalt','Fusion','Ionic','Lumen','Meridian','Nexus','Orion','Prism','Rune','Solace','Tessellate','Umbra','Vantage','Wavefront','Xenon','Yieldstone','Zenith','Argon','Bastion','Circuit','Drift','Ember','Forge','Glide','Helix','Indigo','Juno','Kernel','Latch','Mosaic','Nebula','Onyx','Pulse','Quartz','Ridge','Sable','Talon','Utopia','Vector','Willow'];
  const suffixes = ['Systems','Tech','Softworks','Labs','Solutions','Dynamics','Logic','Cloud','Data','Networks','Digital','Innovations','Analytics','Platforms','Infotech','Technologies','Software','Global','Consulting','Robotics'];
  const legal = ['Pvt Ltd','Technologies Pvt Ltd','Inc.','Solutions Ltd','Labs Pvt Ltd',''];
  const locations = ['Bengaluru','Pune','Hyderabad','Chennai','Mumbai','Gurugram','Noida','Remote','Kolkata','Ahmedabad','Coimbatore','Indore'];
  const focuses = ['FinTech Payments','E-commerce Platform','Healthcare SaaS','Enterprise ERP','Cloud Infrastructure','EdTech LMS','Logistics & Supply Chain','Cybersecurity','AdTech Analytics','Insurance Tech','Travel Booking Engine','B2B Marketplace','IoT Device Management','Telecom OSS/BSS','AgriTech','Digital Banking Core','HRTech Platform','Media Streaming','Gaming Backend','Real Estate PropTech'];
  const channels = ['LinkedIn','Call','Walk-In/Connection'];
  const failReasons = ['Java core concepts gap','System design round mismatch','Salary expectation mismatch','Position closed internally','Culture fit concerns','Notice period too long'];
  const roles = ['Java Backend Developer','SDE II (Java)','Senior Java Engineer','Java Microservices Developer','Full Stack Java Developer','Java Spring Boot Engineer'];

  const companies = [];
  const applications = [];
  const now = Date.now();

  for (let i = 1; i <= 560; i++){
    const name = `${prefixes[i % prefixes.length]}${suffixes[(i * 7) % suffixes.length]} ${legal[i % legal.length]}`.trim();
    const type = (i % 3 === 0) ? 'Product' : 'Service';
    const location = locations[(i * 3) % locations.length];
    const coreFocus = focuses[(i * 5) % focuses.length];
    const averageSalary = 600000 + ((i * 37) % 22) * 50000;
    const company = {
      id: `CMP-${pad4(i)}`,
      name,
      type,
      location,
      coreFocus,
      averageSalary,
      contactNumber: `+91 ${9000000000 + (i * 12347) % 999999999 % 1000000000}`.slice(0, 14),
      linkedinUrl: `https://linkedin.com/company/${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g,'')}`,
    };
    companies.push(company);

    // Weighted funnel distribution
    const r = (i * 97) % 100;
    let stage = 1;
    if (r < 42) stage = 1;
    else if (r < 68) stage = 2;
    else if (r < 84) stage = 3;
    else if (r < 94) stage = 4;
    else stage = 5;

    const createdAt = new Date(now - ((i * 53) % 60) * 86400000).toISOString();
    const channel = channels[i % channels.length];

    const app = {
      id: uid('APP'),
      companyId: company.id,
      currentStage: stage,
      createdAt,
      updatedAt: createdAt,
      timeline: [{ stage: 1, timestamp: createdAt, notes: `Outreach initiated via ${channel}.` }],
      stageData: {
        1: { channel, vacancyFound: true, resumeSent: true, date: createdAt },
        2: null, 3: null, 4: null, 5: null,
      }
    };

    if (stage >= 2){
      const fu = new Date(new Date(createdAt).getTime() + 4 * 86400000);
      const overdue = (i % 5 === 0);
      app.stageData[2] = {
        followUpDate: overdue ? new Date(now - 2 * 86400000).toISOString().slice(0,10) : new Date(now + 3 * 86400000).toISOString().slice(0,10),
        status: overdue ? 'Pending' : (i % 4 === 0 ? 'No Response' : 'Moving Forward'),
      };
      app.timeline.push({ stage: 2, timestamp: fu.toISOString(), notes: 'Follow-up logged.' });
    }
    if (stage >= 3){
      app.stageData[3] = {
        rounds: [
          { roundNumber: 1, type: 'Technical Screen', location: i % 2 === 0 ? 'Google Meet' : 'Office - ' + location, dateTime: new Date(now + (i % 10) * 86400000).toISOString() },
        ]
      };
      app.timeline.push({ stage: 3, timestamp: new Date(new Date(createdAt).getTime() + 8*86400000).toISOString(), notes: 'Round 1 scheduled.' });
    }
    if (stage >= 4){
      const pass = i % 3 !== 0;
      app.stageData[4] = {
        status: pass ? 'Pass' : 'Fail',
        failureReason: pass ? '' : failReasons[i % failReasons.length],
        offerRole: pass ? roles[i % roles.length] : '',
        baseSalary: pass ? averageSalary + ((i % 6) * 75000) : 0,
        bondDurationMonths: pass ? [0,6,12,18,24][i % 5] : 0,
      };
      app.timeline.push({ stage: 4, timestamp: new Date(new Date(createdAt).getTime() + 14*86400000).toISOString(), notes: pass ? 'Cleared final interview round.' : `Not selected — ${app.stageData[4].failureReason}` });
    }
    if (stage >= 5){
      app.stageData[5] = {
        finalRank: (i % 5) + 1,
        acceptanceStatus: i % 4 === 0 ? 'Selected' : (i % 4 === 1 ? 'Rejected' : 'Pending'),
      };
      app.timeline.push({ stage: 5, timestamp: new Date(new Date(createdAt).getTime() + 18*86400000).toISOString(), notes: 'Added to offer comparison matrix.' });
    }
    app.updatedAt = app.timeline[app.timeline.length - 1].timestamp;
    applications.push(app);
  }

  return { companies, applications };
}

/* ============================================================
   APP STATE
   ============================================================ */
const AppState = {
  companies: [],
  applications: [],
  currentView: 'dashboard',
  kanbanChannelFilter: 'all',
  directory: { search: '', type: 'all', location: 'all', stage: 'all', page: 1, pageSize: 12 },
  activeCompanyId: null,
  activeTab: 'meta',
  charts: {},

  init(){
    let companies = DataRepository.getCompanies();
    let applications = DataRepository.getApplications();
    if (!companies.length){
      const seed = generateSeedData();
      companies = seed.companies;
      applications = seed.applications;
      DataRepository.saveCompanies(companies);
      DataRepository.saveApplications(applications);
    }
    this.companies = companies;
    this.applications = applications;
  },

  persist(){
    DataRepository.saveCompanies(this.companies);
    DataRepository.saveApplications(this.applications);
  },

  getApplicationForCompany(companyId){
    const apps = this.applications.filter(a => a.companyId === companyId);
    return apps.length ? apps[apps.length - 1] : null;
  },

  get uniqueLocations(){
    return [...new Set(this.companies.map(c => c.location))].sort();
  }
};

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
    upload: ['Data Sync', 'IMPORT_EXPORT / CSV_JSON'],
  };
  document.getElementById('viewTitle').textContent = titles[view][0];
  document.getElementById('viewSubtitle').textContent = titles[view][1];

  if (view === 'dashboard') renderDashboard();
  if (view === 'kanban') renderKanban();
  if (view === 'directory') renderDirectory();

  // close mobile drawer on nav
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ============================================================
   RENDER: DASHBOARD
   ============================================================ */
function renderDashboard(){
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
      card.addEventListener('click', () => openDetailModal(company.id));
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
    row.addEventListener('click', () => openDetailModal(row.dataset.id));
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
   DETAIL MODAL
   ============================================================ */
function openDetailModal(companyId){
  AppState.activeCompanyId = companyId;
  AppState.activeTab = 'meta';
  renderModal();
  document.getElementById('detailModal').classList.remove('hidden');
}
function closeDetailModal(){
  document.getElementById('detailModal').classList.add('hidden');
  AppState.activeCompanyId = null;
}

function renderModal(){
  const company = AppState.companies.find(c => c.id === AppState.activeCompanyId);
  if (!company) return;
  const app = AppState.getApplicationForCompany(company.id);
  const stage = STAGES.find(s => s.id === app.currentStage);

  document.getElementById('modalCompanyName').textContent = company.name;
  document.getElementById('modalCompanyId').textContent = `#${company.id}`;
  document.getElementById('modalStageTag').textContent = `[${stage.tag}]`;

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

  // Metadata
  document.getElementById('metaType').textContent = company.type;
  document.getElementById('metaLocation').textContent = company.location;
  document.getElementById('metaFocus').textContent = company.coreFocus;
  document.getElementById('metaSalary').textContent = formatCurrency(company.averageSalary);
  const phoneEl = document.getElementById('metaPhone');
  phoneEl.href = `tel:${company.contactNumber.replace(/\s+/g,'')}`;
  phoneEl.innerHTML = `<i data-lucide="phone"></i> ${escapeHtml(company.contactNumber)}`;
  document.getElementById('metaLinkedin').href = company.linkedinUrl;

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
  renderModal();
  if (AppState.currentView === 'kanban') renderKanban();
  if (AppState.currentView === 'directory') renderDirectory();
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
   CSV PARSER (lightweight, inline)
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
      averageSalary: Number((row['Average Salary'] || '0').replace(/[^\d.]/g,'')) || 0,
      contactNumber: row['Contact Number'] || '',
      linkedinUrl: row['Linkedin'] || '',
    };
    const existingIdx = AppState.companies.findIndex(c => c.id === id);
    if (existingIdx >= 0){ AppState.companies[existingIdx] = { ...AppState.companies[existingIdx], ...payload }; updated++; }
    else {
      AppState.companies.push(payload);
      AppState.applications.push({
        id: uid('APP'), companyId: id, currentStage: 1,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        timeline: [{ stage: 1, timestamp: new Date().toISOString(), notes: 'Imported via CSV.' }],
        stageData: { 1: { channel: 'LinkedIn', vacancyFound: false, resumeSent: false, date: new Date().toISOString() }, 2:null,3:null,4:null,5:null }
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
  const header = 'ID,Name,Type,Location,Product / Core Focus,Average Salary,Contact Number,Linkedin';
  const sample = 'CMP-9001,Sample Systems Pvt Ltd,Service,Bengaluru,Enterprise ERP,1200000,+91 9876543210,https://linkedin.com/company/sample-systems';
  downloadFile(`${header}\n${sample}`, 'sample_companies_template.csv', 'text/csv');
}

function exportJSON(){
  const payload = { companies: AppState.companies, applications: AppState.applications, exportedAt: new Date().toISOString() };
  downloadFile(JSON.stringify(payload, null, 2), `pipeline_crm_export_${Date.now()}.json`, 'application/json');
  toast('JSON export downloaded');
}

function exportCSV(){
  const header = 'ID,Name,Type,Location,Product / Core Focus,Average Salary,Contact Number,Linkedin,Current Stage';
  const rows = AppState.companies.map(c => {
    const app = AppState.getApplicationForCompany(c.id);
    return [c.id, `"${c.name.replace(/"/g,'""')}"`, c.type, c.location, `"${c.coreFocus.replace(/"/g,'""')}"`, c.averageSalary, c.contactNumber, c.linkedinUrl, app?.currentStage || 1].join(',');
  });
  downloadFile([header, ...rows].join('\n'), `pipeline_crm_directory_${Date.now()}.csv`, 'text/csv');
  toast('CSV export downloaded');
}

function logUpload(msg){
  const log = document.getElementById('uploadLog');
  const time = new Date().toLocaleTimeString('en-IN');
  log.textContent = `[${time}] ${msg}\n` + log.textContent;
}

/* ============================================================
   THEME + SIDEBAR
   ============================================================ */
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
  applyTheme(DataRepository.getTheme());
  if (DataRepository.getSidebarCollapsed()) document.getElementById('sidebar').classList.add('collapsed');
  renderSidebarCounts();
  switchView('dashboard');
  lucide.createIcons();

  // Nav
  document.querySelectorAll('.nav-item').forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));

  // Theme toggles
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);
  document.getElementById('themeToggleMobile').addEventListener('click', toggleTheme);

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

  // Kanban channel pills
  document.querySelectorAll('#channelFilterPills .pill').forEach(pill => {
    pill.addEventListener('click', () => {
      document.querySelectorAll('#channelFilterPills .pill').forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      AppState.kanbanChannelFilter = pill.dataset.channel;
      renderKanban();
    });
  });

  // Modal
  document.getElementById('closeModalBtn').addEventListener('click', closeDetailModal);
  document.getElementById('detailModal').addEventListener('click', (e) => { if (e.target.id === 'detailModal') closeDetailModal(); });
  document.querySelectorAll('.tab-btn').forEach(btn => btn.addEventListener('click', () => setActiveTab(btn.dataset.tab)));

  // Upload / drag-drop
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
      if (AppState.currentView === 'dashboard') renderDashboard();
      if (AppState.currentView === 'directory') renderDirectory();
      if (AppState.currentView === 'kanban') renderKanban();
    };
    reader.readAsText(file);
  }

  document.getElementById('downloadTemplateBtn').addEventListener('click', (e) => { e.stopPropagation(); exportSampleTemplate(); });

  // Export / Import
  document.getElementById('exportBtnTop').addEventListener('click', exportJSON);
  document.getElementById('exportJsonBtn').addEventListener('click', exportJSON);
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
        if (!Array.isArray(data.companies) || !Array.isArray(data.applications)) throw new Error('Invalid schema');
        AppState.companies = data.companies;
        AppState.applications = data.applications;
        AppState.persist();
        renderSidebarCounts();
        switchView('dashboard');
        logUpload(`Imported JSON state: ${data.companies.length} companies, ${data.applications.length} applications.`);
        toast('State imported successfully');
      } catch (err){
        logUpload(`Failed to import JSON: ${err.message}`);
        toast('Import failed — invalid JSON');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('resetDataBtn').addEventListener('click', () => {
    if (!confirm('This clears all locally stored companies and applications. Continue?')) return;
    DataRepository.clearAll();
    AppState.init();
    renderSidebarCounts();
    switchView('dashboard');
    logUpload('Local data reset — reseeded demo dataset.');
    toast('Data reset');
  });
});
