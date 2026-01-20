// free-agents.js
import {
  loadAllFromSheets,
  initials,
  normalizeRegion,
  computeOverallFromStats,
  computeRiderType,
  keyBy,
  getCountry,
} from "./sheets.js";

const $ = (id) => document.getElementById(id);

function riderName(r) {
  return `${(r.firstname || "").trim()} ${(r.lastname || "").trim()}`.trim() || r.rider_id;
}

function matches(r, q, type, countryId) {
  const s = (q || "").trim().toLowerCase();
  const n = riderName(r).toLowerCase();
  const okQ =
    !s ||
    n.includes(s) ||
    normalizeRegion(r.region).toLowerCase().includes(s);

  const okT = !type || r._type === type;
  const okC = !countryId || String(r.country || "").trim() === String(countryId).trim();
  return okQ && okT && okC;
}

function render(list, countriesById) {
  const q = $("search").value || "";
  const type = $("typeFilter").value || "";
  const countryId = $("countryFilter").value || "";

  const el = $("list");
  el.innerHTML = "";

  const filtered = list.filter((r) => matches(r, q, type, countryId));
  filtered.sort((a, b) => (b._overall ?? -1) - (a._overall ?? -1));

  for (const r of filtered) {
    const a = document.createElement("a");
    a.className = "card rCard";
    a.href = `./rider.html?rider_id=${encodeURIComponent(r.rider_id)}`;

    const portrait = document.createElement("div");
    portrait.className = "rPortrait";

    const portraitUrl = (r.portrait || "").trim();
    if (portraitUrl) {
      const img = document.createElement("img");
      img.src = portraitUrl;
      img.alt = `${riderName(r)} portrait`;
      img.loading = "lazy";
      portrait.appendChild(img);
    } else {
      portrait.textContent = initials(r.firstname, r.lastname);
    }

    const meta = document.createElement("div");

    const name = document.createElement("div");
    name.className = "rName";
    name.textContent = riderName(r);

    const sub = document.createElement("div");
    sub.className = "rMeta";

    const country = getCountry(countriesById, r.country);
    const real = String(r.real_rider || "").trim() === "1";

    sub.innerHTML = `
      ${country?.flag ? `<img class="flag flag--sm" src="${country.flag}" alt="" />` : ""}
      <span>${country?.country_name || "—"}</span>
      <span>·</span>
      <span>${r.age ? `Age ${r.age}` : "Age —"}</span>
      <span>·</span>
      <span>${r._overall != null ? `LVL ${r._overall}` : "LVL —"}</span>
      <span>·</span>
      <span>${real ? "✔ Real" : "✖ Fictional"}</span>
    `;

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

  $("faMeta").textContent = `${filtered.length} riders available.`;
}

function populateCountries(countries) {
  const sel = $("countryFilter");
  sel.innerHTML =
    `<option value="">All countries</option>` +
    countries
      .slice()
      .sort((a, b) => (a.country_name || "").localeCompare(b.country_name || ""))
      .map((c) => `<option value="${c.country_id}">${c.country_name}</option>`)
      .join("");
}

async function load() {
  $("year").textContent = String(new Date().getFullYear());

  const { riders, countries } = await loadAllFromSheets();
  const countriesById = keyBy(countries, "country_id");

  const free = riders
    .filter((r) => !(r.team_id || "").trim())
    .map((r) => {
      const overall = computeOverallFromStats(r);
      const type = computeRiderType(r);
      return { ...r, _overall: overall, _type: type };
    });

  populateCountries(countries);

  render(free, countriesById);

  $("search").addEventListener("input", () => render(free, countriesById));
  $("typeFilter").addEventListener("change", () => render(free, countriesById));
  $("countryFilter").addEventListener("change", () => render(free, countriesById));
}

load().catch((err) => {
  console.error(err);
  alert(`Could not load free agents: ${err.message}`);
});
