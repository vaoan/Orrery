# References

Date: 2026-11-11

Command: `themis references themis libra eclipse-con`

Each link, backticked path, pnpm script, themis command and skill name an instruction file mentions, checked against the body. Exceptions are skipped on purpose and listed; external names are plugin skills, accepted without verification.

## themis

Files read: 1, references checked: 23, broken: 0, exceptions: 14, external: 0

Exceptions:

| file | line | kind | token | why |
|---|---|---|---|---|
| CLAUDE.md | 33 | path | vaoan/AeleOS | example |
| CLAUDE.md | 34 | path | vaoan/libra | example |
| CLAUDE.md | 35 | path | vaoan/Puck | example |
| CLAUDE.md | 36 | path | vaoan/eclipse-con | example |
| CLAUDE.md | 37 | path | vaoan/Janus | example |
| CLAUDE.md | 97 | path | type/* | example |
| CLAUDE.md | 98 | path | release/* | example |
| CLAUDE.md | 99 | command | themis release | example |
| CLAUDE.md | 99 | path | hotfix/* | example |
| CLAUDE.md | 104 | path | back-merge/<sha> | example |
| CLAUDE.md | 106 | path | feat/reconcile-records-command | example |
| CLAUDE.md | 106 | path | feat/2b-task-5 | example |
| CLAUDE.md | 106 | command | themis ci | example |
| CLAUDE.md | 139 | path | node_modules/.pnpm/node_modules | example |

## libra

Files read: 79, references checked: 1034, broken: 379, exceptions: 29, external: 0

Broken:

| file | line | kind | token | reason |
|---|---|---|---|---|
| CLAUDE.md | 124 | path | LoginForm.tsx | no such file |
| CLAUDE.md | 125 | path | useAuth.ts | no such file |
| CLAUDE.md | 126 | path | formatDate.ts | no such file |
| CLAUDE.md | 127 | path | UserTypes.ts | no such file |
| CLAUDE.md | 227 | skill | auth | no such skill in the body |
| CLAUDE.md | 228 | skill | store | no such skill in the body |
| CLAUDE.md | 229 | skill | admin | no such skill in the body |
| CLAUDE.md | 231 | skill | payments | no such skill in the body |
| CLAUDE.md | 232 | skill | studio | no such skill in the body |
| CLAUDE.md | 236 | path | apps/[app]/src/features/[feature-name]/ | no such file |
| CLAUDE.md | 237 | path | domain/ | no such file |
| CLAUDE.md | 237 | path | application/ | no such file |
| CLAUDE.md | 237 | path | infrastructure/ | no such file |
| CLAUDE.md | 237 | path | presentation/ | no such file |
| CLAUDE.md | 238 | path | index.ts | no such file |
| CLAUDE.md | 239 | path | app/ | no such file |
| CLAUDE.md | 250 | path | shared/ | no such file |
| .claude/rules/architecture.md | 42 | path | index.ts | no such file |
| .claude/rules/architecture.md | 48 | path | ../../../ | no such file |
| .claude/rules/architecture.md | 57 | path | ./Component | no such file |
| .claude/rules/architecture.md | 57 | path | ./types | no such file |
| .claude/rules/architecture.md | 130 | skill | app | no such skill in the body |
| .claude/rules/architecture.md | 150 | path | page.tsx | no such file |
| .claude/rules/architecture.md | 151 | skill | shared | no such skill in the body |
| .claude/rules/architecture.md | 152 | path | route.ts | no such file |
| .claude/rules/architecture.md | 177 | path | apps/[app]/src/shared/ | no such file |
| .claude/rules/architecture.md | 183 | path | shared/presentation/components/ | no such file |
| .claude/rules/architecture.md | 184 | path | shared/application/hooks/ | no such file |
| .claude/rules/architecture.md | 185 | path | shared/infrastructure/i18n/ | no such file |
| .claude/rules/architecture.md | 186 | path | shared/infrastructure/config/ | no such file |
| .claude/rules/architecture.md | 196 | path | features/users/presentation/components/ | no such file |
| .claude/rules/architecture.md | 197 | path | features/auth/application/hooks/ | no such file |
| .claude/rules/architecture.md | 198 | path | features/orders/domain/types/ | no such file |
| .claude/rules/architecture.md | 231 | path | api/supabase | no such file |
| .claude/rules/architecture.md | 231 | path | api/supabase/browser | no such file |
| .claude/rules/architecture.md | 232 | path | api/supabase/server | no such file |
| .claude/rules/architecture.md | 232 | path | api/supabase/types | no such file |
| .claude/rules/architecture.md | 234 | path | api/types/generated | no such file |
| .claude/rules/code-review-standards.md | 124 | path | globals.css | no such file |
| .claude/rules/code-review-standards.md | 177 | path | index.ts | no such file |
| .claude/rules/code-review-standards.md | 180 | path | ../domain | no such file |
| .claude/rules/code-review-standards.md | 181 | path | ../../other-feature | no such file |
| .claude/rules/code-review-standards.md | 182 | path | ../shared | no such file |
| .claude/rules/code-review-standards.md | 183 | path | ./types | no such file |
| .claude/rules/code-review-standards.md | 184 | path | ../.. | no such file |
| .claude/rules/code-review-standards.md | 184 | path | ../domain | no such file |
| .claude/rules/code-review-standards.md | 184 | path | ../application | no such file |
| .claude/rules/code-review-standards.md | 184 | path | ../shared | no such file |
| .claude/rules/code-review-standards.md | 186 | path | domain/constants.ts | no such file |
| .claude/rules/code-review-standards.md | 188 | path | domain/types/ | no such file |
| .claude/rules/code-review-standards.md | 189 | path | src/mocks/data/ | no such file |
| .claude/rules/code-review-standards.md | 250 | path | bg-success/10 | no such file |
| .claude/rules/code-review-standards.md | 250 | path | bg-green-500/10 | no such file |
| .claude/rules/code-review-standards.md | 276 | path | .test.tsx | no such file |
| .claude/rules/css-consistency.md | 17 | path | globals.css | no such file |
| .claude/rules/css-consistency.md | 18 | path | globals.css | no such file |
| .claude/rules/css-consistency.md | 28 | path | globals.css | no such file |
| .claude/rules/css-consistency.md | 47 | path | globals.css | no such file |
| .claude/rules/css-consistency.md | 72 | path | globals.css | no such file |
| .claude/rules/css-consistency.md | 82 | path | globals.css | no such file |
| .claude/rules/css-consistency.md | 90 | path | globals.css | no such file |
| .claude/rules/css-consistency.md | 108 | path | globals.css | no such file |
| .claude/rules/git-workflow.md | 31 | path | release/* | glob matches no file |
| .claude/rules/git-workflow.md | 32 | path | fix/* | glob matches no file |
| .claude/rules/git-workflow.md | 48 | path | feat/* | glob matches no file |
| .claude/rules/git-workflow.md | 49 | path | chore/* | glob matches no file |
| .claude/rules/git-workflow.md | 50 | path | refactor/* | glob matches no file |
| .claude/rules/git-workflow.md | 52 | path | release/* | glob matches no file |
| .claude/rules/git-workflow.md | 53 | path | fix/* | glob matches no file |
| .claude/rules/git-workflow.md | 82 | path | fix/* | glob matches no file |
| .claude/rules/git-workflow.md | 141 | path | feat/GH-42_User-Authentication | no such file |
| .claude/rules/git-workflow.md | 142 | path | fix/GH-15_Login-Error | no such file |
| .claude/rules/git-workflow.md | 143 | path | chore/GH-88_Update-Dependencies | no such file |
| .claude/rules/git-workflow.md | 144 | path | docs/GH-92_API-Documentation | no such file |
| .claude/rules/git-workflow.md | 145 | path | refactor/GH-55_Cleanup-Auth | no such file |
| .claude/rules/git-workflow.md | 146 | path | release/GH-100_v2026.04.22.1 | no such file |
| .claude/rules/git-workflow.md | 317 | path | release/GH-XXX_vYYYY.MM.DD.N | no such file |
| .claude/rules/libraries-over-manual-code.md | 13 | path | unicorn/no-document-cookie | no such file |
| .claude/rules/mcp-standards.md | 33 | path | node_modules/ | no such file |
| .claude/rules/monorepo-architecture.md | 141 | path | src/generated/ | no such file |
| .claude/rules/monorepo-architecture.md | 142 | path | src/types/generated/ | no such file |
| .claude/rules/monorepo-architecture.md | 143 | path | src/mutator/ | no such file |
| .claude/rules/monorepo-architecture.md | 177 | path | generated/ | no such file |
| .claude/rules/monorepo-architecture.md | 177 | path | types/generated/ | no such file |
| .claude/rules/monorepo-architecture.md | 214 | path | ./Component | no such file |
| .claude/rules/monorepo-architecture.md | 218 | path | ./ThemeProvider | no such file |
| .claude/rules/monorepo-architecture.md | 481 | path | apps/[app-name]/ | no such file |
| .claude/rules/monorepo-architecture.md | 483 | path | shared/infrastructure/i18n/ | no such file |
| .claude/rules/monorepo-architecture.md | 496 | path | shared/ | no such file |
| .claude/rules/multi-agent-persistence.md | 30 | path | .ai-context/reports/ | no such file |
| .claude/rules/multi-agent-persistence.md | 43 | path | {sub-agent-type}_{timestamp}.json | glob matches no file |
| .claude/rules/multi-agent-persistence.md | 43 | path | mcp-audit_2026-01-16T10-30-00.json | no such file |
| .claude/rules/multi-agent-persistence.md | 44 | path | {skill-name}_{timestamp}.md | glob matches no file |
| .claude/rules/multi-agent-persistence.md | 44 | path | ai-documents-audit_2026-01-16T10-30-00.md | no such file |
| .claude/rules/multi-agent-persistence.md | 110 | path | *-audit_*.json | glob matches no file |
| .claude/rules/multi-agent-persistence.md | 111 | path | *-analysis_*.json | glob matches no file |
| .claude/rules/multi-agent-persistence.md | 112 | path | *-review_*.json | glob matches no file |
| .claude/rules/naming-conventions.md | 9 | path | user-management/ | no such file |
| .claude/rules/naming-conventions.md | 10 | path | domain/ | no such file |
| .claude/rules/naming-conventions.md | 10 | path | application/ | no such file |
| .claude/rules/naming-conventions.md | 11 | path | LoginForm/ | no such file |
| .claude/rules/naming-conventions.md | 17 | path | LoginForm.tsx | no such file |
| .claude/rules/naming-conventions.md | 18 | path | useAuth.ts | no such file |
| .claude/rules/naming-conventions.md | 19 | path | formatDate.ts | no such file |
| .claude/rules/naming-conventions.md | 20 | path | UserTypes.ts | no such file |
| .claude/rules/naming-conventions.md | 21 | path | apiEndpoints.ts | no such file |
| .claude/rules/naming-conventions.md | 22 | path | AuthService.ts | no such file |
| .claude/rules/naming-conventions.md | 23 | path | UserRepository.ts | no such file |
| .claude/rules/naming-conventions.md | 24 | path | LoginForm.test.tsx | no such file |
| .claude/rules/naming-conventions.md | 26 | path | src/shared/presentation/components/ui/ | no such file |
| .claude/rules/naming-conventions.md | 32 | path | index.ts | no such file |
| .claude/rules/naming-conventions.md | 33 | path | types.ts | no such file |
| .claude/rules/naming-conventions.md | 34 | path | constants.ts | no such file |
| .claude/rules/naming-conventions.md | 35 | path | schema.ts | no such file |
| .claude/rules/naming-conventions.md | 203 | path | ./types | no such file |
| .claude/rules/no-hardcoding.md | 230 | path | features/[feature]/domain/constants.ts | no such file |
| .claude/rules/no-hardcoding.md | 230 | path | features/orders/domain/constants.ts | no such file |
| .claude/rules/no-hardcoding.md | 231 | path | shared/domain/constants.ts | no such file |
| .claude/rules/no-hardcoding.md | 231 | path | shared/domain/constants.ts | no such file |
| .claude/rules/no-hardcoding.md | 232 | path | features/[feature]/domain/types/index.ts | no such file |
| .claude/rules/no-hardcoding.md | 232 | path | features/users/domain/types/index.ts | no such file |
| .claude/rules/no-hardcoding.md | 233 | path | shared/domain/types/index.ts | no such file |
| .claude/rules/no-hardcoding.md | 233 | path | shared/domain/types/index.ts | no such file |
| .claude/rules/no-hardcoding.md | 234 | path | src/mocks/data/[entity].ts | no such file |
| .claude/rules/no-hardcoding.md | 234 | path | src/mocks/data/users.ts | no such file |
| .claude/rules/no-hardcoding.md | 235 | path | src/mocks/handlers/[feature].ts | no such file |
| .claude/rules/no-hardcoding.md | 235 | path | src/mocks/handlers/users.ts | no such file |
| .claude/rules/no-hardcoding.md | 236 | path | shared/infrastructure/config/env.ts | no such file |
| .claude/rules/no-hardcoding.md | 236 | path | shared/infrastructure/config/env.ts | no such file |
| .claude/rules/no-hardcoding.md | 237 | path | shared/infrastructure/config/features.ts | no such file |
| .claude/rules/no-hardcoding.md | 237 | path | shared/infrastructure/config/features.ts | no such file |
| .claude/rules/no-hardcoding.md | 238 | path | features/[feature]/infrastructure/api/endpoints.ts | no such file |
| .claude/rules/no-hardcoding.md | 238 | path | features/users/infrastructure/api/endpoints.ts | no such file |
| .claude/rules/no-hardcoding.md | 239 | path | shared/presentation/theme/ | no such file |
| .claude/rules/no-hardcoding.md | 239 | path | globals.css | no such file |
| .claude/rules/one-component-per-file.md | 114 | path | src/shared/presentation/components/ui/ | no such file |
| .claude/rules/one-component-per-file.md | 132 | path | *.spec.tsx | glob matches no file |
| .claude/rules/one-component-per-file.md | 180 | path | UserCard.tsx | no such file |
| .claude/rules/one-component-per-file.md | 181 | path | UserList.tsx | no such file |
| .claude/rules/one-component-per-file.md | 182 | path | UserForm.tsx | no such file |
| .claude/rules/one-component-per-file.md | 196 | path | index.ts | no such file |
| .claude/rules/one-component-per-file.md | 245 | path | ui/ | no such file |
| .claude/rules/one-component-per-file.md | 298 | path | react/no-multi-comp | no such file |
| .claude/rules/one-component-per-file.md | 333 | path | ui/ | no such file |
| .claude/rules/portability.md | 44 | path | ./src/ | no such file |
| .claude/rules/portability.md | 44 | path | features/[feature-name]/ | no such file |
| .claude/rules/portability.md | 216 | path | .claude/portability-exceptions.json | no such file |
| .claude/rules/single-source-of-truth.md | 13 | path | globals.css | no such file |
| .claude/rules/single-source-of-truth.md | 14 | path | globals.css | no such file |
| .claude/rules/single-source-of-truth.md | 16 | path | src/shared/infrastructure/i18n/messages/*.json | glob matches no file |
| .claude/rules/single-source-of-truth.md | 17 | path | domain/constants.ts | no such file |
| .claude/rules/single-source-of-truth.md | 18 | path | domain/types/ | no such file |
| .claude/rules/single-source-of-truth.md | 70 | path | globals.css | no such file |
| .claude/rules/single-source-of-truth.md | 71 | path | globals.css | no such file |
| .claude/rules/single-source-of-truth.md | 161 | path | en.json | no such file |
| .claude/rules/single-source-of-truth.md | 162 | path | es.json | no such file |
| .claude/rules/single-source-of-truth.md | 219 | path | shared/presentation/theme/constants.ts | no such file |
| .claude/rules/single-source-of-truth.md | 220 | path | features/[feature]/domain/constants.ts | no such file |
| .claude/rules/single-source-of-truth.md | 221 | path | shared/infrastructure/config/ | no such file |
| .claude/rules/single-source-of-truth.md | 255 | path | en.json | no such file |
| .claude/rules/single-source-of-truth.md | 256 | path | es.json | no such file |
| .claude/rules/storybook.md | 438 | command | pnpm storybook | no such pnpm script |
| .claude/rules/storybook.md | 441 | command | pnpm build-storybook | no such pnpm script |
| .claude/rules/storybook.md | 444 | command | pnpm test-storybook | no such pnpm script |
| .claude/rules/storybook.md | 447 | command | pnpm test-storybook | no such pnpm script |
| .claude/rules/tailwind.md | 13 | path | src/app/globals.css | no such file |
| .claude/rules/tailwind.md | 14 | path | postcss.config.mjs | no such file |
| .claude/rules/tailwind.md | 17 | path | tailwind.config.js | no such file |
| .claude/rules/tailwind.md | 70 | path | text-foreground/50 | no such file |
| .claude/rules/telegram-notifications.md | 34 | path | notify-bug-issue.yml | no such file |
| .claude/rules/telegram-notifications.md | 35 | path | notify-deploy.yml | no such file |
| .claude/rules/telegram-notifications.md | 45 | path | sync-secrets.yml | no such file |
| .claude/rules/testing.md | 14 | path | e2e/**/*.spec.ts | glob matches no file |
| .claude/rules/testing.md | 15 | path | src/mocks/ | no such file |
| .claude/rules/testing.md | 17 | path | e2e/visual/ | no such file |
| .claude/rules/testing.md | 147 | path | constants.test.ts | no such file |
| .claude/rules/testing.md | 148 | path | checkout-constants.test.ts | no such file |
| .claude/rules/testing.md | 151 | path | ./LoginForm | no such file |
| .claude/rules/testing.md | 159 | path | tsconfig.json | no such file |
| .claude/rules/testing.md | 163 | path | colors.css | no such file |
| .claude/rules/testing.md | 164 | path | ../src/styles/ | no such file |
| .claude/rules/testing.md | 447 | path | accessibility.test.tsx | no such file |
| .claude/rules/url-state.md | 123 | path | src/test/utils.tsx | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 80 | path | .ai-context/reports/ | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 91 | path | {audit-type}_YYYY-MM-DDTHH-MM-SS.json | glob matches no file |
| .claude/skills/ai-documents-audit/SKILL.md | 112 | path | .ai-context/reports/ | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 314 | path | .ai-context/README.md | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 360 | path | .claude/portability-exceptions.json | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 368 | path | .claude/portability-exceptions.json | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 406 | path | .claude/portability-exceptions.json | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 618 | path | .claude/docs/examples/ | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 644 | path | .ai-context/reports/ | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 646 | path | ai-documents-audit_YYYY-MM-DDTHH-MM-SS.md | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 648 | path | .ai-context/reports/ai-documents-audit_YYYY-MM-DDTHH-MM-SS.md | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 650 | path | ai-documents-audit_2026-01-09T17-00-28.md | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 1290 | path | .ai-context/reports/ | no such file |
| .claude/skills/analyze-bundle/SKILL.md | 48 | path | .ai-context/reports/bundle-analysis-{timestamp}.md | glob matches no file |
| .claude/skills/capture-evidences/SKILL.md | 53 | path | feat/GH-162_Title | no such file |
| .claude/skills/capture-evidences/SKILL.md | 55 | path | .ai-context/task-outputs/GH-{number}/images/ | glob matches no file |
| .claude/skills/capture-evidences/SKILL.md | 163 | path | .ai-context/task-outputs/GH-{number}/images/ | glob matches no file |
| .claude/skills/checkpoint/SKILL.md | 26 | path | .ai-context/checkpoints/{branch}/RESUME.md | glob matches no file |
| .claude/skills/checkpoint/SKILL.md | 65 | path | .ai-context/checkpoints/ai-structure/RESUME.md | no such file |
| .claude/skills/checkpoint/SKILL.md | 66 | path | feat/GH-42_User-Auth | no such file |
| .claude/skills/checkpoint/SKILL.md | 66 | path | .ai-context/checkpoints/feat-GH-42_User-Auth/RESUME.md | no such file |
| .claude/skills/checkpoint/SKILL.md | 153 | path | .ai-context/checkpoints/{branch}/RESUME.md | glob matches no file |
| .claude/skills/checkpoint/SKILL.md | 298 | path | feat/GH-42_User-Auth | no such file |
| .claude/skills/checkpoint/SKILL.md | 434 | link | ../../../.ai-context/README.md | no such file |
| .claude/skills/code-review/SKILL.md | 127 | skill | app | no such skill in the body |
| .claude/skills/code-review/SKILL.md | 134 | path | features/X | no such file |
| .claude/skills/code-review/SKILL.md | 134 | path | features/Y | no such file |
| .claude/skills/code-review/SKILL.md | 164 | path | bg-green-500/10 | no such file |
| .claude/skills/code-review/SKILL.md | 164 | path | bg-success/10 | no such file |
| .claude/skills/code-review/SKILL.md | 206 | path | globals.css | no such file |
| .claude/skills/commit-push/SKILL.md | 209 | path | ../domain | no such file |
| .claude/skills/commit-push/SKILL.md | 226 | path | components/ | no such file |
| .claude/skills/commit-push/SKILL.md | 228 | path | utils/ | no such file |
| .claude/skills/commit-push/SKILL.md | 229 | path | services/ | no such file |
| .claude/skills/create-api-integration/SKILL.md | 275 | path | features/orders/domain/types/order.ts | no such file |
| .claude/skills/create-api-integration/SKILL.md | 276 | path | features/orders/infrastructure/api/orderApi.ts | no such file |
| .claude/skills/create-api-integration/SKILL.md | 277 | path | features/orders/application/hooks/useOrders.ts | no such file |
| .claude/skills/create-component/SKILL.md | 36 | path | src/shared/presentation/components/[ComponentName]/ | no such file |
| .claude/skills/create-component/SKILL.md | 37 | path | src/features/[feature]/presentation/components/[ComponentName]/ | no such file |
| .claude/skills/create-component/SKILL.md | 95 | path | [ComponentName].test.tsx | no such file |
| .claude/skills/create-feature/SKILL.md | 34 | path | src/features/ | no such file |
| .claude/skills/create-feature/SKILL.md | 154 | path | app/(protected)/[feature-name]/page.tsx | no such file |
| .claude/skills/create-feature/SKILL.md | 201 | path | src/features/orders/ | no such file |
| .claude/skills/create-feature/SKILL.md | 206 | path | index.ts | no such file |
| .claude/skills/create-feature/SKILL.md | 207 | path | index.ts | no such file |
| .claude/skills/create-hook/SKILL.md | 37 | path | features/[feature]/application/hooks/ | no such file |
| .claude/skills/create-hook/SKILL.md | 38 | path | features/[feature]/presentation/hooks/ | no such file |
| .claude/skills/create-hook/SKILL.md | 39 | path | shared/application/hooks/ | no such file |
| .claude/skills/create-hook/SKILL.md | 293 | path | src/features/orders/application/hooks/useOrders.ts | no such file |
| .claude/skills/create-hook/SKILL.md | 301 | path | src/shared/application/hooks/useDebounce.ts | no such file |
| .claude/skills/create-hook/SKILL.md | 309 | path | src/features/orders/presentation/hooks/useOrderModal.ts | no such file |
| .claude/skills/create-release/SKILL.md | 25 | path | release/* | glob matches no file |
| .claude/skills/create-release/SKILL.md | 61 | path | pr-checks.yml | no such file |
| .claude/skills/create-release/SKILL.md | 65 | path | release/* | glob matches no file |
| .claude/skills/create-release/SKILL.md | 65 | path | fix/* | glob matches no file |
| .claude/skills/create-release/SKILL.md | 65 | path | release/vYYYY.MM.DD.N | no such file |
| .claude/skills/create-release/SKILL.md | 79 | path | release/vYYYY.MM.DD.N | no such file |
| .claude/skills/create-release/SKILL.md | 86 | path | release/v2025.01.09.1 | no such file |
| .claude/skills/create-release/SKILL.md | 87 | path | release/v2025.01.09.2 | no such file |
| .claude/skills/create-release/SKILL.md | 88 | path | release/v2025.12.15.1 | no such file |
| .claude/skills/create-release/SKILL.md | 177 | path | release/* | glob matches no file |
| .claude/skills/create-release/SKILL.md | 178 | path | release/* | glob matches no file |
| .claude/skills/create-release/SKILL.md | 178 | path | fix/* | glob matches no file |
| .claude/skills/create-release/SKILL.md | 308 | path | release.yml | no such file |
| .claude/skills/create-release/SKILL.md | 340 | path | release/vYYYY.MM.DD.N | no such file |
| .claude/skills/create-release/SKILL.md | 348 | path | fix/GH-XXX_Description | no such file |
| .claude/skills/create-release/SKILL.md | 359 | path | release/ | no such file |
| .claude/skills/create-release/SKILL.md | 395 | path | release/v2025.01.09.1 | no such file |
| .claude/skills/create-release/SKILL.md | 419 | path | release/v2025.01.09.2 | no such file |
| .claude/skills/e2e-eval/SKILL.md | 45 | path | .ai-context/reports/e2e-eval-*.md | glob matches no file |
| .claude/skills/e2e-eval/SKILL.md | 412 | path | test-results/ | no such file |
| .claude/skills/e2e-eval/SKILL.md | 536 | path | .ai-context/reports/ | no such file |
| .claude/skills/e2e-eval/SKILL.md | 708 | path | .ai-context/reports/e2e-eval-*.md | glob matches no file |
| .claude/skills/e2e-eval/SKILL.md | 711 | path | apps/{app}/e2e/... | glob matches no file |
| .claude/skills/e2e-eval/SKILL.md | 747 | path | e2e.mjs | no such file |
| .claude/skills/figma/SKILL.md | 93 | path | src/shared/presentation/components/ui/ | no such file |
| .claude/skills/figma/SKILL.md | 94 | path | src/shared/presentation/components/ | no such file |
| .claude/skills/figma/SKILL.md | 95 | path | src/features/*/presentation/components/ | glob matches no file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 34 | path | .ai-context/reports/ | no such file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 45 | path | .ai-context/reports/ | no such file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 46 | path | ai-documents-audit_*.md | glob matches no file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 55 | path | ai-documents-audit_YYYY-MM-DDTHH-MM-SS.md | no such file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 193 | path | mycompany/myproject | no such file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 193 | path | {owner}/{repo} | glob matches no file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 194 | path | ./ | no such file |
| .claude/skills/full-review/SKILL.md | 120 | path | src/ | no such file |
| .claude/skills/full-review/SKILL.md | 120 | path | src/features/dashboard | no such file |
| .claude/skills/full-review/SKILL.md | 139 | path | src/ | no such file |
| .claude/skills/full-review/SKILL.md | 148 | path | .claude/skills/full-review/agents/{agent}.md | glob matches no file |
| .claude/skills/full-review/SKILL.md | 150 | path | src/ | no such file |
| .claude/skills/full-review/SKILL.md | 169 | path | {id}_architecture.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 170 | path | {id}_solid.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 171 | path | {id}_dry.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 172 | path | {id}_component-patterns.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 173 | path | {id}_naming-conventions.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 174 | path | {id}_bug-detection.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_tailwind.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_testing.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_security.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_performance.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_pattern-discovery.json | glob matches no file |
| .claude/skills/full-review/SKILL.md | 263 | path | .ai-context/reviews/{review_id}_review.md | glob matches no file |
| .claude/skills/full-review/SKILL.md | 546 | path | {review_id}_*.json | glob matches no file |
| .claude/skills/generate-setup-guide/SKILL.md | 49 | path | .ai-context/setup-guide.md | no such file |
| .claude/skills/generate-setup-guide/SKILL.md | 208 | path | src/features/ | no such file |
| .claude/skills/generate-setup-guide/SKILL.md | 418 | path | {type}/GH-{number}_{title} | glob matches no file |
| .claude/skills/generate-setup-guide/SKILL.md | 424 | path | app/ | no such file |
| .claude/skills/i18n/SKILL.md | 419 | path | routing.ts | no such file |
| .claude/skills/i18n/SKILL.md | 420 | path | request.ts | no such file |
| .claude/skills/i18n/SKILL.md | 421 | path | navigation.ts | no such file |
| .claude/skills/i18n/SKILL.md | 422 | path | middleware.ts | no such file |
| .claude/skills/i18n/SKILL.md | 423 | path | next.config.ts | no such file |
| .claude/skills/i18n/SKILL.md | 437 | path | request.ts | no such file |
| .claude/skills/i18n/SKILL.md | 437 | path | next.config.ts | no such file |
| .claude/skills/investigate-error/SKILL.md | 72 | path | .ai-context/reports/error-investigation-{timestamp}.md | glob matches no file |
| .claude/skills/merge-pr/SKILL.md | 458 | path | feat/GH-42_User-Auth | no such file |
| .claude/skills/post-merge/SKILL.md | 308 | path | feat/GH-42_User-Auth | no such file |
| .claude/skills/project-intelligence/SKILL.md | 45 | path | .ai-context/reports/project-intelligence_{timestamp}.md | glob matches no file |
| .claude/skills/project-intelligence/SKILL.md | 87 | path | .ai-context/reports/ | no such file |
| .claude/skills/resume-checkpoint/SKILL.md | 10 | path | .ai-context/checkpoints/{branch}/RESUME.md | glob matches no file |
| .claude/skills/resume-checkpoint/SKILL.md | 189 | path | feat/GH-42_User-Auth | no such file |
| .claude/skills/resume-checkpoint/SKILL.md | 352 | link | ../../../.ai-context/README.md | no such file |
| .claude/skills/review-pr-comments/SKILL.md | 73 | path | .ai-context/task-outputs/GH-XXXX/08-pr-review-tracking.md | no such file |
| .claude/skills/review-pr-comments/SKILL.md | 183 | path | feat/GH-42_Title | no such file |
| .claude/skills/review-pr-comments/SKILL.md | 378 | path | .ai-context/task-outputs/GH-XXXX/08-pr-review-tracking.md | no such file |
| .claude/skills/run-tests/SKILL.md | 309 | path | vitest.config.ts | no such file |
| .claude/skills/security-audit/SKILL.md | 36 | path | .ai-context/reports/security-audit-{YYYY-MM-DD-HHmmss}.md | glob matches no file |
| .claude/skills/start-task/SKILL.md | 31 | skill | brainstorming | no such skill in the body |
| .claude/skills/start-task/SKILL.md | 83 | path | task-overview.md | no such file |
| .claude/skills/start-task/SKILL.md | 84 | path | setup.md | no such file |
| .claude/skills/start-task/SKILL.md | 85 | path | analysis.md | no such file |
| .claude/skills/start-task/SKILL.md | 86 | path | implementation-plan.md | no such file |
| .claude/skills/start-task/SKILL.md | 87 | path | implementation-log.md | no such file |
| .claude/skills/start-task/SKILL.md | 88 | path | testing-results.md | no such file |
| .claude/skills/start-task/SKILL.md | 89 | path | review-notes.md | no such file |
| .claude/skills/start-task/SKILL.md | 120 | path | feat/GH-42_User-Authentication | no such file |
| .claude/skills/start-task/SKILL.md | 121 | path | fix/GH-15_Login-Redirect-Error | no such file |
| .claude/skills/start-task/SKILL.md | 122 | path | chore/GH-88_Update-Dependencies | no such file |
| .claude/skills/start-task/SKILL.md | 123 | path | docs/GH-92_API-Documentation | no such file |
| .claude/skills/start-task/SKILL.md | 242 | path | .ai-context/task-outputs/GH-{number}/images/ | glob matches no file |
| .claude/skills/start-task/SKILL.md | 330 | path | {type}/GH-{number}_{Formatted-Title} | glob matches no file |
| .claude/skills/start-task/SKILL.md | 448 | path | .ai-context/task-outputs/GH-{number}/02-analysis.md | glob matches no file |
| .claude/skills/start-task/SKILL.md | 810 | path | path/to/file.tsx | no such file |
| .claude/skills/start-task/SKILL.md | 868 | path | path/to/file.tsx | no such file |
| .claude/skills/start-task/SKILL.md | 902 | path | Component.test.tsx | no such file |
| .claude/skills/start-task/SKILL.md | 903 | path | useHook.test.ts | no such file |
| .claude/skills/start-task/SKILL.md | 954 | path | feat/GH-42_Other-Task | no such file |
| .claude/skills/start-task/SKILL.md | 965 | path | feat/GH-42_User-Auth | no such file |
| .claude/skills/storybook/SKILL.md | 308 | path | shared/presentation/components/atoms/ | no such file |
| .claude/skills/storybook/SKILL.md | 308 | path | Atoms/ | no such file |
| .claude/skills/storybook/SKILL.md | 309 | path | shared/presentation/components/molecules/ | no such file |
| .claude/skills/storybook/SKILL.md | 309 | path | Molecules/ | no such file |
| .claude/skills/storybook/SKILL.md | 310 | path | shared/presentation/components/organisms/ | no such file |
| .claude/skills/storybook/SKILL.md | 310 | path | Organisms/ | no such file |
| .claude/skills/storybook/SKILL.md | 311 | path | shared/presentation/layouts/ | no such file |
| .claude/skills/storybook/SKILL.md | 311 | path | Templates/ | no such file |
| .claude/skills/storybook/SKILL.md | 312 | path | features/[name]/presentation/components/ | no such file |
| .claude/skills/storybook/SKILL.md | 312 | path | Features/[Name]/ | no such file |
| .claude/skills/storybook/SKILL.md | 327 | command | pnpm storybook | no such pnpm script |
| .claude/skills/storybook/SKILL.md | 345 | command | pnpm build-storybook | no such pnpm script |
| .claude/skills/storybook/SKILL.md | 348 | path | storybook-static/ | no such file |
| .claude/skills/storybook/SKILL.md | 364 | command | pnpm test-storybook | no such pnpm script |
| .claude/skills/storybook/SKILL.md | 367 | command | pnpm test-storybook | no such pnpm script |
| .claude/skills/storybook/SKILL.md | 417 | path | Component/Component.stories.tsx | no such file |
| .claude/skills/storybook/SKILL.md | 418 | path | ComponentName.stories.tsx | no such file |
| .claude/skills/storybook/SKILL.md | 451 | path | .storybook/preview.ts | no such file |
| .claude/skills/storybook/SKILL.md | 453 | path | tsconfig.json | no such file |
| .claude/skills/submit-pr/SKILL.md | 66 | path | release/* | glob matches no file |
| .claude/skills/submit-pr/SKILL.md | 67 | path | fix/* | glob matches no file |
| .claude/skills/submit-pr/SKILL.md | 114 | path | feat/GH-42_Title | no such file |
| .claude/skills/submit-pr/SKILL.md | 164 | path | feat/GH-42_Login | no such file |
| .claude/skills/submit-pr/SKILL.md | 165 | path | chore/GH-88_Deps | no such file |
| .claude/skills/submit-pr/SKILL.md | 166 | path | release/GH-100_v1.0 | no such file |
| .claude/skills/submit-pr/SKILL.md | 167 | path | fix/GH-99_Hotfix | no such file |
| .claude/skills/submit-pr/SKILL.md | 683 | path | release/* | glob matches no file |
| .claude/skills/submit-pr/SKILL.md | 684 | path | fix/* | glob matches no file |
| .claude/skills/submit-pr/SKILL.md | 685 | path | feat/* | glob matches no file |
| .claude/skills/submit-pr/SKILL.md | 686 | path | chore/* | glob matches no file |
| .claude/skills/submit-pr/SKILL.md | 687 | path | refactor/* | glob matches no file |
| .claude/skills/submit-pr/SKILL.md | 715 | path | git@github.com:{owner}/{repo}.git | glob matches no file |
| .claude/skills/sync-with-develop/SKILL.md | 111 | path | feat/GH-XXX_Title | no such file |
| .claude/skills/sync-with-develop/SKILL.md | 389 | path | ../domain | no such file |
| .claude/skills/sync-with-develop/SKILL.md | 439 | path | types.ts | no such file |
| .claude/skills/sync-with-develop/SKILL.md | 547 | path | coverage/coverage-summary.json | no such file |
| .claude/skills/tailwind/SKILL.md | 14 | path | tailwind.config.js | no such file |
| .claude/skills/tailwind/SKILL.md | 24 | path | postcss.config.mjs | no such file |
| .claude/skills/tailwind/SKILL.md | 25 | path | src/app/globals.css | no such file |
| .claude/skills/tailwind/SKILL.md | 26 | path | components.json | no such file |
| .claude/skills/verify-code/SKILL.md | 103 | path | import/order | no such file |
| .claude/skills/verify-code/SKILL.md | 159 | path | vitest.config.ts | no such file |
| .claude/skills/verify-code/SKILL.md | 182 | command | pnpm smoke | no such pnpm script |
| .claude/agents/README.md | 23 | path | AGENT.md | no such file |
| .claude/agents/nextjs-architecture-expert.md | 163 | path | _app.js | no such file |
| .claude/agents/nextjs-architecture-expert.md | 163 | path | layout.tsx | no such file |
| .claude/agents/nextjs-architecture-expert.md | 164 | path | pages/api/ | no such file |
| .claude/agents/nextjs-architecture-expert.md | 164 | path | app/api/*/route.ts | glob matches no file |

