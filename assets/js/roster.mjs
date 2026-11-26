import { data, house } from './data.mjs';
import { clean } from './text.mjs';

const firstName = n => clean(n).split(' ')[0];
const lastName = o => { const w = clean(o.name).split(' ').filter(w => !/^(Jr\.?|II|III|IV)$/.test(w)), n = w.length;   // keep particles: "Dela Rosa", "De Lima"
  return n > 2 && /^(de|dela|del|delos|de los|san|santa|sta\.)$/i.test(w[n - 2]) ? w.slice(-2).join(' ') : w[n - 1]; };
const everyone = () => [...data, ...house];
/* search: accent- and case-insensitive, every word must appear somewhere (name, nickname, place, party, position), any order */
const fold = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const matches = (o, q) => { const ws = fold(q).split(/\s+/).filter(Boolean), h = fold([o.name, o.constituency, o.place, o.party, o.position].join(' ')); return ws.every(w => h.includes(w)); };
const score = (o, q) => { const f = fold(q).trim(), n = fold(clean(o.name)); return n.startsWith(f) ? 0 : fold(lastName(o)).startsWith(f) ? 1 : n.includes(f) ? 2 : 3; };
const findAll = (xs, q) => xs.filter(o => matches(o, q)).sort((a, b) => score(a, q) - score(b, q) || lastName(a).localeCompare(lastName(b)));
const findPerson = id => data.find(o => o.id === id) || house.find(o => o.id === id);
const nameOf = id => clean((findPerson(id) || {}).name || '');
const POS = ['Senate President', 'Senate President Pro Tempore', 'Senate Majority Leader', 'Senate Minority Leader'];
const posRank = o => { const i = POS.indexOf(o.position); return i < 0 ? 9 : i; };
const isLead = o => o.body === 'house' ? o.position !== 'Representative' : posRank(o) < 9;

const districts = () => house.filter(o => o.kind !== 'party-list'), partylist = () => house.filter(o => o.kind === 'party-list');
const places = () => [...new Set(districts().map(o => o.place))].sort((a, b) => a.localeCompare(b));

export { districts, everyone, findAll, findPerson, fold, isLead, lastName, matches, nameOf, partylist, places, posRank };
