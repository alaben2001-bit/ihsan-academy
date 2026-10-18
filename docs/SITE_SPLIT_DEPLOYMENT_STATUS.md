# Site split deployment status

Updated: 2026-10-18

## Static sites

- Academy curriculum site: https://ihsan-knowledge.pages.dev/
- Quran school site: https://ihsan-quran-school.pages.dev/
- Student learning platform remains: https://ihsan-academy-frankfurt.onrender.com/

## Current implementation

- `site-knowledge/index.html`: Arabic RTL academy landing page with five knowledge paths, supporting sciences/books, and the two practical paths (worldly life and Hereafter).
- `site-school/index.html`: existing Quran school landing page with links to the academy and the student platform.
- Both static sites include canonical metadata, Open Graph metadata, a keyboard skip link, visible keyboard focus styling, and reduced-motion handling.
- Each static site has `robots.txt` and `sitemap.xml`.
- Both Cloudflare Pages deployments were confirmed as `deploy: success` through the Cloudflare API on 2026-10-18.
- Changes are on branch `implementation/split-sites-v1`; they have not been merged into `main`.

## Important deployment caveat

The attempt to connect these Pages projects to the GitHub repository failed with a Cloudflare API error relating to the Pages Git installation. The latest site versions were therefore uploaded directly as Pages deployments. Automatic deployment on future Git pushes is **not confirmed** and must not be assumed.

## Not migrated / not changed

- The Node.js student platform and PostgreSQL database remain on the existing Render setup.
- No student records, credentials, production database, or Render service configuration were changed.
- The static Pages sites are informational landing pages, not a replacement for the authenticated student/admin application.

## Next safe steps

1. Open both canonical `pages.dev` links in a real browser and test mobile layout, all links, and the `robots.txt` / `sitemap.xml` URLs.
2. Repair or reinstall the Cloudflare Pages Git integration, or choose a controlled GitHub Actions deployment after securely configuring Cloudflare credentials as repository secrets.
3. Only after backups and compatibility tests, plan any move of the Node.js/PostgreSQL application away from Render. Do not delete or disable the current service/database during that work.
4. Before merging this branch into `main`, review the diff to ensure it does not disturb the application or student data.
