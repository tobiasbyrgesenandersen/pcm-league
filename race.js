// race.js
import { loadAllFromSheets, keyBy, getCountry, getDivision } from "./sheets.js";

const $ = (id) => document.getElementById(id);

function getRaceId() {
  const url = new URL(location.href);
  return url.searchParams.get("race_id") || "";
}

async function load() {
  $("year").textContent = String(new Date().getFullYear());

  const raceId = getRaceId();
  if (!raceId) {
    alert("Missing race_id in URL. Example: race.html?race_id=1");
    return;
  }

  const { races, divisions, countries } = await loadAllFromSheets();
  const divisionsById = keyBy(divisions, "division_id");
  const countriesById = keyBy(countries, "country_id");

  const race = races.find(r => String(r.race_id).trim() === String(raceId).trim());
  if (!race) throw new Error(`Race not found: ${raceId}`);

  const c = getCountry(countriesById, race.country);
  const d = getDivision(divisionsById, race.division_id);

  document.title = `${race.race_name || "Race"} · PCM League`;

  $("raceTitle").textContent = race.race_name || "Race";
  $("raceMeta").textContent = `Race #${race.race_id} · ${race.stage_number ? `${race.stage_number} stages` : "— stages"}`;

  $("raceCountry").innerHTML = `${c?.flag ? `<img class="flag" src="${c.flag}" alt="" />` : ""} <span>${c?.country_name || "—"}</span>`;
  $("raceDivision").textContent = d?.division_name || `Division ${race.division_id || "—"}`;
  $("raceStages").textContent = race.stage_number ? `${race.stage_number}` : "—";
  $("raceId").textContent = String(race.race_id);
}

load().catch((err) => {
  console.error(err);
  alert(`Could not load race: ${err.message}`);
});
