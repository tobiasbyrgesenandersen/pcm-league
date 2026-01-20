// app.js
import { loadAllFromSheets, keyBy, getCountry, getDivision, SEASON_YEAR } from "./sheets.js";

const $ = (id) => document.getElementById(id);

function matchesTeam(t, q, divId) {
  const s = (q || "").trim().toLowerCase();
  const okQ =
    !s ||
    (t.team_name || "").toLowerCase().includes(s) ||
    (t.team_id || "").toLowerCase().includes(s) ||
    (t.sponsor || "").toLowerCase().includes(s);

  const okDiv = !divId || String(t.division_id || "").trim() === String(divId).trim();
  return okQ && okDiv;
}

function renderDivisionFilter(divisions) {
  const sel = $("divisionFilter");
  const current = sel.value;

  const sorted = [...divisions].sort((a, b) => {
    const ar = Number(a.division_rank || 999);
    const br = Number(b.division_rank || 999);
    if (ar !== br) return ar - br;
    return (a.division_name || "").localeCompare(b.division_name || "");
  });

  sel.innerHTML =
    `<option value="">All divisions</option>` +
    sorted
      .map((d) => `<option value="${d.division_id}">${d.division_name || `Division ${d.division_id}`}</option>`)
      .join("");

  sel.value = current;
}

function renderStats(teams, riders, divisions) {
  $("statTeams").textContent = String(teams.length);
  $("statRiders").textContent = String(riders.length);
  $("statDiv").textContent = String(divisions.length || 0);
}

function renderTeams(teams, riders, divisionsById, countriesById) {
  const q = $("teamSearch").value || "";
  const divId = $("divisionFilter").value || "";

  const grid = $("teamsGrid");
  grid.innerHTML = "";

  const ridersByTeam = new Map();
  for (const r of riders) {
    const id = (r.team_id || "").trim();
    if (!id) continue;
    ridersByTeam.set(id, (ridersByTeam.get(id) || 0) + 1);
  }

  const filtered = teams.filter((t) => matchesTeam(t, q, divId));

  for (const t of filtered) {
    const a = document.createElement("a");
    a.className = "card teamCard";
    a.href = `./team.html?team_id=${encodeURIComponent(t.team_id)}`;

    const count = ridersByTeam.get(t.team_id) || 0;

    const division = getDivision(divisionsById, t.division_id);
    const divLabel = division?.division_name || `Division ${t.division_id || "—"}`;

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

    a.innerHTML = `
      <div class="teamCard__top">
        <div class="teamCard__left">
          <div class="teamCard__nameRow">
            <div class="teamCard__name">${t.team_name || t.team_id}</div>
            <span class="teamCard__divLink" title="View division">${divLabel}</span>
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
          ${
            jerseyUrl
              ? `<img src="${jerseyUrl}" alt="${t.team_name || "Team"} jersey" loading="lazy" />`
              : `<div class="teamCard__jerseyFallback">J</div>`
          }
        </div>
      </div>

      <div class="teamCard__bar"><div style="background:${barStyle}"></div></div>
    `;

    const divSpan = a.querySelector(".teamCard__divLink");
    if (divSpan && t.division_id) {
      divSpan.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        location.href = `./division.html?division_id=${encodeURIComponent(t.division_id)}`;
      });
    }

    grid.appendChild(a);
  }

  if (filtered.length === 0) {
    grid.innerHTML =
      `<div class="card" style="padding:14px;">` +
      `<strong>No teams matched.</strong><div class="muted" style="margin-top:6px;">Try clearing filters.</div>` +
      `</div>`;
  }
}

function populateSignupTeams(teams) {
  const sel = $("teamSelect");
  const available = teams.filter((t) => String(t.manager || "").trim().toLowerCase() === "unknown");

  sel.innerHTML =
    `<option value="">Select an available team…</option>` +
    available
      .sort((a, b) => (a.team_name || "").localeCompare(b.team_name || ""))
      .map((t) => `<option value="${t.team_id}">${t.team_name || t.team_id}</option>`)
      .join("");

  if (available.length === 0) {
    sel.innerHTML = `<option value="">No free teams found</option>`;
  }
}

function wireSignup() {
  const form = $("signupForm");
  const status = $("signupStatus");
  const details = $("signupDetails");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const payload = Object.fromEntries(fd.entries());

    const manager = String(payload.manager_name || "").trim();
    const email = String(payload.email || "").trim();
    const teamId = String(payload.team_id || "").trim();
    const agree = payload.agree;

    if (!manager || !email || !teamId || !agree) {
      status.textContent = "Please fill required fields and accept the rules.";
      return;
    }

    const record = {
      manager_name: manager,
      email,
      team_id: teamId,
      note: String(payload.note || ""),
      season: SEASON_YEAR,
      submitted_at: new Date().toISOString(),
    };

    const key = "pcm_signups";
    const cur = JSON.parse(localStorage.getItem(key) || "[]");
    cur.push(record);
    localStorage.setItem(key, JSON.stringify(cur));

    form.reset();
    status.textContent = "Signup submitted ✅ (saved locally for now).";

    if (details && typeof details.open === "boolean") details.open = false;
  });
}

async function load() {
  $("year").textContent = String(new Date().getFullYear());
  $("seasonPill").textContent = `Season ${SEASON_YEAR}`;
  $("dataFooter").textContent = `Database: Local CSV ✓`;

  const { teams, riders, divisions, countries } = await loadAllFromSheets();

  const divisionsById = keyBy(divisions, "division_id");
  const countriesById = keyBy(countries, "country_id");

  renderDivisionFilter(divisions);
  renderStats(teams, riders, divisions);
  renderTeams(teams, riders, divisionsById, countriesById);

  populateSignupTeams(teams);
  wireSignup();

  $("teamSearch").addEventListener("input", () => renderTeams(teams, riders, divisionsById, countriesById));
  $("divisionFilter").addEventListener("change", () => renderTeams(teams, riders, divisionsById, countriesById));
}

load().catch((err) => {
  console.error(err);
  alert(`Could not load data: ${err.message}`);
});
