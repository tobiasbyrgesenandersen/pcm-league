// rider.js
import {
  loadAllFromSheets,
  initials,
  normalizeRegion,
  formatBirthdayYYYYMMDD,
  statKeysFromRider,
  prettyStatName,
  statTierClass,
  computeOverallFromStats,
  computeRiderType,
  levelTier,
  toNumber,
  keyBy,
  getCountry,
} from "./sheets.js";

const $ = (id) => document.getElementById(id);

function getRiderId() {
  const url = new URL(location.href);
  return url.searchParams.get("rider_id");
}

function riderFullName(r) {
  const f = (r.firstname || "").trim();
  const l = (r.lastname || "").trim();
  return `${f} ${l}`.trim() || r.rider_id || "Rider";
}

function setPortrait(r) {
  const img = $("portraitImg");
  const fallback = $("portraitFallback");
  const url = (r.portrait || "").trim();

  if (url) {
    img.src = url;
    img.style.display = "block";
    fallback.style.display = "none";
  } else {
    fallback.textContent = initials(r.firstname, r.lastname);
    fallback.style.display = "block";
    img.style.display = "none";
  }
}

function setLevelUI(overall) {
  const t = levelTier(overall);

  $("kpiLevel").textContent = overall == null ? "—" : String(overall);
  $("levelBadge").textContent = overall == null ? "LVL —" : `LVL ${overall}`;

  const min = 55;
  const max = 86;
  const val = overall == null ? min : Math.max(min, Math.min(max, overall));
  const pct = Math.round(((val - min) / (max - min)) * 100);

  $("overallText").textContent = overall == null ? "—" : `${overall} (${t.label})`;

  const fill = $("levelBarFill");
  fill.style.width = `${pct}%`;

  if (overall == null) {
    fill.style.background =
      "linear-gradient(90deg, rgba(255,255,255,0.25), rgba(255,255,255,0.08))";
  } else if (overall >= 80) {
    fill.style.background =
      "linear-gradient(90deg, rgba(255,0,128,0.92), rgba(0,224,255,0.92))";
  } else if (overall >= 75) {
    fill.style.background =
      "linear-gradient(90deg, rgba(255,191,0,0.9), rgba(0,255,170,0.75))";
  } else if (overall >= 70) {
    fill.style.background =
      "linear-gradient(90deg, rgba(0,255,170,0.75), rgba(0,224,255,0.75))";
  } else if (overall >= 65) {
    fill.style.background =
      "linear-gradient(90deg, rgba(0,224,255,0.70), rgba(255,255,255,0.18))";
  } else {
    fill.style.background =
      "linear-gradient(90deg, rgba(255,255,255,0.22), rgba(255,255,255,0.10))";
  }
}

function statMeterPct(n) {
  const min = 55;
  const max = 86;
  const v = Math.max(min, Math.min(max, n));
  return Math.round(((v - min) / (max - min)) * 100);
}

function renderStats(r) {
  const grid = $("statsGrid");
  grid.innerHTML = "";

  const keys = statKeysFromRider(r)
    .map((k) => ({ k, v: toNumber(r[k]) }))
    .sort((a, b) => (b.v ?? -1) - (a.v ?? -1));

  for (const { k, v } of keys) {
    const tier = statTierClass(v);

    const tile = document.createElement("div");
    tile.className = `statTile statTile--modern ${tier}`;

    const top = document.createElement("div");
    top.className = "statTop";

    const name = document.createElement("div");
    name.className = "statTile__name";
    name.textContent = prettyStatName(k);

    const val = document.createElement("div");
    val.className = "statTile__val";
    val.textContent = v == null ? "—" : String(v);

    top.appendChild(name);
    top.appendChild(val);

    const meter = document.createElement("div");
    meter.className = "statMeter";

    const fill = document.createElement("div");
    fill.className = "statMeter__fill";
    fill.style.width = v == null ? "0%" : `${statMeterPct(v)}%`;

    meter.appendChild(fill);
    tile.appendChild(top);
    tile.appendChild(meter);

    grid.appendChild(tile);
  }
}

async function load() {
  $("year").textContent = String(new Date().getFullYear());

  const riderId = getRiderId();
  if (!riderId) {
    alert("Missing rider_id in URL. Example: rider.html?rider_id=r001");
    return;
  }

  const { teams, riders, countries } = await loadAllFromSheets();
  const countriesById = keyBy(countries, "country_id");

  const r = riders.find((x) => String(x.rider_id).trim() === String(riderId).trim());
  if (!r) throw new Error(`Rider not found: ${riderId}`);

  const teamId = (r.team_id || "").trim();
  const team = teams.find((t) => String(t.team_id).trim() === teamId);

  const name = riderFullName(r);
  document.title = `${name} · PCM League`;
  $("riderName").textContent = name;

  // Team link
  const teamName = team?.team_name || (teamId ? teamId : "Free Agent");
  const teamLink = $("teamLink");
  teamLink.textContent = teamName;
  teamLink.href = teamId ? `./team.html?team_id=${encodeURIComponent(teamId)}` : `./free-agents.html`;

  // Country
  const c = getCountry(countriesById, r.country);
  const countryName = c?.country_name || "—";
  const flag = c?.flag || "";

  const region = normalizeRegion(r.region);
  const birthday = formatBirthdayYYYYMMDD(r.birthday);

  $("riderMeta").innerHTML = `
    ${flag ? `<img class="flag" src="${flag}" alt="" />` : ""}
    <span>${countryName}</span>
    <span>·</span>
    <span>${region}</span>
    <span>·</span>
    <span>Birthday: ${birthday}</span>
    <span>·</span>
    <span>Team: ${teamId ? teamName : "Free Agent"}</span>
  `;

  setPortrait(r);

  $("kpiAge").textContent = r.age ? String(r.age) : "—";
  $("kpiHeight").textContent = r.height ? `${r.height} cm` : "—";
  $("kpiWeight").textContent = r.weight ? `${r.weight} kg` : "—";

  const overall = computeOverallFromStats(r);
  setLevelUI(overall);

  const type = computeRiderType(r);
  $("typePill").textContent = `Type: ${type}`;

  const real = String(r.real_rider || "").trim() === "1";
  $("realPill").textContent = real ? "✔ Real rider" : "✖ Fictional rider";

  renderStats(r);
}

load().catch((err) => {
  console.error(err);
  alert(`Could not load rider: ${err.message}`);
});
