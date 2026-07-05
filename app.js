/**
 * app.js — Pipeline CRM v3
 * Changes vs v2:
 *  - website + description fields on Company
 *  - Smart chart color palette derived from single accent
 *  - Auto-contrast accent-on text (WCAG luminance)
 *  - CSV import reads Logo URL correctly
 *  - Full offline support (localStorage only, no network needed)
 *  - Responsiveness improvements via JS (dynamic toolbar)
 */

/* ============================================================
   COLOUR UTILITIES — derive full palette from one accent hex
   ============================================================ */
const ColorUtils = {
  /** Parse #rrggbb → [r,g,b] */
  hexToRgb(hex){
    const h = hex.replace('#','');
    const n = parseInt(h.length===3
      ? h.split('').map(c=>c+c).join('') : h, 16);
    return [(n>>16)&255, (n>>8)&255, n&255];
  },

  /** Relative luminance per WCAG 2.1 */
  luminance([r,g,b]){
    const c = [r,g,b].map(v=>{
      const s = v/255;
      return s<=0.03928 ? s/12.92 : ((s+0.055)/1.055)**2.4;
    });
    return 0.2126*c[0]+0.7152*c[1]+0.0722*c[2];
  },

  /** Pick black or white for text on a given bg */
  contrastOn(hex){
    const lum = this.luminance(this.hexToRgb(hex));
    return lum > 0.179 ? '#0D1A18' : '#F0F4F4';
  },

  /** Shift hue by degrees (HSL) */
  shiftHue(hex, deg){
    let [r,g,b] = this.hexToRgb(hex).map(v=>v/255);
    const max=Math.max(r,g,b), min=Math.min(r,g,b), d=max-min;
    let h=0, s=max===0?0:d/max, l=(max+min)/2;
    if(d){
      switch(max){
        case r: h=((g-b)/d)%6; break;
        case g: h=(b-r)/d+2; break;
        case b: h=(r-g)/d+4; break;
      }
      h=Math.round(h*60);
      if(h<0) h+=360;
    }
    h=(h+deg+360)%360;
    // HSL→RGB
    const c=(1-Math.abs(2*l-1))*s, x=c*(1-Math.abs((h/60)%2-1)), m=l-c/2;
    let R,G,B;
    if(h<60){R=c;G=x;B=0;}else if(h<120){R=x;G=c;B=0;}
    else if(h<180){R=0;G=c;B=x;}else if(h<240){R=0;G=x;B=c;}
    else if(h<300){R=x;G=0;B=c;}else{R=c;G=0;B=x;}
    return '#'+[R,G,B].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
  },

  /** Adjust lightness */
  adjustL(hex, delta){
    let [r,g,b] = this.hexToRgb(hex).map(v=>v/255);
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let l=(max+min)/2, s=max===min?0:(max-min)/(1-Math.abs(2*l-1));
    l=Math.min(1,Math.max(0,l+delta));
    const c=(1-Math.abs(2*l-1))*s;
    const h_raw=max===min?0:max===r?(g-b)/(max-min):max===g?(b-r)/(max-min)+2:(r-g)/(max-min)+4;
    const h=((h_raw*60)%360+360)%360;
    const x=c*(1-Math.abs((h/60)%2-1)),m=l-c/2;
    let R,G,B;
    if(h<60){R=c;G=x;B=0;}else if(h<120){R=x;G=c;B=0;}
    else if(h<180){R=0;G=c;B=x;}else if(h<240){R=0;G=x;B=c;}
    else if(h<300){R=x;G=0;B=c;}else{R=c;G=0;B=x;}
    return '#'+[R,G,B].map(v=>Math.round((v+m)*255).toString(16).padStart(2,'0')).join('');
  },

  /** Build full chart palette from accent hex */
  buildPalette(hex){
    const [r,g,b] = this.hexToRgb(hex);
    const a2 = this.shiftHue(hex, 150);   // complementary-ish
    const a3 = this.shiftHue(hex, 220);   // triad
    const a4 = this.shiftHue(hex, 60);    // analogous
    return {
      accent:  hex,
      accent2: a2,
      accent3: a3,
      accent4: a4,
      accentRgb: `${r},${g},${b}`,
      accentDim: `rgba(${r},${g},${b},0.16)`,
      accentMid: `rgba(${r},${g},${b},0.45)`,
      accentOn:  this.contrastOn(hex),
    };
  }
};

/* ============================================================
   REPOSITORY (localStorage)
   ============================================================ */
const DataRepository = {
  getCompanies(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEYS.companies)||'[]'); }catch{ return []; } },
  saveCompanies(d){ localStorage.setItem(STORAGE_KEYS.companies, JSON.stringify(d)); },
  getApplications(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEYS.applications)||'[]'); }catch{ return []; } },
  saveApplications(d){ localStorage.setItem(STORAGE_KEYS.applications, JSON.stringify(d)); },
  getQA(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEYS.qa)||'[]'); }catch{ return []; } },
  saveQA(d){ localStorage.setItem(STORAGE_KEYS.qa, JSON.stringify(d)); },
  getTheme(){ return localStorage.getItem(STORAGE_KEYS.theme)||'dark'; },
  saveTheme(t){ localStorage.setItem(STORAGE_KEYS.theme,t); },
  getAccent(){ return localStorage.getItem(STORAGE_KEYS.accent)||null; },
  saveAccent(c){ localStorage.setItem(STORAGE_KEYS.accent,c); },
  getSidebarCollapsed(){ return localStorage.getItem(STORAGE_KEYS.sidebar)==='true'; },
  saveSidebarCollapsed(v){ localStorage.setItem(STORAGE_KEYS.sidebar,String(v)); },
  getHasData(){ return localStorage.getItem(STORAGE_KEYS.hasData)==='true'; },
  setHasData(v){ localStorage.setItem(STORAGE_KEYS.hasData,String(v)); },
  getSort(){ try{ return JSON.parse(localStorage.getItem(STORAGE_KEYS.sort)||'null')||{field:'name',dir:'asc'}; }catch{ return {field:'name',dir:'asc'}; } },
  saveSort(s){ localStorage.setItem(STORAGE_KEYS.sort,JSON.stringify(s)); },
  clearAll(){
    [STORAGE_KEYS.companies,STORAGE_KEYS.applications,STORAGE_KEYS.qa,STORAGE_KEYS.hasData,STORAGE_KEYS.sort]
      .forEach(k=>localStorage.removeItem(k));
  },
  exportAll(){
    return {
      version:3, exportedAt: new Date().toISOString(),
      companies: this.getCompanies(), applications: this.getApplications(), qa: this.getQA(),
      settings:{ theme:this.getTheme(), accent:this.getAccent(), sidebarCollapsed:this.getSidebarCollapsed() }
    };
  },
  importAll(data){
    if(data.companies) this.saveCompanies(data.companies);
    if(data.applications) this.saveApplications(data.applications);
    if(data.qa) this.saveQA(data.qa);
    if(data.settings){
      if(data.settings.theme) this.saveTheme(data.settings.theme);
      if(data.settings.accent) this.saveAccent(data.settings.accent);
      if(data.settings.sidebarCollapsed!==undefined) this.saveSidebarCollapsed(data.settings.sidebarCollapsed);
    }
    this.setHasData(true);
  }
};

/* ============================================================
   UTILITIES
   ============================================================ */
