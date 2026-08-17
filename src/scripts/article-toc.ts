const IN_SIGHT_TOLERANCE = 24;

const nav = document.querySelector<HTMLElement>("nav.article-toc");

if (nav) {
  const links = Array.from(
    nav.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'),
  );

  interface TocEntry {
    slug: string;
    li: HTMLElement;
    link: HTMLAnchorElement;
    target: HTMLElement;
    parent: HTMLElement | null;
  }

  const entries: TocEntry[] = [];
  const slugByLi = new Map<HTMLElement, string>();
  for (const link of links) {
    const slug = decodeURIComponent((link.getAttribute("href") ?? "").slice(1));
    const target = document.getElementById(slug);
    const li = link.closest<HTMLElement>("li.article-toc-item");
    if (!target || !li) continue;
    slugByLi.set(li, slug);
    entries.push({
      slug,
      li,
      link,
      target,
      parent:
        li.dataset.depth === "3"
          ? li.closest<HTMLElement>('li.article-toc-item[data-depth="2"]')
          : null,
    });
  }

  if (entries.length > 0) {
    const scrollIntoViewport = (li: HTMLElement) => {
      const link = li.querySelector<HTMLAnchorElement>("a");
      if (!link) return;
      const rect = link.getBoundingClientRect();
      const navRect = nav.getBoundingClientRect();
      if (rect.top < navRect.top) {
        nav.scrollTop -= navRect.top - rect.top;
      } else if (rect.bottom > navRect.bottom) {
        nav.scrollTop += rect.bottom - navRect.bottom;
      }
    };

    let lastScrollY = window.scrollY;

    const update = () => {
      const viewportHeight = window.innerHeight;
      const articleEnd = () =>
        document
          .querySelector<HTMLElement>(".article-text")
          ?.getBoundingClientRect().bottom ?? 0;

      const inView: TocEntry[] = [];
      entries.forEach((entry, index) => {
        const start = entry.target.getBoundingClientRect().top;
        const end =
          index + 1 < entries.length
            ? entries[index + 1].target.getBoundingClientRect().top
            : articleEnd();
        if (
          end > -IN_SIGHT_TOLERANCE &&
          start < viewportHeight + IN_SIGHT_TOLERANCE
        ) {
          inView.push(entry);
        }
      });

      const inViewSlugs = new Set(inView.map((entry) => entry.slug));

      const scrollingDown = window.scrollY >= lastScrollY;
      lastScrollY = window.scrollY;
      const primary = scrollingDown ? inView[inView.length - 1] : inView[0];

      for (const entry of entries) {
        entry.li.classList.toggle("is-active", inViewSlugs.has(entry.slug));
        entry.li.classList.toggle("is-current", entry === primary);
      }

      for (const entry of entries) {
        if (entry.parent) entry.parent.classList.remove("is-active-parent");
      }
      for (const entry of entries) {
        if (!entry.parent) continue;
        const parentSlug = slugByLi.get(entry.parent);
        if (
          inViewSlugs.has(entry.slug) &&
          parentSlug &&
          !inViewSlugs.has(parentSlug)
        ) {
          entry.parent.classList.add("is-active-parent");
        }
      }

      if (primary) scrollIntoViewport(primary.li);
    };

    for (const entry of entries) {
      entry.link.addEventListener("click", (event) => {
        event.preventDefault();
        entry.target.scrollIntoView({ behavior: "smooth", block: "start" });
        history.replaceState(null, "", `#${entry.slug}`);
      });
    }

    let ticking = false;
    const onScroll = () => {
      if (!ticking) {
        ticking = true;
        requestAnimationFrame(() => {
          update();
          ticking = false;
        });
      }
    };

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("load", update);

    update();
  }
}

export {};
