async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(url);
  return response.json();
}

const fetchOptionalJson = (url, fallback = null) => fetchJson(url).catch(() => fallback);

let data = [];
let house = [];
let houseMeta = {};
let bills = {};
let laws = {bills: []};
let edu = {};
let fam = {};
let cases = {_meta: {checked: {}}, cases: {}};
let saln = {_meta: {}, people: {}};
let elec = {_meta: {}, senate: {}, house: {}, partylist: {}};
let hb = {_meta: {}, members: {}};
let contacts = {_meta: {}, senate: {}};
let facts = {_meta: {}, people: {}};

let MONTHS = [];   // July 2025 (start of the 20th Congress) to the month of the latest Senate refresh; set in loadRecords()
const monthsTo = end => { const m = []; for (let y = 2025, mo = 7; `${y}-${String(mo).padStart(2, '0')}` <= end; mo === 12 ? (mo = 1, y++) : mo++) m.push(`${y}-${String(mo).padStart(2, '0')}`); return m; };

const membersAsOf = () => [bills._meta?.retrieved, houseMeta.retrieved].filter(Boolean).sort().pop();
const casesAsOf = () => [cases._meta.retrieved, ...Object.values(cases._meta.checked || {}).map(c => c.date)].filter(Boolean).sort().pop();

let hbdP;   // bill titles for House profiles (~100 KB gzipped), fetched when one opens
const loadHbd = () => hbdP ||= fetchOptionalJson('data/house_bills_detail.json');

const sbP = {}, loadSb = id => sbP[id] ||= Promise.all([fetchOptionalJson(`data/billhist/${id}.json`), loadPairs()]).then(([D, P]) => D && {...D, pairs: P?.pairs || {}});
let pairsP; const loadPairs = () => pairsP ||= fetchOptionalJson('data/bill_pairs.json');

let careerP;   // career.json: fetched when a profile opens
const loadCareer = () => careerP ||= fetchOptionalJson('data/career.json');

let budgetP;   // budget.json is ~100 KB gzipped: fetched only when a district profile opens
const loadBudget = () => budgetP ||= Promise.all(['data/budget.json', 'data/district_places.json'].map(url => fetchOptionalJson(url)))
  .then(([B, P]) => B && {...B, places: Object.fromEntries(Object.values(P?.districts || {}).map(x => [x.label, x.places]))});

async function loadRecords() {
  const [
    officials,
    houseRecords,
    billRecords,
    lawRecords,
    educationRecords,
    familyRecords,
    caseRecords,
    salnRecords,
    electionRecords,
    houseBillRecords,
    contactRecords,
    factRecords,
  ] = await Promise.all([
    fetchJson('data/officials.json'),
    fetchJson('data/house.json'),
    fetchJson('data/bills.json'),
    fetchJson('data/laws.json'),
    fetchJson('data/education.json'),
    fetchOptionalJson('data/pulitiklan.json', {links: {}}),
    fetchOptionalJson('data/cases.json', {_meta: {checked: {}}, cases: {}}),
    fetchOptionalJson('data/saln.json', saln),
    fetchOptionalJson('data/elections.json', elec),
    fetchOptionalJson('data/house_bills.json', {_meta: {}, members: {}}),
    fetchOptionalJson('data/contacts.json', {_meta: {}, senate: {}}),
    fetchOptionalJson('data/facts.json', {_meta: {}, people: {}}),
  ]);

  data = officials.map(o => ({body: 'senate', constituency: 'Nationwide', ...o}));
  house = houseRecords.people;
  houseMeta = houseRecords._meta;
  bills = billRecords;
  laws = lawRecords;
  edu = educationRecords;
  fam = familyRecords.links;
  cases = caseRecords;
  saln = salnRecords;
  elec = electionRecords;
  hb = houseBillRecords;
  contacts = contactRecords;
  facts = factRecords;
  MONTHS = monthsTo((bills._meta.retrieved || '2026-09').slice(0, 7));
}

export { MONTHS, bills, cases, casesAsOf, contacts, data, edu, elec, facts, fam, fetchOptionalJson, hb, house, houseMeta, laws, loadBudget, loadCareer, loadHbd, loadPairs, loadRecords, loadSb, membersAsOf, saln };