const uid = (p)=>`${p}-${Math.random().toString(36).slice(2,8)}`;
const escHtml = (s)=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const formatCurrency=(n)=>n?`₹${Number(n).toLocaleString('en-IN')}`:'—';
const formatDate=(iso)=>{if(!iso)return'—';const d=new Date(iso);return d.toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'});};
const formatDateTime=(iso)=>{if(!iso)return'—';const d=new Date(iso);return d.toLocaleString('en-IN',{day:'2-digit',month:'short',year:'numeric',hour:'2-digit',minute:'2-digit'});};
const debounce=(fn,ms=240)=>{let t;return(...a)=>{clearTimeout(t);t=setTimeout(()=>fn(...a),ms);};};

let _toastTimer=null;
const toast=(msg,opts={})=>{
  const el=document.getElementById('toast');
  el.textContent=msg;
  el.classList.remove('hidden','clickable');
  if(opts.click){ el.classList.add('clickable'); el.onclick=opts.click; } else { el.onclick=null; }
  clearTimeout(_toastTimer);
  if(!opts.persist) _toastTimer=setTimeout(()=>el.classList.add('hidden'),2800);
};

/* ============================================================
   THEME & ACCENT — apply derived palette
   ============================================================ */
function applyAccent(hex){
  if(!hex){ hex='#4FD1C5'; }
  const p = ColorUtils.buildPalette(hex);
  const root = document.documentElement;
  root.style.setProperty('--user-accent', p.accent);
  root.style.setProperty('--user-accent-rgb', p.accentRgb);
  root.style.setProperty('--user-accent-dim', p.accentDim);
  root.style.setProperty('--user-accent-mid', p.accentMid);
  root.style.setProperty('--user-accent-on', p.accentOn);
  root.style.setProperty('--user-accent-2', p.accent2);
  root.style.setProperty('--user-accent-3', p.accent3);
  // Update theme-color meta
  const meta = document.querySelector('meta[name="theme-color"]');
  if(meta) meta.setAttribute('content', hex);
  // Redraw charts if dashboard visible
  if(AppState.currentView==='dashboard') renderDashboard();
}

function applyTheme(theme){
  document.documentElement.classList.toggle('light', theme==='light');
  DataRepository.saveTheme(theme);
  if(AppState.currentView==='dashboard') renderDashboard();
}

function toggleTheme(){
  const isLight=document.documentElement.classList.contains('light');
  applyTheme(isLight?'dark':'light');
}

function toggleSidebarCollapse(){
  const sb=document.getElementById('sidebar');
  const collapsed=sb.classList.toggle('collapsed');
  DataRepository.saveSidebarCollapsed(collapsed);
}

/* ============================================================
   APP STATE
   ============================================================ */
const AppState = {
  companies:[], applications:[], qa:[],
  currentView:'dashboard',
  kanbanChannelFilter:'all',
  directory:{ search:'',type:'all',location:'all',stage:'all',page:1,pageSize:12 },
  qaFilter:{ search:'',tag:'all' },
  companiesFilter:{ search:'',type:'all',location:'all',source:'all' },
  sort:{ field:'name',dir:'asc' },
  activeCompanyId:null, activeTab:'meta', profileFromView:'companies',
  charts:{}, hasData:false,

  init(){
    this.hasData=DataRepository.getHasData();
    this.sort=DataRepository.getSort();
    if(!this.hasData){ this.companies=[]; this.applications=[]; this.qa=[]; return; }
    this.companies=DataRepository.getCompanies();
    this.applications=DataRepository.getApplications();
    this.qa=DataRepository.getQA();
  },
  persist(){
    DataRepository.saveCompanies(this.companies);
    DataRepository.saveApplications(this.applications);
    DataRepository.saveQA(this.qa);
    DataRepository.setHasData(true);
    this.hasData=true;
  },
  getApplicationForCompany(cid){ const a=this.applications.filter(a=>a.companyId===cid); return a.length?a[a.length-1]:null; },
  get uniqueLocations(){ return [...new Set(this.companies.map(c=>c.location))].sort(); },
  get uniqueSources(){ return [...new Set(this.companies.map(c=>c.source).filter(Boolean))].sort(); },
  get qaTags(){ const t=new Set(); this.qa.forEach(q=>q.tags?.forEach(tt=>t.add(tt))); return [...t].sort(); }
};

/* ============================================================
   CSV PARSER
   ============================================================ */
function parseCSV(text){
  const lines=text.split(/\r\n|\n/).filter(l=>l.trim());
  if(!lines.length) return [];
  const parseLine=(line)=>{
    const out=[];let cur='';let inQ=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"'){ if(inQ&&line[i+1]==='"'){cur+='"';i++;}else inQ=!inQ; }
      else if(ch===','&&!inQ){ out.push(cur);cur=''; }
      else cur+=ch;
    }
    out.push(cur);
    return out.map(s=>s.trim());
  };
  const headers=parseLine(lines[0]);
  return lines.slice(1).map(line=>{
    const vals=parseLine(line);
    const row={};
    headers.forEach((h,i)=>row[h.trim()]=vals[i]??'');
    return row;
  });
}

function cleanSalary(val){ if(!val)return 0; return Number(String(val).replace(/[^\d.]/g,''))||0; }

function importCSVRows(rows){
  let added=0,updated=0;
  rows.forEach(row=>{
    const id=(row['ID']||row['id']||'').trim();
    if(!id) return;
    // ── Logo URL: try multiple column name variants ──
    const logoUrl = (
      row['Logo URL'] || row['logo_url'] || row['Logo'] ||
      row['logo'] || row['Image URL'] || row['image_url'] || ''
    ).trim();

    const payload={
      id,
      name: row['Name']||row['name']||'Unnamed',
      type: (row['Type']||row['type']||'Service').trim(),
      location: row['Location']||row['location']||'Unknown',
      coreFocus: row['Product / Core Focus']||row['Core Focus']||row['coreFocus']||'',
      averageSalary: cleanSalary(row['Average Salary']||row['Salary']||row['salary']),
      contactNumber: row['Contact Number']||row['Phone']||row['phone']||'',
      linkedinUrl: row['Linkedin']||row['LinkedIn']||row['linkedin']||'',
      workMode: row['Work Mode']||row['workMode']||'On-Site',
      workingHours: row['Working Hours']||row['workingHours']||'',
      source: row['Source']||row['source']||'',
      logoUrl,
      website: row['Website']||row['website']||row['Website URL']||'',
      description: row['Description']||row['description']||'',
    };
    const idx=AppState.companies.findIndex(c=>c.id===id);
    if(idx>=0){
      AppState.companies[idx]={...AppState.companies[idx],...payload};
      updated++;
    } else {
      AppState.companies.push(payload);
      const stage=Math.min(Math.max(Number(row['Current Stage']||row['stage']||1),1),5);
      const now=new Date().toISOString();
      AppState.applications.push({
        id:uid('APP'), companyId:id, currentStage:stage,
        createdAt:now, updatedAt:now,
        timeline:[{stage:1,timestamp:now,notes:'Imported via CSV.'}],
        stageData:{1:{channel:'LinkedIn',vacancyFound:false,resumeSent:false,date:now},2:null,3:null,4:null,5:null}
      });
      added++;
    }
  });
  AppState.persist();
  return {added,updated};
}

