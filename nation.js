// nation.js
import {
  loadAllFromSheets,
  keyBy,
  getCountry,
  initials,
  computeOverallFromStats,
  computeRiderType,
} from "./sheets.js";

const $ = (id) => document.getElementById(id);

function getCountryId() {
  const url = new URL(location.href);
  return url.searchParams.get("country_id") || "";
}

function riderName(r) {
  return `${(r.firstname || "").trim()} ${(r.lastname || "").trim()}`.trim() || r.rider_id;
}

function renderTop8(top8) {
  const el = $("topRoster");
  el.innerHTML = "";

  for (const r of top8) {
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
    sub.textContent = `LVL ${r._overall ?? "—"} · ${r._type}`;

    meta.appendChild(name);
    meta.appendChild(sub);

    const tag = document.createElement("span");
    tag.className = "rTag";
    tag.textContent = r._type;

    a.appendChild(portrait);
    a.appendChild(meta);
    a.appendChild(tag);

    el.appendChild(a);
  }
}

function renderTable(all) {
  const q = ($("search").value || "").trim().toLowerCase();
  const tbody = $("riderTbody");
  tbody.innerHTML = "";

  const filtered = all.filter(r => {
    const n = riderName(r).toLowerCase();
    return !q || n.includes(q);
  });

  filtered.sort((a,b)=>(b._overall ?? -1) - (a._overall ?? -1));

  filtered.forEach((r, idx) => {
    const tr = document.createElement("tr");
    const real = String(r.real_rider || "").trim() === "1";

    tr.innerHTML = `
      <td class="mono">${idx + 1}</td>
      <td><a class="tableLink" href="./rider.html?rider_id=${encodeURIComponent(r.rider_id)}">${riderName(r)}</a></td>
      <td class="mono">${r._overall ?? "—"}</td>
      <td>${r._type}</td>
      <td>${real ? "✔" : "✖"}</td>
    `;
    tbody.appendChild(tr);
  });

  $("countryMeta").textContent = `${all.length} riders · Showing ${filtered.length} · National team = top 8 by Level`;
}

async function load() {
  $("year").textContent = String(new Date().getFullYear());

  const cid = getCountryId();
  if (!cid) {
    alert("Missing country_id in URL. Example: nation.html?country_id=12");
    return;
  }

  const { riders, countries } = await loadAllFromSheets();
  const countriesById = keyBy(countries, "country_id");

  const c = getCountry(countriesById, cid);
  document.title = `${c?.country_name || "Country"} · National Team`;

  $("countryTitle").innerHTML = `${c?.flag ? `<img class="flag" src="${c.flag}" alt="" />` : ""} <span>${c?.country_name || `Country ${cid}`}</span>`;

  const all = riders
    .filter(r => String(r.country || "").trim() === String(cid).trim())
    .map(r => ({ ...r, _overall: computeOverallFromStats(r), _type: computeRiderType(r) }));

  all.sort((a,b)=>(b._overall ?? -1) - (a._overall ?? -1));
  const top8 = all.slice(0,8);

  renderTop8(top8);
  renderTable(all);

  $("search").addEventListener("input", () => renderTable(all));
}

load().catch((err) => {
  console.error(err);
  alert(`Could not load nation: ${err.message}`);
});
