const article = document.querySelector<HTMLElement>(".news-archive");

if (article) {
  article.addEventListener("click", (event) => {
    const link = (event.target as Element).closest<HTMLAnchorElement>(
      'a[href^="#"]',
    );
    if (!link) return;

    const slug = decodeURIComponent((link.getAttribute("href") ?? "").slice(1));
    const target = document.getElementById(slug);
    if (!target) return;

    event.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    history.replaceState(null, "", `#${slug}`);
  });
}

export {};
