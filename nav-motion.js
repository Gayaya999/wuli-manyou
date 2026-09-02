const nav = document.querySelector(".site-nav");

if (nav) {
  const links = [...nav.querySelectorAll("a")];
  function place(link, instant = false) {
    if (!link) return;
    links.forEach((item) => {
      if (item === link) item.setAttribute("aria-current", "page");
      else item.removeAttribute("aria-current");
    });
    const rail = nav.getBoundingClientRect(), target = link.getBoundingClientRect();
    if (instant) nav.dataset.instant = "";
    nav.style.setProperty("--nav-pill-x", `${target.left - rail.left}px`);
    nav.style.setProperty("--nav-pill-w", `${target.width}px`);
    requestAnimationFrame(() => delete nav.dataset.instant);
  }
  place(nav.querySelector('[aria-current="page"]') || links[0], true);
  addEventListener("resize", () => place(nav.querySelector('[aria-current="page"]')));
  links.forEach((link) => link.addEventListener("click", (event) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const href = link.getAttribute("href");
    if (!href || href === location.pathname || href === "./" && location.pathname.endsWith("/")) return;
    event.preventDefault();
    place(link);
    window.setTimeout(() => { location.href = href; }, 240);
  }));
}
