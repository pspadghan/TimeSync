// Gives every power in the records one fixed colour by family, kept in
// src/data/records/powers.json:
//   indic     shades of saffron   Indian dynasties, kingdoms and the Republic of India
//   islamic   shades of green     sultanates and Muslim-ruled states
//   european  shades of blue      European companies and crowns
//   culture   pale clay           archaeological cultures (not states; never spread by nearness)
//   other     earth tones         everything else
// Within a family, shades step through lightness and a narrow band of hue so neighbours can
// be told apart. A power's family is recorded in the file; new names are classified by the
// table below and reported so they can be reviewed.
// Run after adding powers: node scripts/assign-colours.mjs
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'src', 'data', 'records');
const file = path.join(dir, 'powers.json');
const names = [...JSON.parse(readFileSync(path.join(dir, 'control.json'), 'utf8')), ...JSON.parse(readFileSync(path.join(dir, 'unit-rules.json'), 'utf8'))].map((c) => c.polity);
const known = new Map((existsSync(file) ? JSON.parse(readFileSync(file, 'utf8')) : []).map((p) => [p.name, p.family]));

const ISLAMIC = /sultanate|mughal|sur empire|ghaznavid|ghurid|bahmani|khandesh|nizam|adil shahi|qutb shahi|awadh|nawab|durrani|pakistan|bangladesh|afghan|maldives|arab|nawabs|khanate/i;
const EUROPEAN = /portuguese|english|british|french|dutch|danish/i;
const OTHER = /achaemenid|indo-greek|kushan|indus|konbaung|toungoo|kandy|anuradhapura|polonnaruwa|kshatrapa|bhutan|sri lanka|myanmar/i;
const CULTURE = /culture|civilization/i;
const familyOf = (name) => (CULTURE.test(name) ? 'culture' : ISLAMIC.test(name) ? 'islamic' : EUROPEAN.test(name) ? 'european' : OTHER.test(name) ? 'other' : 'indic');

// hue band, saturation and lightness steps per family
const FAMILY = {
  indic: { hues: [30, 22, 38, 16, 34, 26], sat: [0.92, 0.78, 0.85], light: [0.52, 0.42, 0.62, 0.36, 0.7] },
  islamic: { hues: [135, 150, 120, 162, 108, 142], sat: [0.55, 0.42, 0.65], light: [0.36, 0.48, 0.28, 0.58, 0.42] },
  european: { hues: [215, 232, 200, 248, 262], sat: [0.5, 0.4, 0.6], light: [0.45, 0.58, 0.36] },
  culture: { hues: [28, 34, 22], sat: [0.28, 0.2], light: [0.6, 0.5, 0.68] },
  other: { hues: [20, 40, 0, 300], sat: [0.18, 0.12, 0.25], light: [0.42, 0.55, 0.32] },
};

function hex(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0');
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}

const seen = {};
const powers = [...new Set(names)].map((name) => {
  const family = known.get(name) ?? familyOf(name);
  if (!known.has(name)) console.log(`new: ${name} -> ${family}`);
  const i = (seen[family] = (seen[family] ?? -1) + 1);
  const f = FAMILY[family];
  return { name, family, colour: hex(f.hues[i % f.hues.length], f.sat[Math.floor(i / f.hues.length) % f.sat.length], f.light[i % f.light.length]) };
});
// The Republic of India takes the saffron of the national flag.
const india = powers.find((p) => p.name === 'Republic of India');
if (india) india.colour = '#ff9933';
writeFileSync(file, '[\n' + powers.map((p) => '  ' + JSON.stringify(p)).join(',\n') + '\n]\n');
console.log(`${powers.length} powers: ${Object.entries(seen).map(([k, v]) => `${k} ${v + 1}`).join(', ')}`);
