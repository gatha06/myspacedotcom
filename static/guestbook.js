/* Guestbook on the public page.
   Loads after public.js and reuses its helpers ($, el, dbDate, username). */

const gbList = $("gb-list");
const gbError = $("gb-error");

function renderGuestbook(data) {
  const loggedIn = data.viewer !== null;
  $("gb-form").hidden = !loggedIn;
  $("gb-login").hidden = loggedIn;

  gbList.innerHTML = "";
  data.entries.forEach((entry) => {
    const li = el("li", "note");
    li.appendChild(el("p", "", entry.message));
    li.appendChild(el("time", "", `${entry.author} · ${dbDate(entry.created_at)}`));

    if (entry.can_delete) {
      const rm = el("button", "rm", "Remove");
      rm.type = "button";
      rm.addEventListener("click", async () => {
        if (!confirm("Remove this message?")) return;
        const res = await fetch(`/api/guestbook/entry/${entry.id}`, { method: "DELETE" });
        if (res.ok) {
          loadGuestbook();
        } else {
          gbError.textContent = "Could not remove that message.";
        }
      });
      li.appendChild(rm);
    }

    gbList.appendChild(li);
  });
}

async function loadGuestbook() {
  try {
    const res = await fetch(`/api/guestbook/${encodeURIComponent(username)}`);
    if (!res.ok) throw new Error("Could not load the guestbook.");
    renderGuestbook(await res.json());
  } catch (err) {
    console.error(err);
    gbError.textContent = err.message;
  }
}

$("gb-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const message = $("gb-text").value.trim();
  if (!message) return;

  try {
    const res = await fetch(`/api/guestbook/${encodeURIComponent(username)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");

    gbError.textContent = "";
    event.target.reset();
    loadGuestbook();
  } catch (err) {
    gbError.textContent = err.message;
  }
});

// After logging in, bring the visitor back to this page
$("gb-login-link").href = "/login?next=" + encodeURIComponent("/u/" + username);

loadGuestbook();