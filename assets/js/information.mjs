import { fmtDay, isLocal, lang, t } from './locale.mjs';
import { app } from './ui.mjs';

/* ---------- guide for voters, and what's new ---------- */
const prose = (h1, kick, body) => { app.innerHTML = `<a class="back" href="#">${t('back')}</a><article class="prose"${isLocal(lang) ? ' lang="fil"' : ''}><p class="kick">${kick}</p><h1>${h1}</h1>${body}</article>`; };   // guide and updates are not translated into the drafts yet
function guidePage() {
  const fil = lang !== 'en';   // local languages show the Filipino text until translated
  const steps = fil ? [
    ['Hanapin ang mambabatas mo', 'I-type ang probinsya o lungsod mo sa paghahanap sa itaas. Lalabas ang 24 na senador, para sa buong bansa, at ang kinatawan mo sa Kamara. Kung maraming distrito ang lungsod o probinsya, hanapin ang sa iyo ayon sa barangay o bayan.', '#', 'Pumunta sa paghahanap'],
    ['Tingnan kung may kaso', 'Nakasulat sa itaas ng bawat profile: nahatulan, nakabinbin, na-dismiss o napawalang-sala o napagpasyahan, walang nakitang kaso, o hindi pa nasusuri. Ang "walang nakitang kaso" ay nangangahulugang wala kaming nakita, hindi na wala talaga. Paratang lang ang kaso hangga\'t walang desisyon ang korte.', '#mga-kaso', 'Lahat ng may kaso'],
    ['Alamin kung ano ang ginawa nila', 'Sa "Panukala" at "Batas" makikita ang mga inihain nilang panukala at alin ang naging batas. Tingnan kung pambansa ang batas (para sa lahat) o lokal (isang paaralan, kalsada o ospital). Ihambing sila sa iisang termino sa "Ranggo".', '#senado', 'Ihambing ang mga senador'],
    ['Tingnan ang karera nila', 'Sa "Karera": ang mga halalan mula 2001 na naitugma namin sa kanila, nanalo man o natalo (Senado mula 2010), at ang mga termino nila sa Kongreso. Maaaring may kulang.', '', ''],
    ['Tingnan ang yaman (senador)', 'Sa "SALN": ang idineklarang yaman ng senador. Tanungin kung tugma ito sa sahod nila.', '', '']
  ] : [
    ['Find your lawmakers', 'Type your province or city in the search at the top. You get the 24 senators, who serve the whole country, and your House representative. A big city or province has several districts: find yours by barangay or town.', '#', 'Go to search'],
    ['Check for court cases', 'The label at the top of each profile says it in words: convicted, pending, dismissed, acquitted or decided, no case found, or not yet checked. "No case found" means our search found none, not that there is none. A case is only an allegation until a court decides it.', '#mga-kaso', 'Everyone with a case'],
    ['See what they did', 'Under "Bills" and "Laws" you see the bills they filed and which became law. Check whether a law is national (for everyone) or local (one school, road or hospital). Compare lawmakers in the same term under "Rank by bills".', '#senado', 'Compare the senators'],
    ['Look at their career', 'Under "Career": the elections since 2001 we could match to them, won or lost (Senate races from 2010), and their terms in Congress. Some races may be missing.', '', ''],
    ['Look at their wealth (senators)', 'Under "SALN": what the senator declared they own. Ask whether it fits their pay.', '', '']];
  const asks = fil ? ['Anong batas mo ang nakatulong sa amin dito? Pambansa ba o lokal?', 'May kaso ka ba? Ano ang status nito ngayon?', 'Ilang taon ka nang nasa puwesto, at ano ang nagbago?', 'Saan galing ang yaman mo?']
    : ['Which of your laws helped us here? Was it national or local?', 'Do you have a court case? Where does it stand now?', 'How long have you held office, and what changed?', 'Where does your wealth come from?'];
  prose(fil ? 'Paano gamitin ang Sino Sila? sa pagpili' : 'How to use Sino Sila? when you choose', fil ? 'Gabay sa botante' : 'A guide for voters',
    `<p class="lede">${fil ? 'Limang hakbang, ilang minuto lang. Lahat ng nakasulat dito ay may link sa pinagmulan.' : 'Five steps, a few minutes. Everything on the site links to where it came from.'}</p>
    <ol class="steps">${steps.map(([h, p, href, cta]) => `<li><h2>${h}</h2><p>${p}</p>${href ? `<a href="${href}">${cta} →</a>` : ''}</li>`).join('')}</ol>
    <h2>${fil ? 'Mga tanong para sa kandidato' : 'Questions to ask a candidate'}</h2><ul class="asks">${asks.map(a => `<li>${a}</li>`).join('')}</ul>
    <p class="note">${fil ? 'Dami ang ipinapakita ng bilang ng panukala, hindi kalidad. Gamitin ito para magtanong, hindi bilang marka.' : 'Bill counts show volume, not quality. Use them to ask questions, not as a score.'}</p>`);
}
function newsPage() {
  const fil = lang !== 'en';   // local languages show the Filipino text until translated
  const E = (date, items) => `<section class="rel"><h2><time>${fmtDay(date)}</time></h2><ul>${items.map(([h, p, href]) => `<li><b>${href ? `<a href="${href}">${h}</a>` : h}</b><br>${p}</li>`).join('')}</ul></section>`;
  const asked = `<span class="pill">${fil ? 'Mungkahi ng mambabasa' : 'Readers asked'}</span> `;
  prose(fil ? 'Ano ang bago' : "What's new", 'Sino Sila?', `<p class="lede">${fil ? 'Ang mga idinagdag at pinahusay, pinakabago muna. Marami rito ay galing sa mga komento ninyo sa BetterGov.PH. Salamat!' : 'What we added and improved, newest first. Much of it came from your comments in the BetterGov.PH group. Salamat!'}</p>`
    + E('2026-11-25', fil ? [
      [asked + 'Lahat ng may kaso sa iisang pahina', 'Bawat senador at kinatawan na may nakatalang kaso, may filter ayon sa status (nakabinbin, may hatol, na-dismiss) at uri (plunder, graft, malversation, flood control at iba pa).', '#mga-kaso'],
      [asked + 'Ranggo ayon sa termino', 'Sa "Ranggo", pumili ng Kongreso mula ika-13 hanggang ika-20 para ihambing sila sa iisang panahon: inihain, pumasa, at naging batas.', '#senado'],
      [asked + 'Pambansa o lokal na batas', 'Bawat batas ay may tatak: pambansa, lokal (isang paaralan, ospital o kalsada), prangkisa ng kumpanya, o araw ng paggunita, at kung nag-aamyenda ito ng ibang batas. May bilang din sa bawat profile.', ''],
      [asked + 'Gabay sa botante', 'Limang hakbang at mga tanong para sa kandidato, sa simpleng salita.', '#gabay'],
      ['Anim pang wika (draft)', 'Bisaya, Ilokano, Hiligaynon, Winaray, Bikol at Kapampangan: piliin sa itaas. Draft pa ito; tulungan kaming itama.', '']]
    : [
      [asked + 'Everyone with a court case, on one page', 'Every senator and representative with a case on record, filtered by status (pending, convicted, dismissed) and kind (plunder, graft, malversation, flood control and more).', '#mga-kaso'],
      [asked + 'Rankings by term', 'Under "Rank by bills", pick a Congress from the 13th to the 20th to compare lawmakers over the same period: filed, passed and became law.', '#senado'],
      [asked + 'National or local laws', 'Every law now carries a tag: national, local (one school, hospital or road), a company franchise, or a commemorative day, and whether it amends another law. Each profile counts them.', ''],
      [asked + 'A guide for voters', 'Five steps and questions to ask a candidate, in plain words.', '#gabay'],
      ['Six more languages (draft)', 'Bisaya, Ilokano, Hiligaynon, Winaray, Bikol and Kapampangan: pick one at the top. These are drafts; help us correct them.', '']])
    + E('2026-11-24', fil ? [
      ['Karera sa puwesto', 'Bawat halalan mula 2001, nanalo man o natalo, at ang mga termino sa Kongreso. Mula sa BetterGov Dynasties at open-congress-data.', ''],
      ['Mas mahusay na paghahanap', 'Lumalabas agad ang resulta habang nagta-type, nakagrupo ayon sa lugar, Senado, Kamara at party-list. May sariling paghahanap din ang bawat pahina.', '#']]
    : [
      ['Career in elected office', 'Every election since 2001, won or lost, and terms in Congress. From BetterGov Dynasties and open-congress-data.', ''],
      ['Better search', 'Results show as you type, grouped by place, Senate, House and party-list. Each chamber page has its own filter too.', '#']])
    + E('2026-11-23', fil ? [
      [asked + 'Mga panukala sa bawat termino', 'Lahat ng panukala ng mambabatas mula ika-13 Kongreso, may filter ayon sa termino at link sa bersyon ng kabilang kapulungan.', ''],
      ['Baligtad na ayos sa ranggo', 'Pinakamarami o pinakakaunti muna.', '#kamara']]
    : [
      [asked + 'Bills in every term', 'Every bill a lawmaker filed since the 13th Congress, with a term filter and a link to the other chamber\'s version.', ''],
      ['Reverse the ranking', 'Most first or fewest first.', '#kamara']])
    + `<section class="rel"><h2>${fil ? 'Hindi pa, at bakit' : 'Not yet, and why'}</h2><ul>${(fil ? [
      ['SALN ng mga kinatawan', 'Senador, Pangulo at Pangalawang Pangulo lang ang nasa SALN Tracker ng BetterGov. Idadagdag namin kapag may mapagkukunan na.'],
      ['Ugnayan sa kontratista o mining', 'Mula lang dapat sa opisyal na rekord (SALN, SEC, DPWH). Inihahanda pa ang paraan.'],
      ['Sino ang nanguna sa bawat panukala', 'Sponsor, chair ng komite, o pumirma lang: kinokolekta pa mula sa rekord ng Senado at Kamara.'],
      ['Ano ang talagang binago ng batas', 'Kailangan muna ng patas at malinaw na paraan, hindi opinyon namin.'],
      ['Sino ang nakakulong', 'Itatala lang mula sa rekord ng korte o kulungan.'],
      ['Mga kandidato sa 2028', 'Pagkalabas ng listahan ng COMELEC (bandang Oktubre 2027).']] : [
      ["Representatives' SALN", "BetterGov's SALN Tracker covers only senators, the President and the Vice President. We will add House members once there is a source."],
      ['Links to contractors or mining firms', 'Only from official records (SALN, SEC, DPWH). We are still working out a fair method.'],
      ['Who led each bill', 'Sponsor, committee chair, or only signed on: still being collected from Senate and House records.'],
      ['What a law actually changed', 'This needs a fair, clear method first, not our opinion.'],
      ['Who is in detention', 'Only from a court or jail record.'],
      ['Candidates for 2028', 'Once COMELEC publishes the list (around October 2027).']]).map(([h, p]) => `<li><b>${h}</b><br>${p}</li>`).join('')}</ul></section>
    <p class="note">${fil ? 'May mungkahi? Pindutin ang "Report an error" sa ibaba, o magbukas ng issue sa' : 'Have an idea? Tap "Report an error" below, or open an issue on'} <a href="https://github.com/lslaoang/sinu-sila" target="_blank" rel="noopener">GitHub ↗</a>.</p>`);
}

export { guidePage, newsPage, prose };
