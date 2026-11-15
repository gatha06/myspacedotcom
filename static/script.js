/* =========================================================
   HELPERS
   ========================================================= */
const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

// Browser storage helpers (photos.js uses these to move older photos to the server)
function loadData(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch (err) {
    console.error(`Could not read ${key}:`, err);
    return fallback;
  }
}

function saveData(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err) {
    console.error(`Could not save ${key}:`, err);
    return false;
  }
}

// Talk to the Flask server
async function api(path, options = {}) {
  const res = await fetch(path, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Something went wrong");
  return data;
}

function formatDate(timestamp) {
  return new Date(timestamp).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// The database stores UTC times like "2026-11-15 10:30:00"
function dbDate(text) {
  return formatDate(text.replace(" ", "T") + "Z");
}

async function removeBlock(id, errorEl) {
  try {
    await api(`/api/blocks/${id}`, { method: "DELETE" });
    return true;
  } catch (err) {
    errorEl.textContent = err.message;
    return false;
  }
}

/* =========================================================
   NOTES AND LINKS (both saved in the database)
   ========================================================= */
const notesList = $("notes-list");
const notesError = $("notes-error");
const linkGrid = $("link-grid");
const linksError = $("links-error");

let notes = [];
let links = [];

async function loadBlocks() {
  try {
    const blocks = await api("/api/blocks");
    notes = blocks.filter((b) => b.type === "note");
    links = blocks.filter((b) => b.type === "link");
  } catch (err) {
    console.error(err);
    notesError.textContent = "Could not load from the server. Is it running?";
  }
  renderNotes();
  renderLinks();
}

// ----- Notes -----
function renderNotes() {
  notesList.innerHTML = "";

  notes.forEach((note) => {
    const li = el("li", "note");

    if (note.title) li.appendChild(el("h3", "", note.title));
    li.appendChild(el("p", "", note.content));
    li.appendChild(el("time", "", dbDate(note.created_at)));

    const rm = el("button", "rm", "Remove");
    rm.type = "button";
    rm.addEventListener("click", async () => {
      if (!confirm("Delete this note?")) return;
      if (await removeBlock(note.id, notesError)) {
        notes = notes.filter((n) => n.id !== note.id);
        renderNotes();
      }
    });

    li.appendChild(rm);
    notesList.appendChild(li);
  });
}

$("note-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const content = $("note-text").value.trim();
  if (!content) return;

  try {
    const block = await api("/api/blocks", {
      method: "POST",
      body: JSON.stringify({ type: "note", title: $("note-title").value.trim(), content }),
    });
    notesError.textContent = "";
    notes.unshift(block);
    renderNotes();
    event.target.reset();
    $("note-title").focus();
  } catch (err) {
    notesError.textContent = err.message;
  }
});

// ----- Links -----
// Only http and https links are allowed (this blocks things like "javascript:")
function cleanUrl(input) {
  let value = input.trim();
  if (!value) return null;
  if (!/^[a-z][a-z0-9+.-]*:/i.test(value)) value = "https://" + value;
  try {
    const url = new URL(value);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;
    return url.href;
  } catch (err) {
    return null;
  }
}

function renderLinks() {
  linkGrid.innerHTML = "";

  links.forEach((item) => {
    const li = el("li", "link-item");

    let host = item.url;
    try { host = new URL(item.url).hostname.replace(/^www\./, ""); } catch (err) { /* keep full url */ }

    const a = el("a", "link");
    a.href = item.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.append(el("strong", "", item.title || "Link"), el("small", "", host));

    const rm = el("button", "rm", "Remove");
    rm.type = "button";
    rm.addEventListener("click", async () => {
      if (!confirm("Remove this link?")) return;
      if (await removeBlock(item.id, linksError)) {
        links = links.filter((l) => l.id !== item.id);
        renderLinks();
      }
    });

    li.append(a, rm);
    linkGrid.appendChild(li);
  });
}

$("link-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const url = cleanUrl($("link-url").value);
  if (!url) {
    linksError.textContent = "That doesn't look like a valid link. Try something like github.com/yourname.";
    return;
  }

  try {
    const block = await api("/api/blocks", {
      method: "POST",
      body: JSON.stringify({ type: "link", title: $("link-platform").value, url }),
    });
    linksError.textContent = "";
    links.unshift(block);
    renderLinks();
    event.target.reset();
    $("link-url").focus();
  } catch (err) {
    linksError.textContent = err.message;
  }
});

loadBlocks();