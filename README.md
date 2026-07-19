# theme-memories/theme-memories

Astro framework blog theme

## TODO

1.  Create D1 table — run migration via wrangler d1 execute
2.  Build src/lib/auth.ts — argon2 hash + verify wrappers
3.  Build src/lib/db.ts — D1 query helpers
4.  Build src/lib/posts.ts — glob + gray-matter post loading
5.  Build src/lib/session.ts — session get/set helpers
6.  Update Layout.astro — add DaisyUI boilerplate, Navbar + Footer
7.  Build Navbar.astro + Footer.astro
8.  Build BlogCard.astro + BlogList.astro
9.  Rewrite index.astro — integrate BlogList + D1 for protected slugs
10. Build PostContent.astro — markdown rendering
11. Build PasswordForm.astro — form + Turnstile
12. Build PostPasswordGate.astro — conditional (locked vs unlocked)
13. Build blog/[slug].astro — wire everything together
14. Build api/unlock-post.ts — POST endpoint
15. Build scripts/hash-password.ts — CLI tool
16. Build about.astro — simple page

D1 Schema

```sql
CREATE TABLE post_passwords (
  slug       TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
```
