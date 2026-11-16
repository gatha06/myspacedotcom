/* Public page: shows one person's space, read-only. */
const $ = (id) => document.getElementById(id);

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const username = document.body.dataset.username;

function dbDate(text) {
  return new Date(text.replace(" ", "T") + "Z").toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// Same safety check as on the owner's page: only real Spotify links get embedded
function spotifyEmbed(input) {
  const match = String(input).trim().match(
    /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(playlist|album|track|episode|show|artist)\/([A-Za-z0-9]{10,40})/
  );
  if (!match) return null;
  const [, kind, id] = match;
  return {
    src: `https://open.spotify.com/embed/${kind}/${id}`,
    height: kind === "track" || kind === "episode" ? 152 : 352,
  };
}

// Only http and https links are clickable
function safeHref(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
  } catch (err) {
    return null;
  }
}

function renderProfile(p) {
  const name = p.display_name || p.username;
  document.title = `${name} · myspacedotcom`;
  $("p-name").textContent = name;

  $("p-tagline").textContent = p.tagline;
  $("p-tagline").hidden = !p.tagline;
  $("p-bio").textContent = p.bio;
  $("p-bio").hidden = !p.bio;
  $("preview-note").hidden = p.is_public;

  const portrait = $("p-portrait");
  portrait.textContent = "";
  if (p.avatar.startsWith("data:image/jpeg;base64,")) {
    const img = el("img");
    img.src = p.avatar;
    img.alt = "";
    portrait.appendChild(img);
  } else {
    portrait.textContent = (name[0] || "?").toUpperCase();
  }
}

function renderNotes(items) {
  if (items.length === 0) return;
  const list = $("p-notes-list");
  items.forEach((note) => {
    const li = el("li", "note");
    if (note.title) li.appendChild(el("h3", "", note.title));
    li.appendChild(el("p", "", note.content));
    li.appendChild(el("time", "", dbDate(note.created_at)));
    list.appendChild(li);
  });
  $("p-notes").hidden = false;
}

function renderPhotos(items) {
  if (items.length === 0) return;
  const grid = $("p-photos-grid");
  items.forEach((photo, index) => {
    const src = `/u/${encodeURIComponent(username)}/photo/${photo.id}`;

    const li = el("li", "shot");
    const open = el("button", "open");
    open.type = "button";
    open.setAttribute("aria-label", `View photo ${index + 1}`);

    const img = el("img");
    img.src = src;
    img.alt = `Photo ${index + 1}`;
    img.loading = "lazy";
    open.appendChild(img);
    open.addEventListener("click", () => {
      $("lightbox-img").src = src;
      $("lightbox").showModal();
    });

    li.appendChild(open);
    grid.appendChild(li);
  });
  $("p-photos").hidden = false;
}

function renderMusic(items) {
  const grid = $("p-music-grid");
  let shown = 0;
  items.forEach((item) => {
    const embed = spotifyEmbed(item.url);
    if (!embed) return;

    const li = el("li", "tune");
    const frame = el("iframe");
    frame.src = embed.src;
    frame.height = embed.height;
    frame.title = "Spotify player";
    frame.loading = "lazy";
    frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";
    li.appendChild(frame);
    grid.appendChild(li);
    shown++;
  });
  if (shown > 0) $("p-music").hidden = false;
}

function renderLinks(items) {
  const grid = $("p-links-grid");
  let shown = 0;
  items.forEach((item) => {
    const href = safeHref(item.url);
    if (!href) return;

    const host = new URL(href).hostname.replace(/^www\./, "");
    const li = el("li", "link-item");
    const a = el("a", "link");
    a.href = href;
    a.target = "_blank";
    a.rel = "noopener noreferrer";
    a.append(el("strong", "", item.title || "Link"), el("small", "", host));
    li.appendChild(a);
    grid.appendChild(li);
    shown++;
  });
  if (shown > 0) $("p-links").hidden = false;
}

async function load() {
  try {
    const res = await fetch(`/api/public/${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error("Could not load this page.");
    const data = await res.json();

    renderProfile(data.profile);
    const ofType = (type) => data.blocks.filter((b) => b.type === type);
    renderNotes(ofType("note"));
    renderPhotos(ofType("photo"));
    renderMusic(ofType("spotify"));
    renderLinks(ofType("link"));
  } catch (err) {
    console.error(err);
    $("p-error").textContent = err.message;
  }
}

$("lightbox-close").addEventListener("click", () => $("lightbox").close());
$("lightbox").addEventListener("click", (event) => {
  if (event.target === $("lightbox")) $("lightbox").close();
});

load();