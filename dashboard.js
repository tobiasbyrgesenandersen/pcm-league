import { getSession, requireLoginOrRedirect } from "./auth.js";

// Small CSV loader (so this file works even if utils.js changes)
async function loadCSV(path) {
  const res = await fetch(path, { cache: "no-store" });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  const text = await res.text();

  const lines = text.split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCSVLine(lines[0]).map((h) => h.trim());

  return lines.slice(1).map((line) => {
    const cols = splitCSVLine(line);
    const obj = {};
    headers.forEach((h, i) => (obj[h] = (cols[i] ?? "").trim()));
    return obj;
  });
}

// Handles basic quoted commas too
function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (ch === '"') { inQ = !inQ; continue; }
    if (ch === "," && !inQ) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function $(id) { return document.getElementById(id); }
function n(v) { const x = Number(v); return Number.isFinite(x) ? x : 0; }

function formatRaceDate(yyyymmdd) {
  const s = String(yyyymmdd || "").trim();
  if (s.length !== 8) return "—";
  const y = s.slice(0,4);
  const m = s.slice(4,6);
  const d = s.slice(6,8);
  return `${y}-${m}-${d}`;
}

function calcRiderLevel(r) {
  // Uses all stat_ fields average (simple + stable). You can tune later.
  const statKeys = Object.keys(r).filter(k => k.startsWith("stat_"));
  if (statKeys.length === 0) return 0;
  const vals = statKeys.map(k => n(r[k])).filter(v => v > 0);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a,b)=>a+b,0) / vals.length);
}

function initials(first, last) {
  const f = (first || "").trim().slice(0,1).toUpperCase();
  const l = (last || "").trim().slice(0,1).toUpperCase();
  return (f + l) || "?";
}

function setDot(el, color) {
  if (!el) return;
  const c = (color || "").trim();
  el.style.background = c || "linear-gradient(135deg, var(--hot), var(--accent))";
}

function safeImg(imgEl, src) {
  if (!imgEl) return;
  if (src && String(src).trim()) {
    imgEl.src = src;
    imgEl.style.display = "block";
    imgEl.onerror = () => { imgEl.style.display = "none"; };
  } else {
    imgEl.style.display = "none";
  }
}

function sortByRaceDateAsc(a, b) {
  return n(a.race_date) - n(b.race_date);
}

async function main() {
  requireLoginOrRedirect();
  $("year").textContent = String(new Date().getFullYear());

  const session = getSession();
  $("mgrName").textContent = session.managerName || "Manager";
  $("mgrEmail").textContent = session.email || "—";

  const [teams, riders, countries, divisions, races] = await Promise.all([
    loadCSV("./data/teams.csv"),
    loadCSV("./data/riders.csv"),
    loadCSV("./data/country.csv").catch(() => []),
    loadCSV("./data/division.csv").catch(() => []),
    loadCSV("./data/races.csv").catch(() => []),
  ]);

  const team = teams.find(t => String(t.team_id) === String(session.teamId));
  if (!team) {
    // If they picked a teamId that no longer exists
    $("teamName").textContent = "Unknown Team";
    $("dashKicker").textContent = "Session found, but team missing in teams.csv";
    return;
  }

  $("teamName").textContent = team.team_name || "Team";
  $("btnTeam").href = `./team.html?id=${encodeURIComponent(team.team_id)}`;

  // Division
  const div = divisions.find(d => String(d.division_id) === String(team.division_id));
  $("divisionChip").textContent = div?.division_name ? div.division_name : "Division";

  // Country
  const country = countries.find(c => String(c.country_id) === String(team.country));
  if (country?.country_name) $("countryName").textContent = country.country_name;
  if (team.sponsor) $("sponsorName").textContent = team.sponsor;

  const flagEl = $("teamFlag");
  if (country?.flag) {
    flagEl.src = country.flag;
    flagEl.alt = country.country_name || "Country";
    flagEl.style.display = "inline-block";
  }

  // Jersey / colors
  safeImg($("jerseyImg"), team.jersey);
  setDot($("primaryDot"), team.jersey_primary);
  setDot($("secondaryDot"), team.jersey_secondary);

  // Team roster
  const roster = riders
    .filter(r => String(r.team_id || "").trim() === String(team.team_id))
    .map(r => ({ ...r, _lvl: calcRiderLevel(r) }))
    .sort((a,b) => b._lvl - a._lvl);

  $("kpiRoster").textContent = String(roster.length || 0);
  const avg = roster.length ? Math.round(roster.reduce((a,r)=>a+r._lvl,0) / roster.length) : 0;
  $("kpiAvg").textContent = String(avg || 0);

  const best = roster[0];
  $("kpiTop").textContent = best ? `LVL ${best._lvl}` : "—";

  // Free agents
  const freeAgents = riders.filter(r => !String(r.team_id || "").trim());
  $("freeAgentsCount").textContent = String(freeAgents.length);

  // Next races overall (sorted by date)
  const sortedRaces = races
    .filter(r => String(r.race_date || "").trim().length === 8)
    .sort(sortByRaceDateAsc);

  // Find first race at/after “start of season”
  // For now: just take first 3 in file order sorted
  const next3 = sortedRaces.slice(0, 3);
  $("kpiNextRace").textContent = next3[0]?.race_name ? next3[0].race_name : "—";

  const nextRacesEl = $("nextRaces");
  nextRacesEl.innerHTML = "";
  for (const r of next3) {
    const c = countries.find(x => String(x.country_id) === String(r.country));
    const d = divisions.find(x => String(x.division_id) === String(r.division_id));
    const card = document.createElement("a");
    card.className = "raceCard";
    card.href = `./race.html?id=${encodeURIComponent(r.race_id)}`;
    card.innerHTML = `
      <div>
        <div class="raceCard__title">
          <span class="raceCard__num mono">${formatRaceDate(r.race_date)}</span>
          <span>${r.race_name || "Race"}</span>
        </div>
        <div class="raceCard__meta">
          ${c?.flag ? `<img class="flag flag--sm" src="${c.flag}" alt="">` : ``}
          <span>${c?.country_name || "—"}</span>
          <span>·</span>
          <span>${d?.division_name || "—"}</span>
          <span>·</span>
          <span class="mono">${r.stage_number || "?"} stages</span>
        </div>
      </div>
      <div class="raceCard__go">→</div>
    `;
    nextRacesEl.appendChild(card);
  }

  // Top riders list
  const topEl = $("topRiders");
  topEl.innerHTML = "";
  roster.slice(0,5).forEach((r) => {
    const a = document.createElement("a");
    a.className = "rCard card";
    a.href = `./rider.html?id=${encodeURIComponent(r.rider_id)}`;

    a.innerHTML = `
      <div class="rPortrait">
        ${r.portrait ? `<img src="${r.portrait}" alt="">` : `<span>${initials(r.firstname, r.lastname)}</span>`}
      </div>
      <div style="min-width:0;">
        <div class="rName">${(r.firstname || "").trim()} ${(r.lastname || "").trim()}</div>
        <div class="rMeta">
          <span>Age ${r.age || "—"}</span>
          <span>·</span>
          <span class="mono">LVL ${r._lvl}</span>
        </div>
      </div>
      <div class="rTag">Key rider</div>
    `;
    topEl.appendChild(a);
  });
}

main().catch((err) => {
  console.error(err);
  alert("Dashboard error: " + (err?.message || err));
});
