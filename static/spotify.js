/* On repeat: Spotify players.
   Loads after script.js and reuses its helpers ($, el, api, removeBlock). */

const tuneGrid = $("tune-grid");
const tunesError = $("tunes-error");
let tunes = [];

// Turn a normal Spotify link into a safe embed address.
// Returns null unless it's really a Spotify link, so nothing else can be embedded.
function spotifyEmbed(input) {
  const match = String(input).trim().match(
    /^https:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(playlist|album|track|episode|show|artist)\/([A-Za-z0-9]{10,40})/
  );
  if (!match) return null;

  const [, kind, id] = match;
  return {
    link: `https://open.spotify.com/${kind}/${id}`,
    src: `https://open.spotify.com/embed/${kind}/${id}`,
    height: kind === "track" || kind === "episode" ? 152 : 352,
  };
}

function renderTunes() {
  tuneGrid.innerHTML = "";

  tunes.forEach((item) => {
    const embed = spotifyEmbed(item.url);
    if (!embed) return;

    const li = el("li", "tune");

    const frame = el("iframe");
    frame.src = embed.src;
    frame.height = embed.height;
    frame.title = "Spotify player";
    frame.loading = "lazy";
    frame.allow = "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture";

    const rm = el("button", "rm", "Remove");
    rm.type = "button";
    rm.addEventListener("click", async () => {
      if (!confirm("Remove this player?")) return;
      if (await removeBlock(item.id, tunesError)) {
        tunes = tunes.filter((t) => t.id !== item.id);
        renderTunes();
      }
    });

    li.append(frame, rm);
    tuneGrid.appendChild(li);
  });
}

$("tune-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const embed = spotifyEmbed($("tune-url").value);
  if (!embed) {
    tunesError.textContent = "Paste a Spotify playlist, album, song or podcast link (from the Share menu).";
    return;
  }

  try {
    const block = await api("/api/blocks", {
      method: "POST",
      body: JSON.stringify({ type: "spotify", url: embed.link }),
    });
    tunesError.textContent = "";
    tunes.unshift(block);
    renderTunes();
    event.target.reset();
  } catch (err) {
    tunesError.textContent = err.message;
  }
});

async function loadTunes() {
  try {
    const blocks = await api("/api/blocks");
    tunes = blocks.filter((b) => b.type === "spotify");
  } catch (err) {
    console.error(err);
  }
  renderTunes();
}

loadTunes();