// utils.js
// Shared helpers used across pages (index/team/rider/divisions/etc.)
// Rider types are STRICTLY limited to:
// Baroudeur, Puncher, Time Trialist, Climber, Stage Racer, Northern Classics, Sprinter

export async function loadCSV(path) {
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

// Handles quoted commas + escaped quotes
function splitCSVLine(line) {
  const out = [];
  let cur = "";
  let inQ = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && line[i + 1] === '"') {
      cur += '"';
      i++;
      continue;
    }
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === "," && !inQ) {
      out.push(cur);
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

export function byId(id) {
  return document.getElementById(id);
}

export function parseNum(v) {
  const n = Number(String(v ?? "").trim());
  return Number.isFinite(n) ? n : 0;
}

/**
 * Birthday format: YYYYMMDD (e.g. 19621002)
 */
export function formatDateCompact(yyyymmdd) {
  const s = String(yyyymmdd ?? "").trim();
  if (s.length !== 8) return "—";
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  return `${y}-${m}-${d}`;
}

/**
 * Stat tiers (matches your CSS tier variables)
 * 55-64: tier1
 * 65-69: tier2
 * 70-74: tier3
 * 75-79: tier4
 * 80-86: tier5
 */
export function statTierClass(val) {
  const v = parseNum(val);
  if (v >= 80) return "tier5";
  if (v >= 75) return "tier4";
  if (v >= 70) return "tier3";
  if (v >= 65) return "tier2";
  return "tier1";
}

/**
 * Level: average of all stat_* fields (rounded)
 */
export function calcRiderLevel(rider) {
  const keys = Object.keys(rider).filter((k) => k.startsWith("stat_"));
  const vals = keys.map((k) => parseNum(rider[k])).filter((v) => v > 0);
  if (vals.length === 0) return 0;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

/**
 * Rider type classifier (STRICT 7 types, no fallback)
 *
 * Approach:
 * - Compute a score for each type based on relevant stats.
 * - Apply small "synergy" bonuses and "anti-synergy" penalties.
 * - Always return the type with the highest score.
 *
 * This guarantees every rider gets one of:
 * Baroudeur, Puncher, Time Trialist, Climber, Stage Racer, Northern Classics, Sprinter
 */
export function classifyRiderType(r) {
  const sprint = parseNum(r.stat_sprint);
  const acc = parseNum(r.stat_acceleration);

  const tt = parseNum(r.stat_timetrial);
  const pro = parseNum(r.stat_prologue);

  const mountain = parseNum(r.stat_mountain);
  const med = parseNum(r.stat_medium_mountain);

  const hill = parseNum(r.stat_hill);

  const flat = parseNum(r.stat_flat);
  const endu = parseNum(r.stat_endurance);
  const resist = parseNum(r.stat_resistance);
  const rec = parseNum(r.stat_recovery);

  const cobbles = parseNum(r.stat_cobbles);
  const fighter = parseNum(r.stat_fighter);

  // Helpers (kept gentle so we don't overfit)
  const sprintCore = 0.65 * sprint + 0.35 * acc;
  const ttCore = 0.75 * tt + 0.25 * pro;
  const climbCore = 0.75 * mountain + 0.25 * med;
  const barCore = (0.40 * flat + 0.30 * endu + 0.20 * resist + 0.10 * rec);

  // Scores (base + bonuses/penalties)
  const scores = [
    {
      type: "Sprinter",
      score:
        sprintCore +
        0.10 * flat +
        // sprinters are usually less pure climbers/TT: mild penalty if those are huge
        -0.05 * climbCore +
        -0.03 * ttCore,
    },
    {
      type: "Northern Classics",
      score:
        0.70 * cobbles +
        0.20 * flat +
        0.10 * resist +
        0.05 * fighter +
        // little penalty for being too climby (not a deal breaker)
        -0.03 * climbCore,
    },
    {
      type: "Climber",
      score:
        climbCore +
        0.10 * rec +
        0.05 * resist +
        // climbers tend to not be pure TT/sprint: mild penalties
        -0.06 * ttCore +
        -0.04 * sprintCore,
    },
    {
      type: "Time Trialist",
      score:
        ttCore +
        0.10 * flat +
        0.05 * resist +
        // TT riders often not great in high mountains: mild penalty
        -0.06 * climbCore,
    },
    {
      type: "Stage Racer",
      score:
        // must reward BOTH: if one is low, this should drop
        0.55 * ttCore +
        0.55 * climbCore +
        0.10 * rec +
        0.05 * resist +
        // small penalty if sprint is the only thing they're good at
        -0.02 * sprintCore,
    },
    {
      type: "Puncher",
      score:
        0.70 * hill +
        0.15 * acc +
        0.10 * resist +
        0.05 * sprint +
        // punchers aren't usually pure mountain goats or TT monsters
        -0.03 * climbCore +
        -0.02 * ttCore,
    },
    {
      type: "Baroudeur",
      score:
        barCore +
        0.10 * fighter +
        0.08 * acc +
        // baroudeurs are generally not pure sprinters/TT: mild penalties
        -0.03 * ttCore +
        -0.02 * sprintCore,
    },
  ];

  // Hard rule bias: if a rider is truly strong in both TT + Mountains,
  // Stage Racer should win more often.
  if (ttCore >= 73 && climbCore >= 73) {
    const sr = scores.find((x) => x.type === "Stage Racer");
    if (sr) sr.score += 4.5;
  }

  // If cobbles is extremely standout, nudge Classics up.
  if (cobbles >= 78 && cobbles >= Math.max(sprint, mountain, tt, hill) + 4) {
    const nc = scores.find((x) => x.type === "Northern Classics");
    if (nc) nc.score += 4.0;
  }

  // Choose best score
  scores.sort((a, b) => b.score - a.score);
  return scores[0].type;
}
