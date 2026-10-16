const nav = document.querySelector(".site-nav");

if (nav) {
  const links = [...nav.querySelectorAll("a")];
  const motion = matchMedia("(prefers-reduced-motion: reduce)");
  const duration = 620;
  let navigationTimer;
  let navigationVersion = 0;
  let current = nav.querySelector('[aria-current="page"]') || links[0];

  function place(link, instant = false) {
    if (!link) return;
    current = link;
    links.forEach((item) => {
      if (item === link) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    const rail = nav.getBoundingClientRect();
    const target = link.getBoundingClientRect();
    if (instant) nav.dataset.instant = "";
    nav.style.setProperty("--nav-pill-x", `${target.left - rail.left}px`);
    nav.style.setProperty("--nav-pill-w", `${target.width}px`);
    nav.dataset.ready = "";
    if (instant) requestAnimationFrame(() => requestAnimationFrame(() => delete nav.dataset.instant));
  }

  function scrollToSection(hash) {
    const target = hash ? document.getElementById(decodeURIComponent(hash.slice(1))) : null;
    if (hash && !target) return false;
    if (target) target.scrollIntoView({ behavior: motion.matches ? "instant" : "smooth", block: "start" });
    else window.scrollTo({ top: 0, behavior: motion.matches ? "instant" : "smooth" });
    return true;
  }

  const isHall = (path) => path.endsWith("/") || path.endsWith("/index.html");
  const activeForLocation = () => isHall(location.pathname) && location.hash.startsWith("#experiment-") ? links[1] : links.find((link) => new URL(link.href).pathname === location.pathname && !new URL(link.href).hash) || (isHall(location.pathname) ? links[0] : current);
  async function arrive(url, version) {
    const figure = url.searchParams.get("figure");
    if (figure) document.dispatchEvent(new CustomEvent("wuli:navigate-scientist", { detail: { id: figure } }));
    if (scrollToSection(url.hash)) return;
    // Works arrive asynchronously; cancel a pending scroll when another tab is chosen.
    await new Promise((resolve) => {
      const observer = new MutationObserver(() => {
        if (version !== navigationVersion || document.getElementById(url.hash.slice(1))) finish();
      });
      let timeout;
      const finish = () => { observer.disconnect(); clearTimeout(timeout); resolve(); };
      observer.observe(document.body, { childList: true, subtree: true });
      timeout = setTimeout(finish, 8000);
    });
    if (version === navigationVersion) scrollToSection(url.hash);
  }
  place(activeForLocation(), true);
  new ResizeObserver(() => place(current, true)).observe(nav);
  document.fonts.ready.then(() => place(current, true));
  addEventListener("hashchange", () => place(activeForLocation()));
  addEventListener("popstate", () => { place(activeForLocation()); arrive(new URL(location.href), ++navigationVersion); });

  links.forEach((link) => link.addEventListener("click", (event) => {
    if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const url = new URL(link.href);
    if (url.origin !== location.origin) return;
    event.preventDefault();
    clearTimeout(navigationTimer);
    const version = ++navigationVersion;
    place(link);
    if (url.pathname === location.pathname || (isHall(url.pathname) && isHall(location.pathname))) {
      history.pushState(null, "", url.href);
      arrive(url, version);
      return;
    }
    navigationTimer = window.setTimeout(() => {
      // Enter the next page at its top, then animate to its section after layout settles.
      try {
        if (url.hash) sessionStorage.setItem("wuli-nav-section", JSON.stringify({ path: url.pathname, hash: url.hash }));
        else sessionStorage.removeItem("wuli-nav-section");
      } catch { /* Normal navigation still works if browser storage is unavailable. */ }
      location.assign(url.hash ? `${url.pathname}${url.search}` : url.href);
    }, motion.matches ? 0 : duration);
  }));

  try {
    const pending = JSON.parse(sessionStorage.getItem("wuli-nav-section") || "null");
    sessionStorage.removeItem("wuli-nav-section");
    if (pending?.path === location.pathname) {
      addEventListener("load", () => {
        history.replaceState(null, "", pending.hash);
        place(links.find((link) => new URL(link.href).hash === pending.hash));
        requestAnimationFrame(() => arrive(new URL(location.href), ++navigationVersion));
      }, { once: true });
    }
  } catch { /* Storage is optional. */ }
  if (location.hash.startsWith("#experiment-")) arrive(new URL(location.href), ++navigationVersion);
}