Exceptions:

| file | line | kind | token | why |
|---|---|---|---|---|
| CLAUDE.md | 230 | path | <absolute path> | absolute |
| .claude/rules/architecture.md | 39 | path | <absolute path> | absolute |
| .claude/rules/architecture.md | 40 | path | <absolute path> | absolute |
| .claude/rules/architecture.md | 235 | path | api/generated/<tag>/<tag> | example |
| .claude/rules/portability.md | 33 | path | <absolute path> | absolute |
| .claude/rules/portability.md | 206 | path | <absolute path> | absolute |
| .claude/rules/testing.md | 13 | path | <workspace>/tests/ | example |
| .claude/skills/ai-documents-audit/SKILL.md | 326 | path | <absolute path> | absolute |
| .claude/skills/checkpoint/SKILL.md | 68 | path | <absolute path> | absolute |
| .claude/skills/checkpoint/SKILL.md | 144 | path | <absolute path> | absolute |
| .claude/skills/checkpoint/SKILL.md | 412 | path | <absolute path> | absolute |
| .claude/skills/e2e-eval/SKILL.md | 167 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 168 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 169 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 170 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 176 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 177 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 178 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 179 | command | pnpm --dir | flags |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 194 | path | <absolute path> | absolute |
| .claude/skills/project-intelligence/SKILL.md | 583 | path | <absolute path> | absolute |
| .claude/skills/resume-checkpoint/SKILL.md | 59 | path | <absolute path> | absolute |
| .claude/skills/security-audit/SKILL.md | 506 | path | .ai-context/reports/security-audit-${timestamp}.md | variable |
| .claude/skills/verify-code/SKILL.md | 275 | command | pnpm --filter | flags |
| .claude/skills/verify-code/SKILL.md | 276 | command | pnpm --filter | flags |
| .claude/skills/verify-code/SKILL.md | 277 | command | pnpm --filter | flags |
| .claude/skills/verify-code/SKILL.md | 278 | command | pnpm --filter | flags |
| .claude/skills/verify-code/SKILL.md | 279 | command | pnpm --filter | flags |
| .claude/agents/frontend-developer.md | 87 | path | <absolute path> | absolute |

