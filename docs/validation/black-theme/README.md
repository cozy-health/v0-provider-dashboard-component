# Black dark theme

Dark mode now uses pure black (`#000000`) for the page and neutral charcoal (`#111111`) for cards, sidebars, popovers, and navigation drawers. Brand colours, borders, text, and the light theme are preserved.

Validation passed: TypeScript, ESLint, and focused Playwright checks of both portals and authentication pages at 390px and 1440px. Browser checks assert actual black page and charcoal card/drawer backgrounds, shared surface tokens, no horizontal page overflow, and no uncaught page errors. The browser runs used isolated local fixtures and did not access production data.

The screenshots here supersede the navy dark-mode screenshots in the earlier dashboard-polish review. Pre-push checks also passed all 17 unit tests. Deployment status is not covered by this local validation.