function downloadFile(content,filename,mime){
  const blob=new Blob([content],{type:mime});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportSampleTemplate(){
  const hdr='ID,Name,Type,Location,Product / Core Focus,Average Salary,Contact Number,Linkedin,Current Stage,Work Mode,Working Hours,Source,Logo URL,Website,Description';
  const row='CMP-9001,Sample Systems Pvt Ltd,Service,Bengaluru,Enterprise ERP,1200000,+91 9876543210,https://linkedin.com/company/sample-systems,1,Hybrid,9:00 AM - 6:00 PM,LinkedIn,https://example.com/logo.png,https://sample.com,Leading ERP solutions provider for mid-market companies.';
  downloadFile(`${hdr}\n${row}`,'pipeline_template.csv','text/csv');
}

function exportFullJSON(){
  downloadFile(JSON.stringify(DataRepository.exportAll(),null,2),`pipeline_backup_${Date.now()}.json`,'application/json');
  toast('Full backup exported');
}

function exportCSV(){
  const hdr='ID,Name,Type,Location,Product / Core Focus,Average Salary,Contact Number,Linkedin,Current Stage,Work Mode,Working Hours,Source,Logo URL,Website,Description';
  const rows=AppState.companies.map(c=>{
    const app=AppState.getApplicationForCompany(c.id);
    const q=(s)=>`"${(s||'').replace(/"/g,'""')}"`;
    return [c.id,q(c.name),c.type,c.location,q(c.coreFocus),c.averageSalary,
      c.contactNumber,c.linkedinUrl,app?.currentStage||1,c.workMode||'On-Site',
      q(c.workingHours),q(c.source),
      c.logoUrl&&!c.logoUrl.startsWith('data:')?c.logoUrl:'',
      c.website||'',q(c.description)].join(',');
  });
  downloadFile([hdr,...rows].join('\n'),`pipeline_export_${Date.now()}.csv`,'text/csv');
  toast('CSV exported');
}

function logUpload(msg){
  const log=document.getElementById('uploadLog');
  const t=new Date().toLocaleTimeString('en-IN');
  log.textContent=`[${t}] ${msg}\n`+log.textContent;
}

/* ============================================================
   SIDEBAR / NAVIGATION
   ============================================================ */
function renderSidebarCounts(){ document.getElementById('sidebarCompanyCount').textContent=AppState.companies.length; }

function switchView(view){
  AppState.currentView=view;
  document.querySelectorAll('.view-panel').forEach(el=>el.classList.add('hidden'));
  document.getElementById(`view-${view}`).classList.remove('hidden');
  document.querySelectorAll('.nav-item').forEach(el=>el.classList.toggle('active',el.dataset.view===view));

  const titles={
    dashboard:['Executive Dashboard','STATUS_OVERVIEW / ALL_SYSTEMS'],
    kanban:['Pipeline Board','KANBAN / 5_STAGE_FLOW'],
    directory:['Global Directory',`${AppState.companies.length}_RECORDS / SEARCHABLE`],
    companies:['Companies',`${AppState.companies.length}_RECORDS / CARD_VIEW`],
    qa:['Q&A Bank',`${AppState.qa.length}_QUESTIONS / PREP_LIBRARY`],
    upload:['Data Sync','IMPORT_EXPORT / FULL_SYNC'],
    profile:['Company Profile','DETAILED_RECORD / FULL_VIEW'],
  };
  const t=titles[view]||['Pipeline',''];
  document.getElementById('viewTitle').textContent=t[0];
  document.getElementById('viewSubtitle').textContent=t[1];

  if(view==='dashboard') renderDashboard();
  if(view==='kanban') renderKanban();
  if(view==='directory') renderDirectory();
  if(view==='companies') renderCompanies();
  if(view==='qa') renderQA();
  if(view==='profile') renderProfile();

  // Close mobile drawer
  document.getElementById('sidebar').classList.remove('open');
  document.getElementById('sidebarOverlay').classList.remove('open');
}

/* ============================================================
   CHART HELPERS — full derived palette
   ============================================================ */
function getChartColors(){
  const s=getComputedStyle(document.documentElement);
  const get=(v)=>s.getPropertyValue(v).trim();
  const accent=get('--accent');
  const p=ColorUtils.buildPalette(accent||'#4FD1C5');
  return {
    accent: p.accent,
    accent2: p.accent2,
    accent3: p.accent3,
    accent4: p.accent4,
    accentMid: p.accentMid,
    accentDim: p.accentDim,
    accentOn: p.accentOn,
    dim: get('--text-dim'),
    border: get('--border'),
    text: get('--text'),
    success: get('--success'),
    danger: get('--danger'),
  };
}

function destroyChart(key){ if(AppState.charts[key]){AppState.charts[key].destroy();delete AppState.charts[key];} }

/* ============================================================
   DASHBOARD
   ============================================================ */
function renderDashboard(){
  if(!AppState.hasData){
    document.getElementById('dashboardContent').classList.add('hidden');
    document.getElementById('dashboardEmpty').classList.remove('hidden');
    return;
  }
  document.getElementById('dashboardContent').classList.remove('hidden');
  document.getElementById('dashboardEmpty').classList.add('hidden');

  const apps=AppState.applications;
  document.getElementById('kpiTotal').textContent=AppState.companies.length;
  document.getElementById('kpiActive').textContent=apps.filter(a=>a.currentStage<4).length;
  document.getElementById('kpiInterviews').textContent=apps.filter(a=>a.currentStage===3).length;
  document.getElementById('kpiOffers').textContent=apps.filter(a=>a.currentStage===5||(a.currentStage===4&&a.stageData[4]?.status==='Pass')).length;
  document.getElementById('kpiRejections').textContent=apps.filter(a=>(a.currentStage===4&&a.stageData[4]?.status==='Fail')||(a.currentStage===5&&a.stageData[5]?.acceptanceStatus==='Rejected')).length;

  const C=getChartColors();
  Chart.defaults.color=C.dim;
  Chart.defaults.borderColor=C.border;
  Chart.defaults.font.family="'Inter',sans-serif";

  // ── Funnel bar chart — shades of accent ──
  const stageCounts=STAGES.map(s=>apps.filter(a=>a.currentStage===s.id).length);
  // Build gradient palette: accent full → dimmer toward end
  const funnelColors=[C.accent, C.accent2, C.accent3, C.accent4, C.success];
  destroyChart('funnel');
  AppState.charts.funnel=new Chart(document.getElementById('funnelChart'),{
    type:'bar',
    data:{
      labels:STAGES.map(s=>s.tag),
      datasets:[{
        data:stageCounts,
        backgroundColor:funnelColors,
        borderRadius:6, barThickness:26
      }]
    },
    options:{
      indexAxis:'y', responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>`${ctx.parsed.x} companies`}}},
      scales:{ x:{grid:{color:C.border}}, y:{grid:{display:false}} }
    }
  });

  // ── Donut — product vs service ──
  const productCount=AppState.companies.filter(c=>c.type==='Product').length;
  const serviceCount=AppState.companies.filter(c=>c.type==='Service').length;
  destroyChart('type');
  AppState.charts.type=new Chart(document.getElementById('typeChart'),{
    type:'doughnut',
    data:{
      labels:['Product','Service'],
      datasets:[{data:[productCount,serviceCount],backgroundColor:[C.accent,C.accent2],borderColor:'transparent',borderWidth:0}]
    },
    options:{
      responsive:true, maintainAspectRatio:false, cutout:'66%',
      plugins:{legend:{position:'bottom',labels:{color:C.text,boxWidth:10,font:{size:11}}}}
    }
  });

  // ── Scatter — salary vs bond ──
  const offerPoints=apps
    .filter(a=>a.currentStage>=4&&a.stageData[4]?.status==='Pass')
    .map(a=>({x:a.stageData[4].bondDurationMonths,y:a.stageData[4].baseSalary}));
  destroyChart('salaryBond');
  AppState.charts.salaryBond=new Chart(document.getElementById('salaryBondChart'),{
    type:'scatter',
    data:{datasets:[{label:'Offers',data:offerPoints,backgroundColor:C.accent,pointRadius:7,pointHoverRadius:9}]},
    options:{
      responsive:true, maintainAspectRatio:false,
      plugins:{legend:{display:false},tooltip:{callbacks:{label:(ctx)=>`Bond:${ctx.parsed.x}mo · ${formatCurrency(ctx.parsed.y)}`}}},
      scales:{
        x:{title:{display:true,text:'Bond Duration (months)',color:C.dim},grid:{color:C.border}},
        y:{title:{display:true,text:'Base Salary (₹)',color:C.dim},grid:{color:C.border}}
      }
    }
  });
}

/* ============================================================
   KANBAN
   ============================================================ */
function channelForApp(app){ return app.stageData[1]?.channel||'—'; }

function renderKanban(){
  const board=document.getElementById('kanbanBoard');
  board.innerHTML='';
  const filter=AppState.kanbanChannelFilter;

  STAGES.forEach(stage=>{
    let stageApps=AppState.applications.filter(a=>a.currentStage===stage.id);
    if(filter!=='all') stageApps=stageApps.filter(a=>channelForApp(a)===filter);

    const col=document.createElement('div');
    col.className='kanban-column';
    col.innerHTML=`
      <div class="kanban-column-head">
        <span class="kanban-column-title">${stage.label}</span>
        <div class="kanban-column-meta">
          <span class="kanban-column-tag font-mono">[${stage.tag}]</span>
          <span class="kanban-column-count font-mono">${stageApps.length}</span>
        </div>
      </div>
      <div class="kanban-cards"></div>`;
    const cardsWrap=col.querySelector('.kanban-cards');

    stageApps.forEach(app=>{
      const company=AppState.companies.find(c=>c.id===app.companyId);
      if(!company) return;
      const overdue=stage.id===2&&app.stageData[2]?.followUpDate
        &&new Date(app.stageData[2].followUpDate)<new Date()&&app.stageData[2].status==='Pending';
      const card=document.createElement('div');
      card.className=`kanban-card${overdue?' flagged':''}`;
      card.innerHTML=`
        <div class="kanban-card-title">${escHtml(company.name)}</div>
        <div class="kanban-card-meta">
          <span class="kanban-card-badge">${escHtml(company.type)}</span>
          <span class="font-mono">${channelForApp(app)}</span>
        </div>
        <div class="kanban-card-meta" style="margin-top:.28rem">
          <span class="font-mono" style="font-size:.65rem">${escHtml(company.id)}</span>
          <span>${formatDate(app.updatedAt)}</span>
        </div>
        ${overdue?`<div class="kanban-card-flag"><i data-lucide="alert-triangle"></i> Follow-up overdue</div>`:''}`;
      card.addEventListener('click',()=>openCompanyProfile(company.id,'kanban'));
      cardsWrap.appendChild(card);
    });
    board.appendChild(col);
  });
  lucide.createIcons();
}

