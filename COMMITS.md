# Vaultory - commit guide (80 commits)

Run each block **in order** from the repo root.
Ignored files (`.env`, logs, `node_modules`, `dist`, generated prisma client) are skipped automatically - no secrets are committed.

## 1. chore: repository scaffolding, license and contribution guide

```bash
git add .gitignore LICENSE CONTRIBUTING.md
git commit -m "chore: repository scaffolding, license and contribution guide"
```

## 2. docs: project readme with architecture, features and setup guides

```bash
git add README.md
git commit -m "docs: project readme with architecture, features and setup guides"
```

## 3. chore: docker stack - compose file and env example

```bash
git add docker-compose.yml .env.docker.example
git commit -m "chore: docker stack - compose file and env example"
```

## 4. chore(backend): package manifest, tsconfig, eslint and vitest setup

```bash
git add backend/.gitignore backend/package.json backend/package-lock.json backend/tsconfig.json backend/eslint.config.mjs backend/vitest.config.ts backend/prisma.config.ts
git commit -m "chore(backend): package manifest, tsconfig, eslint and vitest setup"
```

## 5. feat(backend): env validation, logger and app constants

```bash
git add backend/src/config
git commit -m "feat(backend): env validation, logger and app constants"
```

## 6. feat(backend): auth, csrf, origin guard, rate-limit and error middleware

```bash
git add backend/src/middleware
git commit -m "feat(backend): auth, csrf, origin guard, rate-limit and error middleware"
```

## 7. feat(backend): express app assembly and route registry

```bash
git add backend/src/app.ts backend/src/routes backend/src/types
git commit -m "feat(backend): express app assembly and route registry"
```

