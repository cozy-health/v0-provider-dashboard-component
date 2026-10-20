# Dashboard polish validation

Validated on 14 October 2026. Changes are local; no deployment was performed.

## Changes

- Provider dashboard owns the theme control at both `/` and `/provider`, fixing the duplicate at `/`.
- Both portals use accessible mobile navigation drawers below 1024px, with focus trapping, Escape and outside-click dismissal, focus restoration, scroll locking, and automatic closure on desktop resize.
- Mobile headers remain compact; account actions move into drawers. Desktop navigation remains available.
- Filters, pagination, patient tabs, form actions, and long content adapt to narrow layouts. Admin record tables retain their columns inside keyboard-accessible horizontal scroll regions.
- Light and dark page surfaces are distinct from cards. Resource empty states have clearer hierarchy. Chart overflow is contained and tooltip text wraps on phones.

## Results

| Check | Result |
| --- | --- |
| ESLint | Passed |
| TypeScript (`tsc --noEmit`) | Passed |
| Unit tests | 17 passed |
| Provider workflow integration | Passed |
| Provider onboarding integration | Passed |
| Admin management integration | Passed |

The browser review covers 320, 375, 390, 768, 1024, and 1440px in light and dark modes. It checks one visible theme control, a minimum 44px theme-button target, no page-wide horizontal overflow, saved theme preferences, keyboard theme switching, and drawer focus/scroll behavior. Both provider entry routes are covered. Auth pages, populated and empty provider rosters, HQ dashboard, and detailed insights are included.

Workflow checks cover resource CRUD and pagination, patient data and consent changes, notes, assignments, report downloads, settings, audit history, registration and invitation dialogs, admin charts and reporting filters, catalog CRUD, quiz editing/publishing, permission failures, and logout. Passing browser suites reported no uncaught page errors.

Tests ran against isolated local API fixtures in temporary copies using the installed Playwright/Chromium and Webpack, preserving the existing development server. Cold compilation required longer browser-harness timeouts. Early runs found an outdated direct-mobile-navigation step and narrow insights overflow; the final runs passed after corrections. Production accounts and data were not used.

## Evidence

Representative screenshots and viewport/theme JSON results are in this directory, along with the three passing workflow logs.

- [Provider at 320px](provider-root-320-light.png)
- [Provider drawer](provider-root-320-drawer.png)
- [HQ admin at 320px](admin-dashboard-320-light.png)
- [HQ admin drawer](admin-dashboard-320-drawer.png)
- [Detailed insights at 320px](admin-insights-320-light.png)

Deployment and a post-deployment route comparison remain outside this local implementation.
