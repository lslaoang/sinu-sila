import { cases } from './data.mjs';

const TRACKS = [['convicted', 'Convicted in a case', '#8e1b1b'], ['pending', 'Pending case', '#e29a1f'], ['resolved', 'Dismissed, acquitted or decided', '#2b55a6'], ['none', 'No case found', '#2f7d4a'], ['unchecked', 'Not yet checked', '#8a8373']];

const trackOf = id => { const l = cases.cases[id] || [];
  if (l.some(c => c.status === 'convicted')) return 'convicted';
  if (l.some(c => ['filed', 'pending', 'suspended', 'appealed'].includes(c.status))) return 'pending';
  return l.length ? 'resolved' : cases._meta.checked[id] ? 'none' : 'unchecked'; };
const trackRank = id => TRACKS.findIndex(t => t[0] === trackOf(id));
const trackLabel = id => TRACKS[trackRank(id)][1], trackColor = id => TRACKS[trackRank(id)][2];
const CHECKED = ['convicted', 'pending', 'resolved', 'none'], ALLTR = [...CHECKED, 'unchecked'];

export { ALLTR, CHECKED, TRACKS, trackColor, trackLabel, trackOf, trackRank };