## 8. feat(backend): prisma schema and initial migration

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20261016120000_init backend/prisma/migrations/migration_lock.toml
git commit -m "feat(backend): prisma schema and initial migration"
```

## 9. feat(backend): crypto, totp, validation, dto and request utilities

```bash
git add backend/src/utils
git commit -m "feat(backend): crypto, totp, validation, dto and request utilities"
```

## 10. feat(backend): prisma client wiring

```bash
git add backend/src/db
git commit -m "feat(backend): prisma client wiring"
```

## 11. feat(backend): session, activity, mailer and vault-escrow services

```bash
git add backend/src/services
git commit -m "feat(backend): session, activity, mailer and vault-escrow services"
```

## 12. feat(backend): auth routes - signup, login, sessions, email verification

```bash
git add backend/src/modules/auth
git commit -m "feat(backend): auth routes - signup, login, sessions, email verification"
```

## 13. feat(backend): secrets module - encrypted CRUD, versions, pagination

```bash
git add backend/src/modules/secrets
git commit -m "feat(backend): secrets module - encrypted CRUD, versions, pagination"
```

## 14. feat(backend): folders module

```bash
git add backend/src/modules/folders
git commit -m "feat(backend): folders module"
```

## 15. feat(backend): account settings module

```bash
git add backend/src/modules/settings
git commit -m "feat(backend): account settings module"
```

## 16. feat(backend): activity log and dashboard aggregation modules

```bash
git add backend/src/modules/activity backend/src/modules/dashboard
git commit -m "feat(backend): activity log and dashboard aggregation modules"
```

## 17. feat(backend): secret sharing and emergency access modules

```bash
git add backend/src/modules/shares backend/src/modules/emergency
git commit -m "feat(backend): secret sharing and emergency access modules"
```

## 18. feat(backend): favicon proxy with DNS/IP SSRF hardening

```bash
git add backend/src/modules/meta
git commit -m "feat(backend): favicon proxy with DNS/IP SSRF hardening"
```

## 19. feat(backend): vault escrow, categories and attachments migrations

```bash
git add backend/prisma/migrations/20261017120000_server_vault_escrow backend/prisma/migrations/20261017130000_categories_and_attachments
git commit -m "feat(backend): vault escrow, categories and attachments migrations"
```

## 20. feat(backend): TOTP, trash and single-use MFA token migrations

```bash
git add backend/prisma/migrations/20261017180000_totp_and_trash backend/prisma/migrations/20261018120000_mfa_single_use
git commit -m "feat(backend): TOTP, trash and single-use MFA token migrations"
```

## 21. feat(backend): sharing, emergency access and passkey migrations

```bash
git add backend/prisma/migrations/20261018120000_sharing_and_emergency backend/prisma/migrations/20261018130000_passkeys
git commit -m "feat(backend): sharing, emergency access and passkey migrations"
```

## 22. feat(backend): session geo label and nested folder migrations

```bash
git add backend/prisma/migrations/20261019090000_session_country backend/prisma/migrations/20261019120000_nested_folders
git commit -m "feat(backend): session geo label and nested folder migrations"
```

## 23. feat(backend): extension pairing token migration

```bash
git add backend/prisma/migrations/20261019180000_extension_link
git commit -m "feat(backend): extension pairing token migration"
```

## 24. feat(backend): server bootstrap with graceful shutdown

```bash
git add backend/src/server.ts
git commit -m "feat(backend): server bootstrap with graceful shutdown"
```

## 25. feat(backend): vercel serverless adapter and route config

```bash
git add backend/api backend/vercel.json
git commit -m "feat(backend): vercel serverless adapter and route config"
```

## 26. fix(backend): rewrite emitted .ts imports for generated prisma client

```bash
git add backend/tsconfig.json
git commit -m "fix(backend): rewrite emitted .ts imports for generated prisma client"
```

## 27. feat(backend): organisations - scoped workspaces and on-demand email verification

```bash
git add backend/prisma/schema.prisma backend/prisma/migrations/20261029000000_workspaces backend/src/middleware/workspace.ts backend/src/modules/workspaces backend/src/modules/secrets backend/src/modules/folders backend/src/modules/dashboard backend/src/modules/auth backend/src/routes backend/src/services backend/src/types backend/src/utils
git commit -m "feat(backend): organisations - scoped workspaces and on-demand email verification"
```

## 28. test(backend): api integration and crypto suites

```bash
git add backend/tests
git commit -m "test(backend): api integration and crypto suites"
```

## 29. chore(backend): rate-limit, disposable-domain and mail ops scripts

```bash
git add backend/scripts
git commit -m "chore(backend): rate-limit, disposable-domain and mail ops scripts"
```

## 30. chore(backend): env example, dockerfile, dockerignore and dep overrides

```bash
git add backend/.env.example backend/Dockerfile backend/.dockerignore backend/package.json backend/package-lock.json
git commit -m "chore(backend): env example, multi-stage dockerfile, dockerignore and dependency overrides"
```

## 31. chore(frontend): package manifest, vite, tsconfig, eslint and playwright setup

```bash
git add frontend/.gitignore frontend/package.json frontend/package-lock.json frontend/tsconfig.json frontend/eslint.config.mjs frontend/vite.config.ts frontend/playwright.config.ts
git commit -m "chore(frontend): package manifest, vite, tsconfig, eslint and playwright setup"
```

## 32. feat(frontend): html shell, app entry and global styles

```bash
git add frontend/index.html frontend/src/main.tsx frontend/src/App.tsx frontend/src/styles
git commit -m "feat(frontend): html shell, app entry and global styles"
```

## 33. feat(frontend): providers, query client, router and theme wiring

```bash
git add frontend/src/app
git commit -m "feat(frontend): providers, query client, router and theme wiring"
```

## 34. feat(frontend): shared api types and test setup

```bash
git add frontend/src/types frontend/src/test
git commit -m "feat(frontend): shared api types and test setup"
```

## 35. feat(frontend): api client and formatting/geo/user-agent helpers

```bash
git add frontend/src/lib/api.ts frontend/src/lib/utils.ts frontend/src/lib/format.ts frontend/src/lib/hostname.ts frontend/src/lib/geo.ts frontend/src/lib/user-agent.ts frontend/src/lib/view-mode.ts
git commit -m "feat(frontend): api client and formatting/geo/user-agent helpers"
```

## 36. feat(frontend): argon2id kdf and encoding primitives

```bash
git add frontend/src/lib/crypto/encoding.ts frontend/src/lib/crypto/kdf.ts
git commit -m "feat(frontend): argon2id kdf and encoding primitives"
```

## 37. feat(frontend): vault key wrap/unwrap and IndexedDB key persistence

```bash
git add frontend/src/lib/crypto/vault.ts frontend/src/lib/crypto/key-store.ts
git commit -m "feat(frontend): vault key wrap/unwrap and IndexedDB key persistence"
```

## 38. feat(frontend): ecdh secret sharing and reset escrow

```bash
git add frontend/src/lib/crypto/share.ts frontend/src/lib/crypto/escrow.ts
git commit -m "feat(frontend): ecdh secret sharing and reset escrow"
```

## 39. feat(frontend): webauthn passkey unlock and extension pairing wrap

```bash
git add frontend/src/lib/crypto/passkey.ts frontend/src/lib/crypto/extension-link.ts
git commit -m "feat(frontend): webauthn passkey unlock and extension pairing wrap"
```

## 40. feat(frontend): password generator and strength estimator

```bash
git add frontend/src/lib/crypto/generator.ts
git commit -m "feat(frontend): password generator and strength estimator"
```

## 41. test(frontend): crypto unit tests

```bash
git add frontend/src/lib/crypto/crypto.test.ts frontend/src/lib/crypto/escrow.test.ts frontend/src/lib/crypto/generator.test.ts frontend/src/lib/crypto/share.test.ts
git commit -m "test(frontend): crypto unit tests"
```

## 42. feat(frontend): csv import, env files, expiry, audit and breach libraries

```bash
git add frontend/src/lib/importers.ts frontend/src/lib/env-file.ts frontend/src/lib/expiry.ts frontend/src/lib/audit.ts frontend/src/lib/breach.ts frontend/src/lib/wifi-qr.ts
git commit -m "feat(frontend): csv import, env files, expiry, audit and breach libraries"
```

## 43. test(frontend): lib unit tests

```bash
git add frontend/src/lib/audit.test.ts frontend/src/lib/env-file.test.ts frontend/src/lib/importers.test.ts frontend/src/lib/wifi-qr.test.ts
git commit -m "test(frontend): lib unit tests"
```

## 44. feat(frontend): ui component library

```bash
git add frontend/src/components/ui
git commit -m "feat(frontend): ui component library"
```

## 45. feat(frontend): app shell, sidebar, top bar and user menu layout

```bash
git add frontend/src/components/layout
git commit -m "feat(frontend): app shell, sidebar, top bar and user menu layout"
```

## 46. feat(frontend): auth context, guards, unlock screen and mutations

```bash
git add frontend/src/features/auth
git commit -m "feat(frontend): auth context, guards, unlock screen and mutations"
```

## 47. feat(frontend): vault context, provider and decrypted queries

```bash
git add frontend/src/features/vault/vault-context.ts frontend/src/features/vault/vault-provider.tsx frontend/src/features/vault/queries.ts
git commit -m "feat(frontend): vault context, provider and decrypted queries"
```

## 48. feat(frontend): secret categories metadata and favicon component

```bash
git add frontend/src/features/vault/categories.ts frontend/src/features/vault/favicon.tsx
git commit -m "feat(frontend): secret categories metadata and favicon component"
```

## 49. feat(frontend): vault list, grid and filter bar

```bash
git add frontend/src/features/vault/secret-list.tsx frontend/src/features/vault/secret-grid.tsx frontend/src/features/vault/secret-filters.tsx
git commit -m "feat(frontend): vault list, grid and filter bar"
```

## 50. feat(frontend): secret editor form and dynamic fields

```bash
git add frontend/src/features/vault/secret-form.tsx frontend/src/features/vault/secret-fields.tsx
git commit -m "feat(frontend): secret editor form and dynamic fields"
```

## 51. feat(frontend): attachments card and version history dialog

```bash
git add frontend/src/features/vault/attachments-card.tsx frontend/src/features/vault/versions-dialog.tsx
git commit -m "feat(frontend): attachments card and version history dialog"
```

## 52. feat(frontend): password generator and wifi qr dialogs

```bash
git add frontend/src/features/vault/generator-dialog.tsx frontend/src/features/vault/wifi-qr-dialog.tsx
git commit -m "feat(frontend): password generator and wifi qr dialogs"
```

## 53. feat(frontend): auth and verification routes

```bash
git add frontend/src/routes/login.tsx frontend/src/routes/signup.tsx frontend/src/routes/forgot-password.tsx frontend/src/routes/reset-password.tsx frontend/src/routes/verify-email.tsx
git commit -m "feat(frontend): auth and verification routes"
```

## 54. feat(frontend): landing, 404 and extension consent routes

```bash
git add frontend/src/routes/landing.tsx frontend/src/routes/not-found.tsx frontend/src/routes/link-extension.tsx
git commit -m "feat(frontend): landing, 404 and extension consent routes"
```

## 55. feat(frontend): vault and secret detail routes

```bash
git add frontend/src/routes/vault.tsx frontend/src/routes/secret-new.tsx frontend/src/routes/secret-detail.tsx frontend/src/routes/secret-edit.tsx
git commit -m "feat(frontend): vault and secret detail routes"
```

## 56. feat(frontend): folders page and folder tree components

```bash
git add frontend/src/routes/folders.tsx frontend/src/features/folders
git commit -m "feat(frontend): folders page and folder tree components"
```

## 57. feat(frontend): organisations - workspace provider, switcher and management

```bash
git add frontend/src/features/workspace
git commit -m "feat(frontend): organisations - workspace provider, switcher and management"
```

## 58. feat(frontend): favorites, recent and trash routes

```bash
git add frontend/src/routes/favorites.tsx frontend/src/routes/recent.tsx frontend/src/routes/trash.tsx
git commit -m "feat(frontend): favorites, recent and trash routes"
```

## 59. feat(frontend): dashboard cards, charts and route

```bash
git add frontend/src/features/dashboard frontend/src/routes/dashboard.tsx
git commit -m "feat(frontend): dashboard cards, charts and route"
```

## 60. feat(frontend): password health audit with auto breach scan

```bash
git add frontend/src/routes/audit.tsx
git commit -m "feat(frontend): password health audit with auto breach scan"
```

## 61. feat(frontend): activity labels and history route

```bash
git add frontend/src/features/history frontend/src/routes/activity.tsx
git commit -m "feat(frontend): activity labels and history route"
```

## 62. feat(frontend): sharing and emergency access routes

```bash
git add frontend/src/features/sharing frontend/src/features/emergency frontend/src/routes/sharing.tsx
git commit -m "feat(frontend): sharing and emergency access routes"
```

## 63. feat(frontend): security page - sessions, totp, passkeys, map

```bash
git add frontend/src/routes/security.tsx
git commit -m "feat(frontend): security page - sessions, totp, passkeys, map"
```

## 64. feat(frontend): settings, preferences and env import

```bash
git add frontend/src/features/settings frontend/src/features/env-import frontend/src/routes/settings.tsx
git commit -m "feat(frontend): settings, preferences and env import"
```

## 65. feat(frontend): command palette

```bash
git add frontend/src/features/palette
git commit -m "feat(frontend): command palette"
```

## 66. feat(frontend): logo, icons, robots and pwa assets

```bash
git add frontend/public
git commit -m "feat(frontend): logo, icons, robots and pwa assets"
```

## 67. test(frontend): playwright e2e suite and helper scripts

```bash
git add frontend/e2e frontend/scripts
git commit -m "test(frontend): playwright e2e suite and helper scripts"
```

## 68. chore(frontend): nginx dockerfile, vercel config and dockerignore

```bash
git add frontend/Dockerfile frontend/nginx.conf frontend/.dockerignore frontend/vercel.json
git commit -m "chore(frontend): nginx dockerfile, vercel config and dockerignore"
```

## 69. chore(frontend): env example

```bash
git add frontend/.env.example
git commit -m "chore(frontend): env example"
```

## 70. feat(extension): mv3 manifest and icon

```bash
git add extension/.gitignore extension/manifest.json extension/icon.png
git commit -m "feat(extension): mv3 manifest and icon"
```

## 71. feat(extension): vendored noble argon2 modules

```bash
git add extension/vendor
git commit -m "feat(extension): vendored noble argon2 modules"
```

## 72. feat(extension): argon2id and vault crypto parity module

```bash
git add extension/crypto.js
git commit -m "feat(extension): argon2id and vault crypto parity module"
```

## 73. feat(extension): popup shell - landing, login and vault screens

```bash
git add extension/app.html extension/app.css
git commit -m "feat(extension): popup shell - landing, login and vault screens"
```

## 74. feat(extension): popup logic - sign-in, unlock, vault list, theming

```bash
git add extension/app.js
git commit -m "feat(extension): popup logic - sign-in, unlock, vault list, theming"
```

## 75. feat(extension): autofill and credential capture content script

```bash
git add extension/content.js
git commit -m "feat(extension): autofill and credential capture content script"
```

## 76. feat(extension): service worker - capture queue, badge, fill target

```bash
git add extension/background.js
git commit -m "feat(extension): service worker - capture queue, badge, fill target"
```

## 77. docs(extension): setup and architecture notes

```bash
git add extension/README.md
git commit -m "docs(extension): setup and architecture notes"
```

## 78. docs: deployment and security documentation

```bash
git add docs
git commit -m "docs: deployment and security documentation"
```

## 79. chore: docker stack - two hub images with inline env defaults

```bash
git add docker-compose.yml .env.docker.example README.md
git commit -m "chore: docker stack - two hub images with inline env defaults"
```

## 80. docs: commit guide

```bash
git add COMMITS.md
git commit -m "docs: commit guide"
```

## Final - push everything

```bash
git push -u origin main
```

> First time on GitHub? Create the remote first:
>
> ```bash
> git remote add origin https://github.com/phoenixdev100/vaultory.git
> git push -u origin main
> ```