## eclipse-con

Files read: 23, references checked: 165, broken: 72, exceptions: 1, external: 0

Broken:

| file | line | kind | token | reason |
|---|---|---|---|---|
| CLAUDE.md | 137 | path | worker/test/d1.ts | no such file |
| CLAUDE.md | 160 | path | index.css | no such file |
| CLAUDE.md | 161 | path | src/locales/ | no such file |
| CLAUDE.md | 212 | path | src/* | glob matches no file |
| CLAUDE.md | 316 | path | src/shared/infrastructure/config/environment.ts | no such file |
| CLAUDE.md | 321 | path | apps/sunfest2027/src/sections/[Name].tsx | no such file |
| CLAUDE.md | 321 | path | [Name].test.tsx | no such file |
| CLAUDE.md | 324 | path | index.css | no such file |
| CLAUDE.md | 325 | path | src/locales/en.json | no such file |
| CLAUDE.md | 325 | path | es.json | no such file |
| CLAUDE.md | 326 | path | src/App.tsx | no such file |
| CLAUDE.md | 330 | path | apps/moonfest2026/src/features/[name]/ | no such file |
| CLAUDE.md | 331 | path | domain/ | no such file |
| CLAUDE.md | 331 | path | application/ | no such file |
| CLAUDE.md | 331 | path | infrastructure/ | no such file |
| CLAUDE.md | 331 | path | presentation/ | no such file |
| CLAUDE.md | 332 | path | index.ts | no such file |
| CLAUDE.md | 333 | path | presentation/ | no such file |
| CLAUDE.md | 334 | path | src/app/router.tsx | no such file |
| CLAUDE.md | 335 | path | en.json | no such file |
| CLAUDE.md | 335 | path | es.json | no such file |
| .claude/rules/architecture.md | 6 | path | src/sections/ | no such file |
| .claude/rules/architecture.md | 6 | path | src/components/ | no such file |
| .claude/rules/architecture.md | 6 | path | src/lib/ | no such file |
| .claude/rules/architecture.md | 6 | path | src/locales/ | no such file |
| .claude/rules/architecture.md | 11 | path | src/features/[name]/ | no such file |
| .claude/rules/architecture.md | 31 | path | domain/ | no such file |
| .claude/rules/architecture.md | 32 | path | application/ | no such file |
| .claude/rules/architecture.md | 32 | path | domain/ | no such file |
| .claude/rules/architecture.md | 33 | path | presentation/ | no such file |
| .claude/rules/architecture.md | 33 | path | application/ | no such file |
| .claude/rules/architecture.md | 33 | path | domain/ | no such file |
| .claude/rules/architecture.md | 34 | path | infrastructure/ | no such file |
| .claude/rules/architecture.md | 34 | path | application/ | no such file |
| .claude/rules/architecture.md | 34 | path | domain/ | no such file |
| .claude/rules/architecture.md | 36 | path | presentation/ | no such file |
| .claude/rules/architecture.md | 36 | path | infrastructure/ | no such file |
| .claude/rules/architecture.md | 36 | path | domain/ | no such file |
| .claude/rules/architecture.md | 36 | path | application/ | no such file |
| .claude/rules/architecture.md | 61 | path | index.ts | no such file |
| .claude/rules/dry-principle.md | 7 | path | src/shared/application/hooks/ | no such file |
| .claude/rules/dry-principle.md | 8 | path | src/shared/application/utils/ | no such file |
| .claude/rules/dry-principle.md | 8 | path | src/shared/domain/ | no such file |
| .claude/rules/dry-principle.md | 16 | path | src/shared/presentation/components/ | no such file |
| .claude/rules/git-workflow.md | 9 | path | feature/ | no such file |
| .claude/rules/git-workflow.md | 9 | path | feature/user-profile | no such file |
| .claude/rules/git-workflow.md | 10 | path | fix/ | no such file |
| .claude/rules/git-workflow.md | 10 | path | fix/login-redirect | no such file |
| .claude/rules/git-workflow.md | 11 | path | chore/ | no such file |
| .claude/rules/git-workflow.md | 11 | path | chore/update-tailwind | no such file |
| .claude/rules/git-workflow.md | 12 | path | refactor/ | no such file |
| .claude/rules/git-workflow.md | 12 | path | refactor/auth-service | no such file |
| .claude/rules/i18n-testing.md | 46 | path | copy.test.ts | no such file |
| .claude/rules/i18n-testing.md | 46 | path | i18n-parity.test.ts | no such file |
| .claude/rules/jsdoc.md | 12 | path | src/shared/presentation/ui/ | no such file |
| .claude/rules/jsdoc.md | 12 | path | src/test/ | no such file |
| .claude/rules/naming-conventions.md | 7 | path | UserCard.tsx | no such file |
| .claude/rules/naming-conventions.md | 8 | path | UserProfile.ts | no such file |
| .claude/rules/naming-conventions.md | 9 | path | useAuth.ts | no such file |
| .claude/rules/naming-conventions.md | 10 | path | formatDate.ts | no such file |
| .claude/rules/naming-conventions.md | 11 | path | authService.ts | no such file |
| .claude/rules/naming-conventions.md | 12 | path | vite-env.d.ts | no such file |
| .claude/rules/naming-conventions.md | 12 | path | tailwind.config.ts | no such file |
| .claude/rules/naming-conventions.md | 13 | path | UserCard.test.tsx | no such file |
| .claude/rules/naming-conventions.md | 13 | path | formatDate.test.ts | no such file |
| .claude/rules/one-component-per-file.md | 38 | path | .types.ts | no such file |
| .claude/rules/portability.md | 21 | path | environment.ts | no such file |
| .claude/rules/portability.md | 47 | path | package-lock.json | no such file |
| .claude/rules/single-source-of-truth.md | 23 | path | domain/ | no such file |
| .claude/rules/single-source-of-truth.md | 36 | path | environment.ts | no such file |
| .claude/rules/single-source-of-truth.md | 48 | path | src/shared/domain/constants/ | no such file |
| .claude/rules/testing.md | 53 | path | e2e/ | no such file |

Exceptions:

| file | line | kind | token | why |
|---|---|---|---|---|
| CLAUDE.md | 41 | path | fco.bz/<slug> | example |

