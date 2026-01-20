// news.js — simple local newspaper feed stored in localStorage
const $ = (id) => document.getElementById(id);

const KEY = "pcm_news_articles_v1";

function seed() {
  return [
    {
      id: crypto.randomUUID(),
      title: "A New Era Begins: The League Opens in 1992",
      author: "League Desk",
      date: new Date().toISOString(),
      body:
        "The PCM League launches with teams hunting sponsors, riders seeking contracts, and managers ready to shape history. More features will roll out soon: transfers, race results, standings, and finances.",
    },
    {
      id: crypto.randomUUID(),
      title: "Rumours Swirl Ahead of the First Transfer Window",
      author: "The Peloton",
      date: new Date().toISOString(),
      body:
        "Scouts are watching the free agent pool closely. Strong sprinters and time trial engines could decide the early season. Expect surprise signings once the market opens.",
    },
  ];
}

function loadArticles() {
  const raw = localStorage.getItem(KEY);
  if (!raw) {
    const s = seed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
  try {
    return JSON.parse(raw);
  } catch {
    const s = seed();
    localStorage.setItem(KEY, JSON.stringify(s));
    return s;
  }
}

function saveArticles(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
}

function formatDate(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" });
  } catch {
    return "—";
  }
}

function render(list) {
  const grid = $("newsGrid");
  grid.innerHTML = "";

  // newest first
  const sorted = [...list].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  for (const a of sorted) {
    const card = document.createElement("article");
    card.className = "paperArticle";

    card.innerHTML = `
      <div class="paperArticle__head">
        <h3 class="paperArticle__title">${a.title}</h3>
        <div class="paperArticle__meta">${formatDate(a.date)} · <span class="paperBy">${a.author}</span></div>
      </div>
      <div class="paperArticle__body">${escapeHTML(a.body).replace(/\n/g, "<br/>")}</div>
    `;

    grid.appendChild(card);
  }
}

function escapeHTML(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function wireForm() {
  const form = $("newsForm");
  const status = $("newsStatus");

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const title = String(fd.get("title") || "").trim();
    const author = String(fd.get("author") || "").trim();
    const body = String(fd.get("body") || "").trim();

    if (!title || !author || !body) {
      status.textContent = "Fill all fields.";
      return;
    }

    const list = loadArticles();
    list.push({ id: crypto.randomUUID(), title, author, body, date: new Date().toISOString() });
    saveArticles(list);

    form.reset();
    status.textContent = "Published ✅";
    render(list);
  });
}

function init() {
  $("year").textContent = String(new Date().getFullYear());
  const list = loadArticles();
  render(list);
  wireForm();
}

init();