/* ============================================================
   DIRECTORY
   ============================================================ */
function populateLocationFilter(){
  const sel=document.getElementById('filterLocation');
  const cur=sel.value;
  sel.innerHTML='<option value="all">All Locations</option>'+
    AppState.uniqueLocations.map(l=>`<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('');
  sel.value=cur||'all';
}

function getFilteredCompanies(){
  const {search,type,location,stage}=AppState.directory;
  return AppState.companies.filter(c=>{
    const app=AppState.getApplicationForCompany(c.id);
    if(search){
      const s=search.toLowerCase();
      if(!([c.name,c.location,c.coreFocus,c.id,c.description||'',c.website||''].join(' ').toLowerCase().includes(s))) return false;
    }
    if(type!=='all'&&c.type!==type) return false;
    if(location!=='all'&&c.location!==location) return false;
    if(stage!=='all'&&(!app||app.currentStage!==Number(stage))) return false;
    return true;
  });
}

function renderDirectory(){
  populateLocationFilter();
  const filtered=getFilteredCompanies();
  const {page,pageSize}=AppState.directory;
  const totalPages=Math.max(1,Math.ceil(filtered.length/pageSize));
  const cp=Math.min(page,totalPages);
  AppState.directory.page=cp;
  const items=filtered.slice((cp-1)*pageSize,cp*pageSize);

  const tbody=document.getElementById('directoryTableBody');
  tbody.innerHTML=items.map(c=>{
    const app=AppState.getApplicationForCompany(c.id);
    const stage=STAGES.find(s=>s.id===(app?.currentStage||1));
    return `<tr data-id="${c.id}">
      <td class="font-mono" style="font-size:.72rem;color:var(--text-dim)">${c.id}</td>
      <td class="font-semibold">${escHtml(c.name)}</td>
      <td>${escHtml(c.type)}</td>
      <td>${escHtml(c.location)}</td>
      <td><span class="stage-tag">[${stage.tag}]</span></td>
      <td style="color:var(--text-dim);font-size:.8rem">${formatDate(app?.updatedAt)}</td>
      <td><i data-lucide="chevron-right" style="width:15px;height:15px;color:var(--text-dim)"></i></td>
    </tr>`;
  }).join('')||`<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--text-dim)">No companies match.</td></tr>`;
  tbody.querySelectorAll('tr[data-id]').forEach(row=>{
    row.addEventListener('click',()=>openCompanyProfile(row.dataset.id,'directory'));
  });

  // Pagination
  const pag=document.getElementById('directoryPagination');
  const maxBtns=7;
  let start=Math.max(1,cp-3),end=Math.min(totalPages,start+maxBtns-1);
  start=Math.max(1,end-maxBtns+1);
  pag.innerHTML=Array.from({length:end-start+1},(_,i)=>{
    const p=start+i;
    return `<button class="page-btn${p===cp?' active':''}" data-page="${p}">${p}</button>`;
  }).join('');
  pag.querySelectorAll('.page-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{AppState.directory.page=Number(btn.dataset.page);renderDirectory();});
  });
  lucide.createIcons();
}

/* ============================================================
   COMPANIES (Card Grid) + CRUD
   ============================================================ */
function populateCompaniesFilters(){
  const locSel=document.getElementById('companiesFilterLocation');
  const curL=locSel.value;
  locSel.innerHTML='<option value="all">All Locations</option>'+AppState.uniqueLocations.map(l=>`<option value="${escHtml(l)}">${escHtml(l)}</option>`).join('');
  locSel.value=curL||'all';
  const srcSel=document.getElementById('companiesFilterSource');
  const curS=srcSel.value;
  srcSel.innerHTML='<option value="all">All Sources</option>'+AppState.uniqueSources.map(s=>`<option value="${escHtml(s)}">${escHtml(s)}</option>`).join('');
  srcSel.value=curS||'all';
}

function getFilteredSortedCompanies(){
  const {search,type,location,source}=AppState.companiesFilter;
  let list=AppState.companies.filter(c=>{
    if(search){
      const s=search.toLowerCase();
      if(!([c.name,c.location,c.coreFocus||'',c.id,c.description||''].join(' ').toLowerCase().includes(s))) return false;
    }
    if(type!=='all'&&c.type!==type) return false;
    if(location!=='all'&&c.location!==location) return false;
    if(source!=='all'&&(c.source||'')!==source) return false;
    return true;
  });
  const {field,dir}=AppState.sort;
  return [...list].sort((a,b)=>{
    let av=a[field],bv=b[field];
    if(typeof av==='string') av=av.toLowerCase();
    if(typeof bv==='string') bv=bv.toLowerCase();
    av=av??''; bv=bv??'';
    if(av<bv) return dir==='asc'?-1:1;
    if(av>bv) return dir==='asc'?1:-1;
    return 0;
  });
}

function initialsOf(name){ return(name||'').split(' ').filter(Boolean).slice(0,2).map(w=>w[0].toUpperCase()).join('')||'??'; }

function renderCompanies(){
  populateCompaniesFilters();
  const list=getFilteredSortedCompanies();
  document.querySelectorAll('.sort-btn').forEach(btn=>{
    const active=btn.dataset.sort===AppState.sort.field;
    btn.classList.toggle('active',active);
    const icon=btn.querySelector('.sort-icon');
    if(icon) icon.textContent=active?(AppState.sort.dir==='asc'?'↑':'↓'):'⇅';
  });

  const grid=document.getElementById('companiesGrid');
  if(!list.length){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><i data-lucide="building-2" class="empty-state-icon"></i><h2>No companies found</h2><p>Adjust filters or add a new company.</p></div>`;
    lucide.createIcons(); return;
  }

  grid.innerHTML=list.map(c=>{
    const app=AppState.getApplicationForCompany(c.id);
    const stage=STAGES.find(s=>s.id===(app?.currentStage||1));
    const logoHtml=c.logoUrl
      ?`<img src="${escHtml(c.logoUrl)}" class="company-card-logo" alt="" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'" /><div class="company-card-logo-placeholder" style="display:none">${initialsOf(c.name)}</div>`
      :`<div class="company-card-logo-placeholder">${initialsOf(c.name)}</div>`;
    const websiteHtml=c.website?`<a class="company-card-website" href="${escHtml(c.website)}" target="_blank" rel="noopener" onclick="event.stopPropagation()"><i data-lucide="external-link"></i>${escHtml(new URL(c.website.startsWith('http')?c.website:'https://'+c.website).hostname)}</a>`:'';
    return `<div class="company-card" data-id="${c.id}">
      <div class="company-card-top">
        <div style="display:flex;align-items:center;gap:0.5rem">${logoHtml}</div>
        <div class="company-card-actions">
          <button class="icon-btn cc-edit-btn" data-id="${c.id}" aria-label="Edit"><i data-lucide="pencil"></i></button>
          <button class="icon-btn cc-del-btn" data-id="${c.id}" aria-label="Delete"><i data-lucide="trash-2"></i></button>
        </div>
      </div>
      <div class="company-card-name">${escHtml(c.name)}</div>
      <div class="company-card-meta">
        <span class="kanban-card-badge">${escHtml(c.type)}</span>
        <span style="font-size:.72rem;color:var(--text-dim)">${escHtml(c.location)}</span>
      </div>
      ${c.coreFocus?`<div class="company-card-focus">${escHtml(c.coreFocus)}</div>`:''}
      ${c.description?`<div class="company-card-desc">${escHtml(c.description)}</div>`:''}
      <div class="company-card-footer">
        <span class="font-mono" style="font-size:.78rem">${formatCurrency(c.averageSalary)}</span>
        <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap">
          ${websiteHtml}
          <span class="stage-tag">[${stage.tag}]</span>
        </div>
      </div>
    </div>`;
  }).join('');

  grid.querySelectorAll('.company-card').forEach(card=>{
    card.addEventListener('click',(e)=>{
      if(e.target.closest('.cc-edit-btn')||e.target.closest('.cc-del-btn')) return;
      openCompanyProfile(card.dataset.id,'companies');
    });
  });
  grid.querySelectorAll('.cc-edit-btn').forEach(btn=>{
    btn.addEventListener('click',(e)=>{e.stopPropagation();openCompanyForm(btn.dataset.id);});
  });
  grid.querySelectorAll('.cc-del-btn').forEach(btn=>{
    btn.addEventListener('click',(e)=>{e.stopPropagation();deleteCompany(btn.dataset.id);});
  });
  lucide.createIcons();
}

