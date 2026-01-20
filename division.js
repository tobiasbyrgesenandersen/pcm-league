// division.js
import { loadAllFromSheets, keyBy, getCountry, getDivision } from "./sheets.js";

const $ = (id) => document.getElementById(id);

function getDivisionId() {
  const url = new URL(location.href);
  return url.searchParams.get("division_id") || "";
}

function matchesTeam(t, q) {
  const s = (q || "").trim().toLowerCase();
  if (!s) return true;
  return (
    (t.team_name || "").toLowerCase().includes(s) ||
    (t.team_id || "").toLowerCase().includes(s) ||
    (t.sponsor || "").toLowerCase().includes(s)
  );
}

function renderTeams(teams, riders, divisionId, divisionsById, countriesById) {
  const q = $("teamSearch").value || "";
  const grid = $("divisionTeams");
  grid.innerHTML = "";

  const ridersByTeam = new Map();
  for (const r of riders) {
    const id = (r.team_id || "").trim();
    if (!id) continue;
    ridersByTeam.set(id, (ridersByTeam.get(id) || 0) + 1);
  }

  const filtered = teams
    .filter((t) => String(t.division_id || "").trim() === String(divisionId).trim())
    .filter((t) => matchesTeam(t, q));

  for (const t of filtered) {
    const count = ridersByTeam.get(t.team_id) || 0;

    const country = getCountry(countriesById, t.country);
    const flagUrl = country?.flag || "";

    const p = (t.jersey_primary || "").trim();
    const s = (t.jersey_secondary || "").trim();
    const barStyle = p
      ? s
        ? `linear-gradient(90deg, ${p}, ${s})`
        : p
      : `linear-gradient(90deg, var(--hot), var(--accent))`;

    const jerseyUrl = (t.jersey || "").trim();

    const a = document.createElement("a");
    a.className = "card teamCard";
    a.href = `./team.html?team_id=${encodeURIComponent(t.team_id)}`;

    a.innerHTML = `
      <div class="teamCard__top">
        <div class="teamCard__left">
          <div class="teamCard__nameRow">
            <div class="teamCard__name">${t.team_name || t.team_id}</div>
            <span class="teamCard__divChip">${getDivision(divisionsById, divisionId)?.division_name || `Division ${divisionId}`}</span>
          </div>
          <div class="teamCard__meta">
            ${flagUrl ? `<img class="flag flag--sm" src="${flagUrl}" alt="" />` : ""}
            <span>${country?.country_name || "—"}</span>
            <span>·</span>
            <span>${count} riders</span>
            <span>·</span>
            <span>${t.sponsor || "Sponsor"}</span>
          </div>
        </div>
        <div class="teamCard__jersey">
          ${jerseyUrl ? `<img src="${jerseyUrl}" alt="${t.team_name || "Team"} jersey" loading="lazy" />` : `<div class="teamCard__jerseyFallback">J</div>`}
        </div>
      </div>
      <div class="teamCard__bar"><div style="background:${barStyle}"></div></div>
    `;

    grid.appendChild(a);
  }

  if (filtered.length === 0) {
    grid.innerHTML = `<div class="card" style="padding:14px;">
      <strong>No teams found.</strong>
      <div class="muted" style="margin-top:6px;">Try a different search.</div>
    </div>`;
  }
}

async function load() {
  $("year").textContent = String(new Date().getFullYear());

  const divisionId = getDivisionId();
  if (!divisionId) {
    alert("Missing division_id in URL. Example: division.html?division_id=1");
    return;
  }

  const { teams, riders, divisions, countries } = await loadAllFromSheets();

  const divisionsById = keyBy(divisions, "division_id");
  const countriesById = keyBy(countries, "country_id");

  const div = getDivision(divisionsById, divisionId);
  document.title = `${div?.division_name || `Division ${divisionId}`} · PCM League`;

  $("divisionTitle").textContent = div?.division_name || `Division ${divisionId}`;
  $("divisionMeta").textContent = `Rank ${div?.division_rank || "—"} · ${teams.filter(t => String(t.division_id || "").trim() === String(divisionId)).length} teams`;

  renderTeams(teams, riders, divisionId, divisionsById, countriesById);
  $("teamSearch").addEventListener("input", () =>
    renderTeams(teams, riders, divisionId, divisionsById, countriesById)
  );
}

load().catch((err) => {
  console.error(err);
  alert(`Could not load division: ${err.message}`);
});
