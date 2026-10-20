# Cozy Health provider dashboard

A Next.js provider portal connected to the Cozy Health provider API. It includes
provider login, consent-controlled patient views, notes, resource assignments,
PDF reports, account settings and patient-attributable audit history.

See [Provider portal setup and contract](docs/PROVIDER_PORTAL.md) for environment
configuration, the browser session strategy, staging requirements and verification.

Use `npm run dev` for local development and `npm run build` / `npm start` for a
production build. Backend credentials and API configuration are server-only.

Providers can create an account at `/provider/register` without patients. The Patients page offers **Add patient** to redeem emailed invitations from the Cozy app. See [provider onboarding and deployment](docs/PROVIDER_ONBOARDING.md) for API rollout, mail queue configuration, and compatibility details.

## Admin local preview

The redesigned admin Overview and Analytics use a local Laravel API and isolated test records. See [local admin setup and verification](docs/ADMIN_LOCAL_PREVIEW.md). Start the API with `npm run dev:admin-api`, then run `npm run dev` in a second terminal and open `http://localhost:3000/admin`.