/* ── Company Form ── */
let companyFormLogoData=null;

function openCompanyForm(id){
  const ex=id?AppState.companies.find(c=>c.id===id):null;
  companyFormLogoData=null;
  document.getElementById('companyFormTitle').textContent=ex?'Edit Company':'Add Company';
  document.getElementById('companyFormId').value=ex?.id||'';
  document.getElementById('cfName').value=ex?.name||'';
  document.getElementById('cfType').value=ex?.type||'Product';
  document.getElementById('cfWorkMode').value=ex?.workMode||'On-Site';
  document.getElementById('cfLocation').value=ex?.location||'';
  document.getElementById('cfFocus').value=ex?.coreFocus||'';
  document.getElementById('cfSalary').value=ex?.averageSalary||'';
  document.getElementById('cfHours').value=ex?.workingHours||'';
  document.getElementById('cfPhone').value=ex?.contactNumber||'';
  document.getElementById('cfLinkedin').value=ex?.linkedinUrl||'';
  document.getElementById('cfSource').value=ex?.source||'';
  document.getElementById('cfWebsite').value=ex?.website||'';
  document.getElementById('cfDescription').value=ex?.description||'';
  document.getElementById('cfLogoFile').value='';
  document.getElementById('cfLogoUrl').value=(ex?.logoUrl&&!ex.logoUrl.startsWith('data:'))?ex.logoUrl:'';

  const preview=document.getElementById('companyLogoPreview');
  const ph=document.getElementById('companyLogoPlaceholder');
  if(ex?.logoUrl){ preview.src=ex.logoUrl; preview.classList.remove('hidden'); ph.classList.add('hidden'); }
  else { preview.classList.add('hidden'); ph.classList.remove('hidden'); ph.textContent=ex?initialsOf(ex.name):'??'; }

  document.getElementById('companyFormOverlay').classList.remove('hidden');
  lucide.createIcons();
}

function closeCompanyForm(){ document.getElementById('companyFormOverlay').classList.add('hidden'); companyFormLogoData=null; }

function handleLogoFileSelect(e){
  const file=e.target.files[0]; if(!file) return;
  const reader=new FileReader();
  reader.onload=()=>{
    companyFormLogoData=reader.result;
    document.getElementById('cfLogoUrl').value='';
    const p=document.getElementById('companyLogoPreview');
    p.src=companyFormLogoData; p.classList.remove('hidden');
    document.getElementById('companyLogoPlaceholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function saveCompany(){
  const id=document.getElementById('companyFormId').value;
  const name=document.getElementById('cfName').value.trim();
  if(!name){ toast('Company name is required'); return; }
  const urlVal=document.getElementById('cfLogoUrl').value.trim();
  const ex=id?AppState.companies.find(c=>c.id===id):null;
  const logoUrl=companyFormLogoData||urlVal||ex?.logoUrl||'';

  const payload={
    name, type:document.getElementById('cfType').value,
    workMode:document.getElementById('cfWorkMode').value,
    location:document.getElementById('cfLocation').value.trim()||'Unknown',
    coreFocus:document.getElementById('cfFocus').value.trim(),
    averageSalary:Number(document.getElementById('cfSalary').value)||0,
    workingHours:document.getElementById('cfHours').value.trim(),
    contactNumber:document.getElementById('cfPhone').value.trim(),
    linkedinUrl:document.getElementById('cfLinkedin').value.trim(),
    source:document.getElementById('cfSource').value.trim(),
    website:document.getElementById('cfWebsite').value.trim(),
    description:document.getElementById('cfDescription').value.trim(),
    logoUrl,
  };

  if(id){
    const idx=AppState.companies.findIndex(c=>c.id===id);
    if(idx>=0){ AppState.companies[idx]={...AppState.companies[idx],...payload}; toast('Company updated'); }
  } else {
    const newId=uid('CMP');
    AppState.companies.push({id:newId,...payload});
    const now=new Date().toISOString();
    AppState.applications.push({
      id:uid('APP'),companyId:newId,currentStage:1,createdAt:now,updatedAt:now,
      timeline:[{stage:1,timestamp:now,notes:'Added manually.'}],
      stageData:{1:{channel:'LinkedIn',vacancyFound:false,resumeSent:false,date:now},2:null,3:null,4:null,5:null}
    });
    toast('Company added');
  }

  AppState.persist(); closeCompanyForm(); renderSidebarCounts();
  document.getElementById('uploadEmptyNotice')?.classList.add('hidden');
  const v=AppState.currentView;
  if(v==='companies') renderCompanies();
  if(v==='directory') renderDirectory();
  if(v==='dashboard') renderDashboard();
  if(v==='kanban') renderKanban();
  if(v==='profile'&&AppState.activeCompanyId===(id||AppState.activeCompanyId)) renderProfile();
}

function deleteCompany(id){
  if(!confirm('Delete this company and all its data? This cannot be undone.')) return;
  AppState.companies=AppState.companies.filter(c=>c.id!==id);
  AppState.applications=AppState.applications.filter(a=>a.companyId!==id);
  AppState.persist(); toast('Company deleted'); renderSidebarCounts();
  const v=AppState.currentView;
  if(v==='companies') renderCompanies();
  if(v==='directory') renderDirectory();
  if(v==='dashboard') renderDashboard();
  if(v==='kanban') renderKanban();
  if(v==='profile'&&AppState.activeCompanyId===id) switchView(AppState.profileFromView||'companies');
}

/* ============================================================
   COMPANY PROFILE
   ============================================================ */
function openCompanyProfile(companyId,fromView){
  AppState.activeCompanyId=companyId;
  AppState.activeTab='meta';
  AppState.profileFromView=fromView||(AppState.currentView!=='profile'?AppState.currentView:AppState.profileFromView)||'companies';
  switchView('profile');
}

function closeCompanyProfile(){ switchView(AppState.profileFromView||'companies'); }

function renderProfile(){
  const company=AppState.companies.find(c=>c.id===AppState.activeCompanyId);
  if(!company){ switchView('companies'); return; }
  const app=AppState.getApplicationForCompany(company.id);
  const stage=STAGES.find(s=>s.id===app.currentStage);

  document.getElementById('modalCompanyName').textContent=company.name;
  document.getElementById('modalCompanyId').textContent=`#${company.id}`;
  document.getElementById('modalStageTag').textContent=`[${stage.tag}]`;

  // Logo
  const logo=document.getElementById('modalCompanyLogo');
  const logoPH=document.getElementById('modalCompanyLogoPlaceholder');
  if(company.logoUrl){ logo.src=company.logoUrl; logo.classList.remove('hidden'); logoPH.classList.add('hidden'); }
  else { logo.classList.add('hidden'); logoPH.classList.remove('hidden'); logoPH.textContent=initialsOf(company.name); }

  // Quick links under company name
  const linksEl=document.getElementById('modalHeadLinks');
  if(linksEl){
    let links='';
    if(company.website) links+=`<a class="modal-head-link" href="${escHtml(company.website)}" target="_blank" rel="noopener"><i data-lucide="globe"></i>${escHtml(new URL(company.website.startsWith('http')?company.website:'https://'+company.website).hostname)}</a>`;
    if(company.linkedinUrl) links+=`<a class="modal-head-link" href="${escHtml(company.linkedinUrl)}" target="_blank" rel="noopener"><i data-lucide="linkedin"></i>LinkedIn</a>`;
    linksEl.innerHTML=links;
  }

  // Offer banner
  const banner=document.getElementById('modalOfferBanner');
  if(app.currentStage>=4&&app.stageData[4]?.status==='Pass'){
    banner.classList.remove('hidden');
    document.getElementById('bannerRole').textContent=app.stageData[4].offerRole||'—';
    document.getElementById('bannerSalary').textContent=formatCurrency(app.stageData[4].baseSalary);
    document.getElementById('bannerBond').textContent=app.stageData[4].bondDurationMonths?`${app.stageData[4].bondDurationMonths} months`:'None';
  } else { banner.classList.add('hidden'); }

  // Meta
  document.getElementById('metaType').textContent=company.type;
  document.getElementById('metaLocation').textContent=company.location;
  document.getElementById('metaFocus').textContent=company.coreFocus||'—';
  document.getElementById('metaSalary').textContent=formatCurrency(company.averageSalary);
  document.getElementById('metaWorkMode').textContent=company.workMode||'—';
  document.getElementById('metaWorkingHours').textContent=company.workingHours||'—';
  document.getElementById('metaSource').textContent=company.source||'—';

  const phoneEl=document.getElementById('metaPhone');
  phoneEl.href=company.contactNumber?`tel:${company.contactNumber.replace(/\s+/g,'')}`:'#';
  phoneEl.innerHTML=`<i data-lucide="phone"></i> ${escHtml(company.contactNumber||'—')}`;

  const liEl=document.getElementById('metaLinkedin');
  liEl.href=company.linkedinUrl||'#';
  liEl.style.display=company.linkedinUrl?'':'none';

  const webEl=document.getElementById('metaWebsite');
  if(webEl){ webEl.href=company.website||'#'; webEl.textContent=company.website?new URL(company.website.startsWith('http')?company.website:'https://'+company.website).hostname:'—'; webEl.style.display=company.website?'':'none'; }

  const descEl=document.getElementById('metaDesc');
  if(descEl){ descEl.textContent=company.description||'No description.'; descEl.parentElement.style.display=company.description?'':''; }

  renderStepper(app);
  renderStageForm(app);
  renderTimeline(app);
  setActiveTab(AppState.activeTab);
  lucide.createIcons();
}

function setActiveTab(tab){
  AppState.activeTab=tab;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));
  document.querySelectorAll('.modal-tab-panel').forEach(p=>p.classList.add('hidden'));
  document.getElementById(`tab-${tab}`).classList.remove('hidden');
}

