// team.js
import {
  loadAllFromSheets,
  toNumber,
  initials,
  normalizeRegion,
  computeOverallFromStats,
  computeRiderType,
  keyBy,
  getCountry,
  getDivision,
  clamp,
} from "./sheets.js";

const $ = (id) => document.getElementById(id);

function getTeamId() {
  const url = new URL(location.href);
  return url.searchParams.get("team_id") || "";
}

function avg(nums) {
  const xs = nums.filter((n) => typeof n === "number" && Number.isFinite(n));
  if (!xs.length) return null;
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function riderFullName(r) {
  return `${(r.firstname || "").trim()} ${(r.lastname || "").trim()}`.trim() || r.rider_id;
}

function sortByLevelDesc(list) {
  const copy = [...list];
  copy.sort((a, b) => (b._overall ?? -1) - (a._overall ?? -1));
  return copy;
}

/* ---------- Radar ---------- */

function normalizeStat(val) {
  // normalize 55..86 => 0..1
  const min = 55;
  const max = 86;
  const v = clamp(val ?? min, min, max);
  return (v - min) / (max - min);
}

function buildRadarSVG(values, labels) {
  const size = 260;
  const cx = size / 2;
  const cy = size / 2;
  const r = 92;
  const levels = 4;

  const angleFor = (i) => (-Math.PI / 2) + (i * (2 * Math.PI / values.length));

  const point = (rr, i) => {
    const a = angleFor(i);
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)];
  };

  const polyPoints = values
    .map((v, i) => {
      const [x, y] = point(r * v, i);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const rings = Array.from({ length: levels }, (_, idx) => {
    const rr = r * ((idx + 1) / levels);
    const pts = values
      .map((_, i) => point(rr, i).map((n) => n.toFixed(1)).join(","))
      .join(" ");
    return `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.10)" stroke-width="1" />`;
  }).join("");

  const axes = values
    .map((_, i) => {
      const [x, y] = point(r, i);
      return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" stroke="rgba(255,255,255,0.10)" />`;
    })
    .join("");

  const textLabels = labels
    .map((lab, i) => {
      const [x, y] = point(r + 22, i);
      return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" fill="rgba(232,238,252,0.78)" font-size="11" font-weight="800">${lab}</text>`;
    })
    .join("");

  const baselinePct = 0; // visual reference at center
  const baselinePoints = values
    .map((_, i) => {
      const [x, y] = point(r * baselinePct, i);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return `
  <svg viewBox="0 0 ${size} ${size}" class="radarSvg" role="img" aria-label="Team strengths radar">
    ${rings}
    ${axes}
    <polygon points="${baselinePoints}" fill="rgba(255,255,255,0.05)" stroke="rgba(255,255,255,0.10)" />
    <polygon points="${polyPoints}" fill="rgba(54,211,255,0.18)" stroke="rgba(54,211,255,0.85)" stroke-width="2" />
    <circle cx="${cx}" cy="${cy}" r="2" fill="rgba(255,255,255,0.35)" />
    ${textLabels}
  </svg>`;
}

function renderTeamRadar(roster) {
  const mount = $("radarMount");
  if (!mount) return;

  const statKeys = [
    ["Flat", "stat_flat"],
    ["Mountain", "stat_mountain"],
    ["Hill", "stat_hill"],
    ["TT", "stat_timetrial"],
    ["Sprint", "stat_sprint"],
    ["Cobbles", "stat_cobbles"],
  ];

  const averages = statKeys.map(([, key]) => {
    const vals = roster.map((r) => toNumber(r[key])).filter((v) => v != null);
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 55;
  });

  const normalized = averages.map(normalizeStat);
  const labels = statKeys.map(([l]) => l);

  mount.innerHTML = buildRadarSVG(normalized, labels);
}

/* ---------- UI ---------- */

function renderCaptains(roster) {
  const wrap = $("captainsRow");
  wrap.innerHTML = "";

  const top3 = sortByLevelDesc(roster).slice(0, 3);

  for (const r of top3) {
    const a = document.createElement("a");
    a.className = "captainPill";
    a.href = `./rider.html?rider_id=${encodeURIComponent(r.rider_id)}`;

    const icon = document.createElement("span");
    icon.className = "captainIcon";

    const portraitUrl = (r.portrait || "").trim();
    if (portraitUrl) {
      const img = document.createElement("img");
      img.src = portraitUrl;
      img.alt = `${riderFullName(r)} portrait`;
      img.loading = "lazy";
      icon.appendChild(img);
    } else {
      icon.textContent = initials(r.firstname, r.lastname);
    }

    const text = document.createElement("span");
    text.className = "captainText";

    const name = document.createElement("span");
    name.className = "captainName";
    name.textContent = riderFullName(r);

    const lvl = document.createElement("span");
    lvl.className = "captainLvl";
    lvl.textContent =
      r._overall != null ? `LVL ${r._overall} · ${r._type}` : `LVL — · ${r._type}`;

    text.appendChild(name);
    text.appendChild(lvl);

    a.appendChild(icon);
    a.appendChild(text);

    wrap.appendChild(a);
  }
}

function applyTeamUI(team, roster, divisionsById, countriesById) {
  $("year").textContent = String(new Date().getFullYear());
  document.title = `${team.team_name || team.team_id} · PCM League`;

  $("teamName").textContent = team.team_name || team.team_id;

  const division = getDivision(divisionsById, team.division_id);
  const divLink = $("teamDivisionLink");
  divLink.textContent = division?.division_name || `Division ${team.division_id || "—"}`;
  divLink.href = team.division_id
    ? `./division.html?division_id=${encodeURIComponent(team.division_id)}`
    : "#";

  const country = getCountry(countriesById, team.country);
  $("teamCountry").textContent = country?.country_name || "—";
  $("teamSponsor").textContent = team.sponsor || "—";
  $("teamMeta").textContent = `Manager: ${team.manager || "—"}`;

  const flagEl = $("teamFlag");
  if (country?.flag) {
    flagEl.src = country.flag;
    flagEl.style.display = "inline-block";
  }

  const sw = $("teamSwatch");
  if (team.jersey_primary) sw.style.background = team.jersey_primary;

  // Jersey image
  const jerseyImg = $("jerseyImg");
  const jerseyPreview = $("jerseyPreview");
  const jerseyUrl = (team.jersey || "").trim();
  if (jerseyUrl) {
    jerseyImg.src = jerseyUrl;
    jerseyImg.style.display = "block";
  } else {
    jerseyPreview.innerHTML = `<div class="muted" style="padding:14px;">No jersey image link found.</div>`;
  }

  // Color dots
  const p = (team.jersey_primary || "").trim() || "#ffffff";
  const s = (team.jersey_secondary || "").trim() || "#111827";
  $("primaryDot").style.background = p;
  $("secondaryDot").style.background = s;

  // KPIs
  $("kpiRiders").textContent = String(roster.length);

  const avgOverall = avg(roster.map((r) => r._overall).filter((v) => v != null));
  $("kpiAvgLevel").textContent = avgOverall == null ? "—" : Math.round(avgOverall).toString();

  const avgAge = avg(roster.map((r) => toNumber(r.age)).filter((v) => v != null));
  $("kpiAvgAge").textContent = avgAge == null ? "—" : avgAge.toFixed(1);

  const budget = toNumber(team.budget);
  $("kpiBudget").textContent =
    budget == null
      ? "—"
      : new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(budget);
}

function renderRoster(roster) {
  const q = ($("search").value || "").trim().toLowerCase();
  const type = $("typeFilter").value || "";

  const el = $("roster");
  el.innerHTML = "";

  const filtered = roster.filter((r) => {
    const name = riderFullName(r).toLowerCase();
    const nat = String(r.country || "").toLowerCase();
    const region = normalizeRegion(r.region).toLowerCase();
    const okQ = !q || name.includes(q) || nat.includes(q) || region.includes(q);
    const okT = !type || r._type === type;
    return okQ && okT;
  });

  const sorted = sortByLevelDesc(filtered);

  for (const r of sorted) {
    const a = document.createElement("a");
    a.className = "card rCard";
    a.href = `./rider.html?rider_id=${encodeURIComponent(r.rider_id)}`;

    const portrait = document.createElement("div");
    portrait.className = "rPortrait";

    const portraitUrl = (r.portrait || "").trim();
    if (portraitUrl) {
      const img = document.createElement("img");
      img.src = portraitUrl;
      img.alt = `${riderFullName(r)} portrait`;
      img.loading = "lazy";
      portrait.appendChild(img);
    } else {
      portrait.textContent = initials(r.firstname, r.lastname);
    }

    const meta = document.createElement("div");

    const name = document.createElement("div");
    name.className = "rName";
    name.textContent = riderFullName(r);

    const sub = document.createElement("div");
    sub.className = "rMeta";

    const age = r.age ? `Age ${r.age}` : "Age —";
    const lvl = r._overall != null ? `LVL ${r._overall}` : "LVL —";

    sub.textContent = `${age} · ${lvl}`;

    meta.appendChild(name);
    meta.appendChild(sub);

    const tag = document.createElement("span");
    tag.className = "rTag";
    tag.textContent = r._type || "All-Rounder";

    a.appendChild(portrait);
    a.appendChild(meta);
    a.appendChild(tag);

    el.appendChild(a);
  }
}

function exportTeamJSON(team, roster) {
  const payload = JSON.stringify({ team, roster }, null, 2);
  const blob = new Blob([payload], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${team.team_id}_team.json`;
  a.click();
  URL.revokeObjectURL(url);
}

async function load() {
  const teamId = getTeamId();
  if (!teamId) {
    alert("Missing team_id in URL. Example: team.html?team_id=telekom");
    return;
  }

  const { teams, riders, divisions, countries } = await loadAllFromSheets();
  const divisionsById = keyBy(divisions, "division_id");
  const countriesById = keyBy(countries, "country_id");

  const team = teams.find((t) => String(t.team_id).trim() === String(teamId).trim());
  if (!team) throw new Error(`Team not found: ${teamId}`);

  const roster = riders
    .filter((r) => String((r.team_id || "")).trim() === String(teamId).trim())
    .map((r) => ({
      ...r,
      _overall: computeOverallFromStats(r),
      _type: computeRiderType(r),
    }));

  applyTeamUI(team, roster, divisionsById, countriesById);
  renderTeamRadar(roster);
  renderCaptains(roster);
  renderRoster(roster);

  $("search").addEventListener("input", () => renderRoster(roster));
  $("typeFilter").addEventListener("change", () => renderRoster(roster));
  $("btnExport").addEventListener("click", () => exportTeamJSON(team, roster));
}

load().catch((err) => {
  console.error(err);
  alert(`Could not load team: ${err.message}`);
});
