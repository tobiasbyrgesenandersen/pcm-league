// sheets.js — Local CSV loader + indices + rider types + helpers

export const SEASON_YEAR = 1992;

export const LOCAL_TEAMS_CSV = "./data/teams.csv";
export const LOCAL_RIDERS_CSV = "./data/riders.csv";
export const LOCAL_DIVISIONS_CSV = "./data/division.csv";
export const LOCAL_RACES_CSV = "./data/races.csv";
export const LOCAL_COUNTRIES_CSV = "./data/country.csv";

/**
 * Detect delimiter from header line. Supports: comma, semicolon, tab
 */
function detectDelimiter(text) {
  const firstLine =
    (text.split(/\r?\n/).find((l) => l.trim().length > 0) || "").trim();

  const candidates = [",", ";", "\t"];
  let best = { delim: ",", count: -1 };

  for (const d of candidates) {
    const c = firstLine.split(d).length;
    if (c > best.count) best = { delim: d, count: c };
  }
  return best.delim;
}

export function parseCSV(text) {
  if (text && text.charCodeAt(0) === 0xfeff) text = text.slice(1); // BOM

  const delim = detectDelimiter(text);
  const rows = [];
  let cur = "";
  let inQuotes = false;
  let row = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === delim && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      if (cur.length || row.length) row.push(cur);
      cur = "";
      if (row.length) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  const headers = (rows.shift() || []).map((h) => h.trim());
  return rows
    .filter((r) => r.length && r.some((c) => String(c).trim() !== ""))
    .map((r) =>
      Object.fromEntries(headers.map((h, idx) => [h, (r[idx] ?? "").trim()]))
    );
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(
      `Could not load "${url}" (HTTP ${res.status}). Check file path + Live Server.`
    );
  }
  const text = await res.text();
  return parseCSV(text);
}

let _cached = null;

export async function loadAllFromSheets() {
  if (_cached) return _cached;

  const [teams, riders, divisions, races, countries] = await Promise.all([
    fetchCSV(LOCAL_TEAMS_CSV),
    fetchCSV(LOCAL_RIDERS_CSV),
    fetchCSV(LOCAL_DIVISIONS_CSV),
    fetchCSV(LOCAL_RACES_CSV),
    fetchCSV(LOCAL_COUNTRIES_CSV),
  ]);

  _cached = { teams, riders, divisions, races, countries, source: "local-csv" };
  return _cached;
}

/* ---------- Helpers ---------- */

export function toNumber(v) {
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

export function initials(first, last) {
  const a = (first || "").trim();
  const b = (last || "").trim();
  const s = `${a} ${b}`.trim();
  const parts = s.split(" ").filter(Boolean);
  return parts.map((w) => w[0]).slice(0, 2).join("").toUpperCase() || "?";
}

export function normalizeRegion(region) {
  const r = (region || "").trim();
  return r ? r : "Unknown";
}

export function formatBirthdayYYYYMMDD(raw) {
  const s = String(raw || "").trim();
  if (!/^\d{8}$/.test(s)) return "—";
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  return `${d}-${m}-${y}`;
}

export function statKeysFromRider(riderRow) {
  return Object.keys(riderRow).filter((k) => k.startsWith("stat_"));
}

export function prettyStatName(key) {
  return key
    .replace(/^stat_/, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function statTierClass(val) {
  const n = toNumber(val);
  if (n == null) return "tier1";
  if (n >= 80) return "tier5";
  if (n >= 75) return "tier4";
  if (n >= 70) return "tier3";
  if (n >= 65) return "tier2";
  return "tier1";
}

export function computeOverallFromStats(riderRow) {
  const keys = statKeysFromRider(riderRow);
  const nums = keys.map((k) => toNumber(riderRow[k])).filter((n) => n != null);
  if (!nums.length) return null;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.round(avg);
}

export function levelTier(overall) {
  if (overall == null) return { label: "Unranked", tone: "tier1" };
  if (overall >= 80) return { label: "Elite", tone: "tier5" };
  if (overall >= 75) return { label: "A", tone: "tier4" };
  if (overall >= 70) return { label: "B", tone: "tier3" };
  if (overall >= 65) return { label: "C", tone: "tier2" };
  return { label: "D", tone: "tier1" };
}

/**
 * Rider type rules (simple + tunable)
 */
export function computeRiderType(r) {
  const S = (k) => toNumber(r[k]) ?? null;

  const sprint = S("stat_sprint");
  const acc = S("stat_acceleration");
  const mountain = S("stat_mountain");
  const hill = S("stat_hill");
  const tt = S("stat_timetrial");
  const flat = S("stat_flat");
  const endu = S("stat_endurance");
  const cob = S("stat_cobbles");

  const bucket = [
    ["Sprint", sprint],
    ["Acceleration", acc],
    ["Mountain", mountain],
    ["Hill", hill],
    ["Time Trial", tt],
    ["Flat", flat],
    ["Endurance", endu],
    ["Cobbles", cob],
  ].filter(([, v]) => v != null);

  if (!bucket.length) return "All-Rounder";

  bucket.sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1));
  const best = bucket[0];
  const second = bucket[1] || ["", -999];
  const bestName = best[0];
  const bestVal = best[1];
  const secondVal = second[1];

  const clearlyBest = bestVal >= (secondVal + 3);

  const m = mountain ?? 0;
  const t = tt ?? 0;
  const h = hill ?? 0;
  const sp = sprint ?? 0;
  const co = cob ?? 0;
  const fl = flat ?? 0;
  const en = endu ?? 0;
  const ac = acc ?? 0;

  const stageRacer =
    (m >= 75 && t >= 75) ||
    (m >= 72 && t >= 72 && Math.abs(m - t) <= 5 && (bestName === "Mountain" || bestName === "Time Trial"));

  if (stageRacer) return "Stage Racer";
  if (bestName === "Sprint" && (clearlyBest || sp >= 78) && ac >= 70) return "Sprinter";
  if (bestName === "Time Trial" && t >= 75 && m <= t - 6) return "Time Trialist";
  if (bestName === "Mountain" && m >= 75 && t <= m - 6) return "Climber";
  if (bestName === "Hill" && h >= 75) return "Puncher";
  if (bestName === "Cobbles" && co >= 75) return "Northern Classics";

  const baroudeur =
    fl >= 74 && en >= 74 && sp <= 78 && m <= 78 && t <= 78;

  if (baroudeur) return "Baroudeur";

  if (bestName === "Sprint") return "Sprinter";
  if (bestName === "Mountain") return "Climber";
  if (bestName === "Hill") return "Puncher";
  if (bestName === "Time Trial") return "Time Trialist";
  if (bestName === "Cobbles") return "Northern Classics";
  if (bestName === "Flat" || bestName === "Endurance") return "Baroudeur";

  return "All-Rounder";
}

/* ---------- Index helpers ---------- */

export function keyBy(list, key) {
  const map = new Map();
  for (const row of list) map.set(String(row[key]).trim(), row);
  return map;
}

export function getCountry(countriesById, id) {
  return countriesById.get(String(id).trim()) || null;
}

export function getDivision(divisionsById, id) {
  return divisionsById.get(String(id).trim()) || null;
}

/**
 * Calendar sort: uses numeric race_id if possible, otherwise stable order.
 */
export function sortRacesCalendar(races) {
  const withIdx = races.map((r, idx) => ({ r, idx }));
  withIdx.sort((a, b) => {
    const ai = toNumber(a.r.race_id);
    const bi = toNumber(b.r.race_id);
    if (ai != null && bi != null) return ai - bi;
    return a.idx - b.idx;
  });
  return withIdx.map(x => x.r);
}
