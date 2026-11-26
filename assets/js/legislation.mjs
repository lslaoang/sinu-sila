import { bills, fetchOptionalJson, hb, laws } from './data.mjs';
import { state } from './state.mjs';

const BUCKETS = [
  ['Signed into law', '#16a34a', s => s === 'APPROVED BY THE PRESIDENT OF THE PHILIPPINES'],
  ['Moving along', '#2563eb', s => /SECOND READING|CONFERE|PASSED BY BOTH|ENROLLED|PENDING IN THE HOUSE/.test(s)],
  ['In committee', '#9ca3af', s => s === 'PENDING IN THE COMMITTEE'],
  ['Merged into another bill', '#d97706', s => s.startsWith('CONSOLIDATED')],
  ['Withdrawn', '#dc2626', s => s === 'WITHDRAWN']];
const bucketOf = st => (BUCKETS.find(b => b[2](st)) || ['Other', '#6b7280'])[0];

const ROLES = [['author', 'Author'], ['coAuthors', 'Co-author'], ['coSponsors', 'Co-sponsor']];
const rolesOf = id => laws.bills.map(l => ({...l, roles: ROLES.filter(([k]) => [].concat(l[k]).includes(id)).map(r => r[1]), law: !/^Enrolled/.test(l.status)})).filter(l => l.roles.length);
const lawCount = id => rolesOf(id).filter(l => l.law).length;
const billCount = id => bills[id]?.total || 0;
// filed -> passed their chamber -> became law. Senate: our Senate data (author role). House: BatasWatch principal authors.
const SEN_PASSED = /HOUSE OF REP|BOTH HOUSES|PRESIDENT|CONFEREN|LAPSED|ENROLLED/;
let terms = null;   // data/billterms.json: per-term counts before the 20th Congress, fetched when a past term is picked
const loadTerms = () => terms ? Promise.resolve(terms) : fetchOptionalJson('data/billterms.json', {people: {}}).then(j => terms = j);
const termRec = o => { const x = terms?.people?.[o.id]?.[o.body === 'house' ? 'H' : 'S']?.[state.rterm]; return x ? {filed: x[0], passed: x[1], law: x[2]} : null; };
const rec = o => { if (o.body !== 'house') { const b = bills[o.id];
    return {filed: b?.total || 0, passed: b ? Object.entries(b.byStatus).reduce((n, [k, v]) => n + (SEN_PASSED.test(k) ? v : 0), 0) : 0,
      law: laws.bills.filter(l => [].concat(l.author).includes(o.id) && !/^Enrolled/.test(l.status)).length}; }
  const m = hb.members[o.id]; return m ? {filed: m[0], lead: m[1], passed: m[2], law: m[3]} : null; };

export { BUCKETS, billCount, bucketOf, lawCount, loadTerms, rec, rolesOf, termRec };
