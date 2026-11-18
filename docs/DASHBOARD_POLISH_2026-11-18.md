# Admin and provider dashboard polish

## Design decisions

Retain Cozy colors, typefaces, rounded controls and role-based workflows. Use the existing shared Radix components and CSS tokens.

- [Carbon data tables](https://v10.carbondesignsystem.com/components/data-table/usage/) guide the search/action toolbar, readable table hierarchy and bottom pagination.
- [Atlassian application layout](https://atlassian.design/components/navigation-system/layout/usage) guides separation of navigation, main content and review areas.
- [Carbon modals](https://v10.carbondesignsystem.com/components/modal/usage/) guide content-appropriate sizes, actions and scrolling.
- The local emil-design-eng skill guides restrained motion, feedback and consistent popup behavior. Existing focus/dismissal and permission guards remain in force.

The owner requested continuing without interactive previews on 18 November. Source review and automated validation replace further preview requests. This does not establish observed visual acceptance of every state.

## Repairs and rationale

| Before | After | Why |
| --- | --- | --- |
| Dialog close hit area measured 16 by 16 pixels | Shared close control is 44 by 44 pixels with visible focus and hover feedback | Touch and keyboard usability |
| Shared dialog/popover primitives lacked default viewport bounds | Default viewport bounds, internal scrolling and overscroll containment | Keep long content reachable on smaller screens |
| Admin forced a different card/background palette | Use existing Cozy application tokens, with explicit portal surface colors | Consistent light/dark surface hierarchy |
| Buttons used transition-all and small default heights | Explicit transition properties, 44-pixel default controls and reduced-motion handling | Predictable feedback and usable targets |
| Refreshing provider lists replaced filters and content with initial skeletons | Preserve same-resource content during refresh, disable repeated refresh actions and hide prior-resource content on path change | Avoid layout loss while preserving patient boundaries |
| Provider mobile header occupied two rows | Navigation, brand and theme control share one responsive row | More usable content space |
| Provider patient view repeated the Patients heading | Patient directory section below the Patients page heading | Clear page/section hierarchy |
| Conversation controls shared one narrow row | Bounded message input wraps above actions on phones; conversation list has its own panel and selected state | Avoid compressed input and action overlap |
| Some admin lists used loading text or a spinner | Shared content-shaped skeletons with accessible status text and reduced motion | Consistent initial-loading states |
| Editor actions scrolled away with long content | Separated sticky action area in the management editor | Keep save action available |
| Database field labels rendered lowercase id | ID capitalization in table headers | Readable record labels |

## Screen and overlay coverage

Shared changes apply to the existing admin shell, analytics/overview, safety, management modules and the provider shell. Individual changes cover admin article/support/privacy/student lists, provider overview, patient roster, messaging, invitation and shared-journal loading. Existing resource, settings, assessment and report views inherit the shared controls, surfaces and responsive typography.

Source inventory identifies nine DialogContent callers, two navigation sheets, one voice popover and fourteen native-confirmation call sites across thirteen screen components. This is source coverage, not a claim that every runtime state was exercised.

| Overlay family | Disposition |
| --- | --- |
| Article preview, management editor, email preview, reported-content review | Shared bounds, close target, header rhythm and motion applied. Report review retains its full-height side panel. |
| Support/privacy review and development-access confirmation | Shared corrections applied. Existing busy and production-visibility guards preserved. |
| Invitation, shared-journal and identity confirmation | Shared corrections applied. Explicit identity confirmation still suppresses its close button. Sharing/revocation checks preserved. |
| Admin/provider navigation sheets | Shared surface, scrolling and reduced-motion rules. Existing breakpoint dismissal and focus logic retained. |
| Voice recorder popover | Shared viewport/collision bounds. Recorder-specific outside/Escape protections retained to avoid losing a recording. |
| Native confirmations for publishing, discarding, moderation, archive and deletion | Existing confirmation text and synchronous decisions retained. No silent conversion or weakened protection. |
| Selects, field validation and toast feedback | Readable controls, consistent input sizes, accessible existing messages and dismissible toasts. |

## Validation and limitations

Five focused state regressions cover same-path refresh, empty results, changed patient/filter paths, failed retry and revoked-data visibility. Existing isolated admin/provider browser contracts are added to hosted release checks. The management contract verifies popup viewport fit and the 44-pixel close control. Existing tests retain role, CSRF, consent, expiry, errors, keyboard and responsive checks.

Next.js and eslint-config-next are patched from 16.4.3 to 16.4.6 with owner authorization after verified advisories. No API contracts or database schemas change. No provider is marked professionally verified for testing.

Graphify status was STALE and refresh refused the production branch with `development-only policy requires develop`. Source/caller review and normal validation provide the fallback. No fresh-graph success is claimed.

The current newly registered provider can sign in but production data access requires professional verification. Verified-provider production acceptance remains open. Full visual review, VoiceOver and physical-device behavior beyond captured observations remain unobserved after the owner stopped previews. Scheduled production backup acceptance is recorded in the root build plan and execution register.
