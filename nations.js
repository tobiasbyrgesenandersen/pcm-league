// nations.js
import {
  loadAllFromSheets,
  keyBy,
  computeOverallFromStats,
  getCountry,
} from "./sheets.js";

const $ = (id) => document.getElementById(id);

function top8Strength(riders) {
  const scored = riders
    .map(r => computeOverallFromStats(r))
    .filter(v => v != null)
    .sort((a,b)=>b-a)
    .slice(0,8);

  if (!scored.length) return 0;
  const avg = scored.reduce((a,b)=>a+b,0)/scored.length;
  return Math.round(avg);
}

async function load() {
  $("year").textContent = String(new Date().getFullYear());

  const { riders, countries } = await loadAllFromSheets();
  const countriesById = keyBy(countries, "country_id");

  // group riders by country_id
  const byCountry = new Map();
  for (const r of riders) {
    const cid = String(r.country || "").trim();
    if (!cid) continue;
    if (!byCountry.has(cid)) byCountry.set(cid, []);
    byCountry.get(cid).push(r);
  }

  const ranked = Array.from(byCountry.entries()).map(([cid, list]) => {
    const strength = top8Strength(list);
    return { cid, strength, count: list.length };
  });

  ranked.sort((a, b) => b.strength - a.strength);

  const grid = $("nationGrid");
  grid.innerHTML = "";

  for (const item of ranked) {
    const c = getCountry(countriesById, item.cid);
    const a = document.createElement("a");
    a.className = "card nationCard";
    a.href = `./nation.html?country_id=${encodeURIComponent(item.cid)}`;

    a.innerHTML = `
      <div class="nationCard__top">
        <div class="nationCard__left">
          ${c?.flag ? `<img class="flag" src="${c.flag}" alt="" />` : ""}
          <div>
            <div class="nationCard__name">${c?.country_name || `Country ${item.cid}`}</div>
            <div class="muted" style="margin-top:2px;">${item.count} riders · Top 8 strength: <strong>${item.strength}</strong></div>
          </div>
        </div>
        <div class="nationCard__rank">#${ranked.indexOf(item) + 1}</div>
      </div>
      <div class="teamCard__bar"><div style="background: linear-gradient(90deg, var(--hot), var(--accent)); opacity:0.85;"></div></div>
    `;

    grid.appendChild(a);
  }

  if (!ranked.length) {
    grid.innerHTML = `<div class="card" style="padding:14px;">
      <strong>No countries found.</strong>
      <div class="muted" style="margin-top:6px;">Check country.csv and riders.csv country_id links.</div>
    </div>`;
  }
}

load().catch((err) => {
  console.error(err);
  alert(`Could not load national teams: ${err.message}`);
});