function renderStepper(app){
  const container=document.getElementById('stepperContainer');
  container.innerHTML=STAGES.map(s=>{
    const cls=s.id<app.currentStage?'done':s.id===app.currentStage?'current':'';
    return `<div class="step-item ${cls}" data-stage="${s.id}">
      <div class="step-circle">${s.id<app.currentStage?'✓':s.id}</div>
      <span class="step-label">${s.label.split(' ')[0]}</span>
    </div>`;
  }).join('');
  container.querySelectorAll('.step-item').forEach(el=>{
    el.addEventListener('click',()=>{ AppState.viewingStage=Number(el.dataset.stage); renderStageForm(app,AppState.viewingStage); });
  });
}

function renderStageForm(app,viewStage){
  const stageId=viewStage||app.currentStage;
  const container=document.getElementById('stageFormContainer');
  const data=app.stageData[stageId]||{};
  let html='';

  if(stageId===1){
    html=`<div class="form-row"><label>Channel</label><select id="f_channel">
      ${['LinkedIn','Call','Walk-In/Connection'].map(c=>`<option value="${c}"${data.channel===c?' selected':''}>${c}</option>`).join('')}
    </select></div>
    <div class="checkbox-row"><input type="checkbox" id="f_vacancy"${data.vacancyFound?' checked':''}/><label for="f_vacancy">Vacancy confirmed</label></div>
    <div class="checkbox-row"><input type="checkbox" id="f_resume"${data.resumeSent?' checked':''}/><label for="f_resume">Resume sent</label></div>`;
  } else if(stageId===2){
    html=`<div class="form-row"><label>Follow-up Date</label><input type="date" id="f_followupDate" value="${data.followUpDate||''}"/></div>
    <div class="form-row"><label>Status</label><select id="f_followupStatus">
      ${['Pending','No Response','Moving Forward','Closed'].map(s=>`<option value="${s}"${data.status===s?' selected':''}>${s}</option>`).join('')}
    </select></div>`;
  } else if(stageId===3){
    const rounds=data.rounds?.length?data.rounds:[{roundNumber:1,type:'',location:'',dateTime:''}];
    html=`<div id="roundsList">`+rounds.map((r,idx)=>`
      <div class="round-block" data-idx="${idx}">
        <div class="form-row"><label>Round ${idx+1} Type</label><input type="text" class="r_type" value="${escHtml(r.type||'')}" placeholder="e.g. Technical Screen"/></div>
        <div class="form-row"><label>Location</label><input type="text" class="r_location" value="${escHtml(r.location||'')}" placeholder="Office / Google Meet"/></div>
        <div class="form-row"><label>Date & Time</label><input type="datetime-local" class="r_datetime" value="${r.dateTime?new Date(r.dateTime).toISOString().slice(0,16):''}"/></div>
      </div>`).join('')+`</div>
    <button type="button" class="btn-secondary btn-sm" id="addRoundBtn"><i data-lucide="plus"></i> Add Round</button>`;
  } else if(stageId===4){
    html=`<div class="form-row"><label>Result</label><select id="f_status">
      <option value="Pass"${data.status==='Pass'?' selected':''}>Pass</option>
      <option value="Fail"${data.status==='Fail'?' selected':''}>Fail</option>
    </select></div>
    <div class="form-row"><label>Failure Reason</label><input type="text" id="f_failReason" value="${escHtml(data.failureReason||'')}"/></div>
    <div class="form-row"><label>Offer Role</label><input type="text" id="f_offerRole" value="${escHtml(data.offerRole||'')}"/></div>
    <div class="form-2col">
      <div class="form-row"><label>Base Salary (₹)</label><input type="number" id="f_baseSalary" value="${data.baseSalary||''}"/></div>
      <div class="form-row"><label>Bond (months)</label><input type="number" id="f_bondMonths" value="${data.bondDurationMonths||''}"/></div>
    </div>`;
  } else if(stageId===5){
    html=`<div class="form-row"><label>Final Rank</label><input type="number" id="f_rank" value="${data.finalRank||''}" min="1"/></div>
    <div class="form-row"><label>Acceptance</label><select id="f_acceptance">
      ${['Selected','Rejected','Pending'].map(s=>`<option value="${s}"${data.acceptanceStatus===s?' selected':''}>${s}</option>`).join('')}
    </select></div>`;
  }

  html+=`<div class="form-row" style="margin-top:.5rem"><label>Notes for timeline</label><textarea id="f_notes" placeholder="What happened at this stage?"></textarea></div>
  <div class="form-actions">
    <button class="btn-secondary btn-sm" id="saveStageOnlyBtn">Save Stage</button>
    <button class="btn-primary btn-sm" id="advanceStageBtn">${stageId<5?'Save & Advance →':'Save'}</button>
  </div>`;
  container.innerHTML=html;

  if(stageId===3){
    document.getElementById('addRoundBtn')?.addEventListener('click',()=>{
      const list=document.getElementById('roundsList');
      const idx=list.children.length;
      const block=document.createElement('div');
      block.className='round-block'; block.dataset.idx=idx;
      block.innerHTML=`<div class="form-row"><label>Round ${idx+1} Type</label><input type="text" class="r_type" placeholder="e.g. HR Round"/></div>
        <div class="form-row"><label>Location</label><input type="text" class="r_location" placeholder="Office / Remote"/></div>
        <div class="form-row"><label>Date & Time</label><input type="datetime-local" class="r_datetime"/></div>`;
      list.appendChild(block);
    });
  }

  document.getElementById('saveStageOnlyBtn').addEventListener('click',()=>commitStage(app,stageId,false));
  document.getElementById('advanceStageBtn').addEventListener('click',()=>commitStage(app,stageId,true));
  lucide.createIcons();
}

