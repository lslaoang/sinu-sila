import { ALLTR } from './case-status.mjs';

const state = {lens: 'track', sel: 'everyone', ch: 'all', tr: new Set(ALLTR), school: null, q: '', leaders: false, sort: 'az', rank: '', rdir: 'desc', hpl: null, hp: null, hs: '', ss: '', ps: '', rterm: 20, cst: '', cg: '', cq: '', cch: ''};

const hashName = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return location.hash.slice(1); } }, onHome = () => !hashName(), onExplore = () => hashName() === 'explore';

export { hashName, onExplore, onHome, state };
