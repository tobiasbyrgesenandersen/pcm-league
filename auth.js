// auth.js — super simpel auth (client-side)
// NOTE: Ikke sikker mod snyd. Brug kun til beta/test.

const STORAGE_KEY = "pcm_session_v1";

export function getSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function isLoggedIn() {
  const s = getSession();
  return !!(s && s.managerName && s.teamId);
}

export function login({ managerName, teamId, email }) {
  const session = {
    managerName: String(managerName || "").trim(),
    teamId: String(teamId || "").trim(),
    email: String(email || "").trim(),
    createdAt: Date.now(),
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  return session;
}

export function logout() {
  localStorage.removeItem(STORAGE_KEY);
}

export function requireLoginOrRedirect() {
  if (!isLoggedIn()) {
    const next = encodeURIComponent(window.location.pathname + window.location.search);
    window.location.href = `./login.html?next=${next}`;
  }
}