function commitStage(app,stageId,advance){
  let notes=document.getElementById('f_notes').value.trim();
  if(stageId===1){
    app.stageData[1]={channel:document.getElementById('f_channel').value,vacancyFound:document.getElementById('f_vacancy').checked,resumeSent:document.getElementById('f_resume').checked,date:app.stageData[1]?.date||new Date().toISOString()};
    if(!notes) notes=`Outreach via ${app.stageData[1].channel}.`;
  } else if(stageId===2){
    app.stageData[2]={followUpDate:document.getElementById('f_followupDate').value,status:document.getElementById('f_followupStatus').value};
    if(!notes) notes=`Follow-up: ${app.stageData[2].status}.`;
  } else if(stageId===3){
    const rounds=[...document.querySelectorAll('.round-block')].map((b,i)=>({roundNumber:i+1,type:b.querySelector('.r_type').value,location:b.querySelector('.r_location').value,dateTime:b.querySelector('.r_datetime').value?new Date(b.querySelector('.r_datetime').value).toISOString():null}));
    app.stageData[3]={rounds};
    if(!notes) notes=`${rounds.length} interview round(s).`;
  } else if(stageId===4){
    app.stageData[4]={status:document.getElementById('f_status').value,failureReason:document.getElementById('f_failReason').value,offerRole:document.getElementById('f_offerRole').value,baseSalary:Number(document.getElementById('f_baseSalary').value)||0,bondDurationMonths:Number(document.getElementById('f_bondMonths').value)||0};
    if(!notes) notes=`Interview result: ${app.stageData[4].status}.`;
  } else if(stageId===5){
    app.stageData[5]={finalRank:Number(document.getElementById('f_rank').value)||null,acceptanceStatus:document.getElementById('f_acceptance').value};
    if(!notes) notes=`Offer: ${app.stageData[5].acceptanceStatus}.`;
  }
  const now=new Date().toISOString();
  app.updatedAt=now;
  app.timeline.push({stage:stageId,timestamp:now,notes});
  if(advance&&stageId<5&&stageId===app.currentStage) app.currentStage=stageId+1;
  else if(stageId>app.currentStage) app.currentStage=stageId;
  AppState.persist(); toast('Stage updated');
  renderProfile(); renderSidebarCounts(); setActiveTab('timeline');
  if(AppState.currentView==='kanban') renderKanban();
  if(AppState.currentView==='dashboard') renderDashboard();
}

function renderTimeline(app){
  const log=document.getElementById('timelineLog');
  if(!app.timeline.length){ log.innerHTML=`<div class="timeline-empty">No activity yet.</div>`; return; }
  const sorted=[...app.timeline].sort((a,b)=>new Date(b.timestamp)-new Date(a.timestamp));
  log.innerHTML=sorted.map(entry=>{
    const stage=STAGES.find(s=>s.id===entry.stage);
    return `<div class="timeline-entry">
      <div class="timeline-entry-time">${formatDateTime(entry.timestamp)}</div>
      <div class="timeline-entry-title">[${stage?.tag||entry.stage}]</div>
      <div class="timeline-entry-notes">${escHtml(entry.notes)}</div>
    </div>`;
  }).join('');
}

/* ============================================================
   Q&A BANK
   ============================================================ */
