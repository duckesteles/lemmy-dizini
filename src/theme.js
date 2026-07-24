(() => {
  "use strict";
  const btn = document.getElementById("theme-toggle");
  if (!btn) return;

  const root = document.documentElement;
  btn.addEventListener("click", () => {
    const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
    root.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch {}
  });
})();
