/**
 * config.js
 * ------------------------------------------------------------
 * Central configuration for the Pipeline CRM.
 *
 * BACKEND_CONFIG is a placeholder for a future MongoDB/Node.js
 * sync layer. Today the app runs fully client-side against
 * localStorage via the Repository pattern in app.js (see
 * `DataRepository`). When a real backend exists, flip
 * `enabled: true` and implement the fetch calls in the
 * `remote` methods of DataRepository — the rest of the app
 * only ever talks to DataRepository, never to localStorage
 * or fetch() directly, so the swap is isolated to that file.
 * ------------------------------------------------------------
 */
const BACKEND_CONFIG = {
  enabled: false, // set true once a Node.js/MongoDB API is live
  baseUrl: 'https://api.example.com/v1',
  endpoints: {
    companies: '/companies',
    applications: '/applications',
    sync: '/sync',
  },
  authHeader: null, // e.g. { Authorization: 'Bearer <token>' }
  syncIntervalMs: 60000,
};

const STORAGE_KEYS = {
  companies: 'pipeline_crm_companies',
  applications: 'pipeline_crm_applications',
  qa: 'pipeline_crm_qa',
  theme: 'pipeline_crm_theme',
  accent: 'pipeline_crm_accent',
  sidebar: 'pipeline_crm_sidebar_collapsed',
  hasData: 'pipeline_crm_has_data',
  sort: 'pipeline_crm_sort',
};

const STAGES = [
  { id: 1, key: 'pitching',  label: 'Pitching / Outreach', tag: '01·PITCH' },
  { id: 2, key: 'followup',  label: 'Follow-Up Pending',   tag: '02·FOLLOWUP' },
  { id: 3, key: 'scheduling',label: 'Interviews Scheduled',tag: '03·SCHEDULE' },
  { id: 4, key: 'decision',  label: 'Decision / Results',  tag: '04·DECISION' },
  { id: 5, key: 'offer',     label: 'Offer Comparison',    tag: '05·OFFER' },
];