function renderQA(){
  const {search,tag}=AppState.qaFilter;
  let items=AppState.qa;
  if(search){ const s=search.toLowerCase(); items=items.filter(q=>q.question.toLowerCase().includes(s)||q.answer.toLowerCase().includes(s)||q.tags.some(t=>t.toLowerCase().includes(s))); }
  if(tag!=='all') items=items.filter(q=>q.tags.includes(tag));

  const tagSel=document.getElementById('qaTagFilter');
  const cur=tagSel?.value||'all';
  if(tagSel){ tagSel.innerHTML='<option value="all">All Tags</option>'+AppState.qaTags.map(t=>`<option value="${escHtml(t)}">${escHtml(t)}</option>`).join(''); tagSel.value=cur; }

  const grid=document.getElementById('qaGrid');
  if(!items.length){ grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><i data-lucide="book-open" class="empty-state-icon"></i><h2>No questions yet</h2><p>Add your first interview question.</p></div>`; lucide.createIcons(); return; }
  grid.innerHTML=items.map(q=>`<div class="qa-card" data-id="${q.id}">
    <div class="qa-card-header">
      <div class="qa-card-tags">${q.tags.map(t=>`<span class="qa-tag">${escHtml(t)}</span>`).join('')}</div>
      <div class="qa-card-actions">
        <button class="icon-btn qa-edit-btn" data-id="${q.id}" style="width:32px;height:32px"><i data-lucide="pencil"></i></button>
        <button class="icon-btn qa-del-btn" data-id="${q.id}" style="width:32px;height:32px"><i data-lucide="trash-2"></i></button>
      </div>
    </div>
    <div class="qa-question">${escHtml(q.question)}</div>
    <div class="qa-answer">${escHtml(q.answer)}</div>
  </div>`).join('');
  grid.querySelectorAll('.qa-edit-btn').forEach(btn=>btn.addEventListener('click',(e)=>{e.stopPropagation();openQAForm(btn.dataset.id);}));
  grid.querySelectorAll('.qa-del-btn').forEach(btn=>btn.addEventListener('click',(e)=>{e.stopPropagation();deleteQA(btn.dataset.id);}));
  lucide.createIcons();
}

function openQAForm(id){
  const ex=id?AppState.qa.find(q=>q.id===id):null;
  document.getElementById('qaFormTitle').textContent=ex?'Edit Question':'Add Question';
  document.getElementById('qaFormId').value=ex?.id||'';
  document.getElementById('qaFormQuestion').value=ex?.question||'';
  document.getElementById('qaFormAnswer').value=ex?.answer||'';
  document.getElementById('qaFormTags').value=ex?.tags?.join(', ')||'';
  document.getElementById('qaFormOverlay').classList.remove('hidden');
  document.getElementById('qaFormQuestion').focus();
}
function closeQAForm(){ document.getElementById('qaFormOverlay').classList.add('hidden'); }
function saveQA(){
  const id=document.getElementById('qaFormId').value;
  const question=document.getElementById('qaFormQuestion').value.trim();
  const answer=document.getElementById('qaFormAnswer').value.trim();
  const tags=document.getElementById('qaFormTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  if(!question){ toast('Question is required'); return; }
  if(id){ const idx=AppState.qa.findIndex(q=>q.id===id); if(idx>=0){AppState.qa[idx]={...AppState.qa[idx],question,answer,tags,updatedAt:new Date().toISOString()};toast('Updated');} }
  else { AppState.qa.push({id:uid('QA'),question,answer,tags,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()}); toast('Question added'); }
  AppState.persist(); closeQAForm(); renderQA();
}
function deleteQA(id){ if(!confirm('Delete this question?')) return; AppState.qa=AppState.qa.filter(q=>q.id!==id); AppState.persist(); toast('Deleted'); renderQA(); }

/* ============================================================
   SIDEBAR HELPERS
   ============================================================ */
function openMobileSidebar(){ document.getElementById('sidebar').classList.add('open'); document.getElementById('sidebarOverlay').classList.add('open'); }
function closeMobileSidebar(){ document.getElementById('sidebar').classList.remove('open'); document.getElementById('sidebarOverlay').classList.remove('open'); }

/* ============================================================
   OFFLINE INDICATOR
   ============================================================ */
function updateOnlineStatus(){
  let banner=document.getElementById('offlineBanner');
  if(!navigator.onLine){
    if(!banner){
      banner=document.createElement('div');
      banner.id='offlineBanner';
      banner.className='offline-banner';
      banner.innerHTML='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 1l22 22M16.72 11.06A10.94 10.94 0 0 1 19 12.55M5 12.55a10.94 10.94 0 0 1 5.17-2.39M10.71 5.05A16 16 0 0 1 22.56 9M1.42 9a15.91 15.91 0 0 1 4.7-2.88M8.53 16.11a6 6 0 0 1 6.95 0M12 20h.01"/></svg> You\'re offline — your data is saved locally';
      document.body.prepend(banner);
    }
  } else {
    if(banner){ banner.remove(); toast('Back online ✓'); }
  }
}

/* ============================================================
   INIT + EVENT WIRING
   ============================================================ */
document.addEventListener('DOMContentLoaded',()=>{
  AppState.init();

  // Theme & accent
  applyTheme(DataRepository.getTheme());
  const savedAccent=DataRepository.getAccent();
  if(savedAccent){ applyAccent(savedAccent); document.getElementById('accentPicker').value=savedAccent; }
  else { applyAccent('#4FD1C5'); }
  if(DataRepository.getSidebarCollapsed()) document.getElementById('sidebar').classList.add('collapsed');

  renderSidebarCounts();

  if(!AppState.hasData){
    switchView('upload');
    document.getElementById('uploadEmptyNotice')?.classList.remove('hidden');
  } else {
    switchView('dashboard');
    document.getElementById('uploadEmptyNotice')?.classList.add('hidden');
  }

  lucide.createIcons();

  // Nav
  document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>switchView(btn.dataset.view)));

  // Theme toggles
  document.getElementById('themeToggle').addEventListener('click',toggleTheme);
  document.getElementById('themeToggleMobile').addEventListener('click',toggleTheme);

  // Accent picker
  document.getElementById('accentPicker').addEventListener('input',(e)=>{ applyAccent(e.target.value); DataRepository.saveAccent(e.target.value); });

  // Sidebar
  document.getElementById('collapseBtn').addEventListener('click',toggleSidebarCollapse);
  document.getElementById('burgerBtn').addEventListener('click',openMobileSidebar);
  document.getElementById('closeSidebarBtn').addEventListener('click',closeMobileSidebar);
  document.getElementById('sidebarOverlay').addEventListener('click',closeMobileSidebar);

  // Global search
  document.getElementById('globalSearch').addEventListener('input',debounce((e)=>{
    AppState.directory.search=e.target.value; AppState.directory.page=1;
    if(AppState.currentView!=='directory') switchView('directory'); else renderDirectory();
  },200));

  // Directory
  document.getElementById('directorySearch').addEventListener('input',debounce((e)=>{ AppState.directory.search=e.target.value; AppState.directory.page=1; renderDirectory(); },200));
  document.getElementById('filterType').addEventListener('change',(e)=>{ AppState.directory.type=e.target.value; AppState.directory.page=1; renderDirectory(); });
  document.getElementById('filterLocation').addEventListener('change',(e)=>{ AppState.directory.location=e.target.value; AppState.directory.page=1; renderDirectory(); });
  document.getElementById('filterStage').addEventListener('change',(e)=>{ AppState.directory.stage=e.target.value; AppState.directory.page=1; renderDirectory(); });

  // Companies
  document.getElementById('companiesSearch').addEventListener('input',debounce((e)=>{ AppState.companiesFilter.search=e.target.value; renderCompanies(); },200));
  document.getElementById('companiesFilterType').addEventListener('change',(e)=>{ AppState.companiesFilter.type=e.target.value; renderCompanies(); });
  document.getElementById('companiesFilterLocation').addEventListener('change',(e)=>{ AppState.companiesFilter.location=e.target.value; renderCompanies(); });
  document.getElementById('companiesFilterSource').addEventListener('change',(e)=>{ AppState.companiesFilter.source=e.target.value; renderCompanies(); });
  document.querySelectorAll('.sort-btn').forEach(btn=>{
    btn.addEventListener('click',()=>{
      const f=btn.dataset.sort;
      if(AppState.sort.field===f) AppState.sort.dir=AppState.sort.dir==='asc'?'desc':'asc';
      else { AppState.sort.field=f; AppState.sort.dir='asc'; }
      DataRepository.saveSort(AppState.sort); renderCompanies();
    });
  });
  document.getElementById('addCompanyBtn').addEventListener('click',()=>openCompanyForm());

  // Kanban
  document.querySelectorAll('#channelFilterPills .pill').forEach(pill=>{
    pill.addEventListener('click',()=>{
      document.querySelectorAll('#channelFilterPills .pill').forEach(p=>p.classList.remove('active'));
      pill.classList.add('active'); AppState.kanbanChannelFilter=pill.dataset.channel; renderKanban();
    });
  });

  // Profile
  document.getElementById('profileBackBtn').addEventListener('click',closeCompanyProfile);
  document.getElementById('profileEditBtn').addEventListener('click',()=>openCompanyForm(AppState.activeCompanyId));
  document.getElementById('profileDeleteBtn').addEventListener('click',()=>deleteCompany(AppState.activeCompanyId));
  document.querySelectorAll('.tab-btn').forEach(btn=>btn.addEventListener('click',()=>setActiveTab(btn.dataset.tab)));

  // Company form
  document.getElementById('companyFormClose').addEventListener('click',closeCompanyForm);
  document.getElementById('companyFormClose2').addEventListener('click',closeCompanyForm);
  document.getElementById('companyFormOverlay').addEventListener('click',(e)=>{ if(e.target.id==='companyFormOverlay') closeCompanyForm(); });
  document.getElementById('companyFormSave').addEventListener('click',saveCompany);
  document.getElementById('cfLogoFile').addEventListener('change',handleLogoFileSelect);
  document.getElementById('cfLogoUrl').addEventListener('input',()=>{
    const url=document.getElementById('cfLogoUrl').value.trim();
    if(url){ companyFormLogoData=null; document.getElementById('cfLogoFile').value=''; const p=document.getElementById('companyLogoPreview'); p.src=url; p.classList.remove('hidden'); document.getElementById('companyLogoPlaceholder').classList.add('hidden'); }
  });

  // Q&A
  document.getElementById('addQABtn').addEventListener('click',()=>openQAForm());
  document.getElementById('qaFormClose').addEventListener('click',closeQAForm);
  document.getElementById('qaFormClose2').addEventListener('click',closeQAForm);
  document.getElementById('qaFormOverlay').addEventListener('click',(e)=>{ if(e.target.id==='qaFormOverlay') closeQAForm(); });
  document.getElementById('qaFormSave').addEventListener('click',saveQA);
  document.getElementById('qaSearch').addEventListener('input',debounce((e)=>{ AppState.qaFilter.search=e.target.value; renderQA(); },200));
  document.getElementById('qaTagFilter').addEventListener('change',(e)=>{ AppState.qaFilter.tag=e.target.value; renderQA(); });

  // Upload CSV
  const dropZone=document.getElementById('dropZone');
  const csvInput=document.getElementById('csvFileInput');
  dropZone.addEventListener('click',()=>csvInput.click());
  dropZone.addEventListener('dragover',(e)=>{ e.preventDefault(); dropZone.classList.add('dragover'); });
  dropZone.addEventListener('dragleave',()=>dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop',(e)=>{ e.preventDefault(); dropZone.classList.remove('dragover'); const f=e.dataTransfer.files[0]; if(f) handleCSVFile(f); });
  csvInput.addEventListener('change',(e)=>{ if(e.target.files[0]) handleCSVFile(e.target.files[0]); });

  function handleCSVFile(file){
    if(!file.name.toLowerCase().endsWith('.csv')){ logUpload(`Rejected "${file.name}" — not .csv`); return; }
    const reader=new FileReader();
    reader.onload=()=>{
      const rows=parseCSV(reader.result);
      const {added,updated}=importCSVRows(rows);
      logUpload(`"${file.name}": ${added} added, ${updated} updated.`);
      toast(`CSV: ${added} added, ${updated} updated`);
      renderSidebarCounts();
      document.getElementById('uploadEmptyNotice')?.classList.add('hidden');
      const v=AppState.currentView;
      if(v==='dashboard') renderDashboard();
      if(v==='directory') renderDirectory();
      if(v==='kanban') renderKanban();
      if(v==='companies') renderCompanies();
    };
    reader.readAsText(file);
  }

  document.getElementById('downloadTemplateBtn').addEventListener('click',(e)=>{ e.stopPropagation(); exportSampleTemplate(); });
  document.getElementById('exportBtnTop').addEventListener('click',exportFullJSON);
  document.getElementById('exportJsonBtn').addEventListener('click',exportFullJSON);
  document.getElementById('exportCsvBtn').addEventListener('click',exportCSV);

  const jsonInput=document.getElementById('jsonFileInput');
  document.getElementById('importJsonBtn').addEventListener('click',()=>jsonInput.click());
  jsonInput.addEventListener('change',(e)=>{
    const file=e.target.files[0]; if(!file) return;
    const reader=new FileReader();
    reader.onload=()=>{
      try{
        const data=JSON.parse(reader.result);
        if(!data.companies||!Array.isArray(data.companies)) throw new Error('Invalid schema');
        DataRepository.importAll(data); AppState.init();
        // Re-apply saved accent from backup
        const accent=DataRepository.getAccent();
        if(accent){ applyAccent(accent); document.getElementById('accentPicker').value=accent; }
        applyTheme(DataRepository.getTheme());
        renderSidebarCounts(); switchView('dashboard');
        document.getElementById('uploadEmptyNotice')?.classList.add('hidden');
        logUpload(`Restored: ${data.companies.length} companies, ${data.applications?.length||0} apps, ${data.qa?.length||0} Q&A.`);
        toast('Backup restored');
      } catch(err){
        logUpload(`Import failed: ${err.message}`); toast('Import failed — invalid file');
      }
    };
    reader.readAsText(file);
  });

  document.getElementById('resetDataBtn').addEventListener('click',()=>{
    if(!confirm('Clear ALL data? This cannot be undone.')) return;
    DataRepository.clearAll(); AppState.init(); renderSidebarCounts();
    switchView('upload');
    document.getElementById('uploadEmptyNotice')?.classList.remove('hidden');
    logUpload('All data cleared.'); toast('All data cleared');
  });

  // Offline detection
  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
  updateOnlineStatus();
});
