# Authentication UX review

## Implemented

- Shared password inputs for admin/provider login and both reset flows: independent
  show/hide buttons, accessible labels, keyboard activation, 44px targets, password
  manager autocomplete, and a Caps Lock notice. Passwords remain masked by default.
- Consistent branding, spacing and touch targets on desktop and narrow screens.
- Reset pages say "Send reset code", describe the two steps, show the 15-minute
  code lifetime, and display the existing password-length requirement before submit.
- Email survives the reset flow and is normalized before requests. Change email
  returns focus to the email field. Both reset forms check matching passwords
  before sending a request; normal paste/password-manager use remains supported.
- Resend has a 60-second client cooldown. Server 429 Retry-After values take
  precedence, with a countdown and disabled retry button. Server throttles still
  enforce the actual request limits. Changing email permits correcting a typo;
  it does not bypass the backend's IP or email limit.
- Provider bridge now preserves Retry-After. Successful provider reset uses a
  success toast, not red error text. Login/reset inputs are disabled during a
  request, and password fields are cleared when reset returns to login.
- Expired-session URLs explain why sign-in is required. Admin and provider login
  link to each other, while their session cookies and API scopes remain separate.
- Invalid JSON error responses no longer leak JSON parser errors through the
  admin/provider API helpers. Reset requests retain account-neutral messages.

## Verification

Browser fixtures check password visibility without submission or value loss,
keyboard toggling, email retention, confirmation validation, resend countdown,
429 recovery, clean password fields after successful reset, expired notices,
and a 390px layout without horizontal overflow. HTTP fixtures verify Retry-After
survives both reset bridges. Test reset requests are intercepted; no real account
passwords are changed by these checks. Existing session/CSRF/isolation tests,
lint, TypeScript and production build are required before release.

## Remaining backend/security work

The existing backend Phase 12 readiness report remains authoritative for these
unresolved decisions. This UI work does not implement or change those policies:

- Consumer password reset should revoke existing sessions; the current consumer
  controller changes the password without deleting its Sanctum tokens.
- Approve refresh-token/device-session design and legacy-token migration before
  adding short access tokens, refresh rotation and active-device management.
- Approve account-lockout/password policy and certificate pin rotation.
- Complete local PHI encryption, sensitive-log scrubbing, native capture
  protections and approved versioned consents.

Provider and admin reset currently have different minimum password lengths
(8 and 12 characters respectively). Those existing requirements are now visible;
unifying policy belongs in the approved backend/mobile security change.
