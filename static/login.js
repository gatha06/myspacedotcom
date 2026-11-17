const $ = (id) => document.getElementById(id);
let mode = "login";

function setMode(next) {
  mode = next;
  const isLogin = mode === "login";
  $("auth-title").textContent = isLogin ? "Log in" : "Create an account";
  $("auth-sub").textContent = isLogin ? "welcome back." : "pick a username and a password (8 or more characters).";
  $("auth-submit").textContent = isLogin ? "Log in" : "Sign up";
  $("switch-text").textContent = isLogin ? "New here?" : "Already have an account?";
  $("switch-btn").textContent = isLogin ? "Create an account" : "Log in";
  $("password").autocomplete = isLogin ? "current-password" : "new-password";
  $("auth-error").textContent = "";
}

// Where to go after logging in: only a public page like /u/name, otherwise home
function nextPage() {
  const next = new URLSearchParams(window.location.search).get("next") || "";
  return /^\/u\/[a-z0-9_]{3,20}$/.test(next) ? next : "/";
}

$("switch-btn").addEventListener("click", () => {
  setMode(mode === "login" ? "signup" : "login");
});

$("auth-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const path = mode === "login" ? "/api/login" : "/api/register";

  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        username: $("username").value,
        password: $("password").value,
      }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || "Something went wrong");
    window.location.href = nextPage();
  } catch (err) {
    $("auth-error").textContent = err.message;
  }
});

$("logout-btn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.reload();
});

// If you're already logged in, show that instead of the form
async function checkSession() {
  try {
    const res = await fetch("/api/me");
    const data = await res.json();
    if (data.user) {
      $("auth-wrap").hidden = true;
      $("already").hidden = false;
      $("who").textContent = data.user.username;
    }
  } catch (err) {
    console.error(err);
  }
}

checkSession();