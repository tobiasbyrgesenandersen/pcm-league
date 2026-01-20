// races.js
import {
  loadAllFromSheets,
  keyBy,
  getCountry,
  getDivision,
  sortRacesCalendar,
} from "./sheets.js";

const $ = (id) => document.getElementById(id);

function matchesRace(r, q, divId) {
  const s = (q || "").trim().toLowerCase();
  const okQ = !s || (r.race_name || "").toLowerCase().includes(s) || (r.race_id || "").toLowerCase().includes(s);
  const okDiv = !divId || String(r.division_id || "").trim() === String(divId).trim();
  return okQ && okDiv;
}

function renderDivisionFilter(divisions) {
  const sel = $("divisionFilter");
  const sorted = [...divisions].sort((a, b) => Number(a.division_rank || 999) - Number(b.division_rank || 999));
  sel.innerHTML =
    `<option value="">All divisions</option>` +
    sorted.map(d => `<option value="${d.division_id}">${d.division_name}</option>`).join("");
}

function render(races, divisionsById, countriesById) {
  const q = $("search").value || "";
  const divId = $("divisionFilter").value || "";
  const list = $("raceList");
  list.innerHTML = "";

  const filtered = races.filter(r => matchesRace(r, q, divId));

  for (const r of filtered) {
    const country = getCountry(countriesById, r.country);
    const div = getDivision(divisionsById, r.division_id);

    const a = document.createElement("a");
    a.className = "raceCard";
    a.href = `./race.html?race_id=${encodeURIComponent(r.race_id)}`;

    a.innerHTML = `
      <div class="raceCard__left">
        <div class="raceCard__title">
          <span class="raceCard__num">#${r.race_id}</span>
          <span>${r.race_name || "Race"}</span>
        </div>
        <div class="raceCard__meta">
          ${country?.flag ? `<img class="flag flag--sm" src="${country.flag}" alt="" />` : ""}
          <span>${country?.country_name || "—"}</span>
          <span>·</span>
          <span>${div?.division_name || `Division ${r.division_id || "—"}`}</span>
          <span>·</span>
          <span>${r.stage_number ? `${r.stage_number} stages` : "— stages"}</span>
        </div>
      </div>
      <div class="raceCard__go">View →</div>
    `;

    list.appendChild(a);
  }

  if (!filtered.length) {
    list.innerHTML = `<div class="card" style="padding:14px;">
      <strong>No races matched.</strong>
      <div class="muted" style="margin-top:6px;">Try clearing filters.</div>
    </div>`;
  }

  $("raceMeta").textContent = `${filtered.length} races listed (calendar order).`;
}

async function load() {
  $("year").textContent = String(new Date().getFullYear());

  const { races, divisions, countries } = await loadAllFromSheets();
  const divisionsById = keyBy(divisions, "division_id");
  const countriesById = keyBy(countries, "country_id");

  renderDivisionFilter(divisions);

  const ordered = sortRacesCalendar(races);

  render(ordered, divisionsById, countriesById);

  $("search").addEventListener("input", () => render(ordered, divisionsById, countriesById));
  $("divisionFilter").addEventListener("change", () => render(ordered, divisionsById, countriesById));
}

load().catch((err) => {
  console.error(err);
  alert(`Could not load races: ${err.message}`);
});
