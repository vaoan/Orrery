# References

Date: 2026-11-11

Command: `themis references themis libra eclipse-con`

Each link, backticked path, pnpm script, themis command and skill name an instruction file mentions, checked against the body. Exceptions are skipped on purpose and listed; external names are plugin skills, accepted without verification.

## themis

Files read: 1, references checked: 26, broken: 0, exceptions: 12, external: 0

Exceptions:

| file | line | kind | token | why |
|---|---|---|---|---|
| CLAUDE.md | 33 | path | vaoan/AeleOS | repository name |
| CLAUDE.md | 34 | path | vaoan/libra | repository name |
| CLAUDE.md | 35 | path | vaoan/Puck | repository name |
| CLAUDE.md | 36 | path | vaoan/eclipse-con | repository name |
| CLAUDE.md | 37 | path | vaoan/Janus | repository name |
| CLAUDE.md | 97 | path | type/* | branch name |
| CLAUDE.md | 98 | path | release/* | branch name |
| CLAUDE.md | 99 | path | hotfix/* | branch name |
| CLAUDE.md | 104 | path | back-merge/<sha> | example |
| CLAUDE.md | 106 | path | feat/reconcile-records-command | branch name |
| CLAUDE.md | 106 | path | feat/2b-task-5 | branch name |
| CLAUDE.md | 139 | path | node_modules/.pnpm/node_modules | example |

## libra

Files read: 79, references checked: 831, broken: 104, exceptions: 308, external: 1

Broken:

| file | line | kind | token | reason |
|---|---|---|---|---|
| CLAUDE.md | 124 | path | LoginForm.tsx | no such file |
| CLAUDE.md | 125 | path | useAuth.ts | no such file |
| CLAUDE.md | 126 | path | formatDate.ts | no such file |
| CLAUDE.md | 127 | path | UserTypes.ts | no such file |
| .claude/rules/architecture.md | 234 | path | api/types/generated | no such file |
| .claude/rules/code-review-standards.md | 186 | path | domain/constants.ts | no such file |
| .claude/rules/code-review-standards.md | 250 | path | bg-success/10 | no such file |
| .claude/rules/code-review-standards.md | 250 | path | bg-green-500/10 | no such file |
| .claude/rules/code-review-standards.md | 276 | path | .test.tsx | no such file |
| .claude/rules/git-workflow.md | 144 | path | docs/GH-92_API-Documentation | no such file |
| .claude/rules/multi-agent-persistence.md | 43 | path | mcp-audit_2026-01-16T10-30-00.json | no such file |
| .claude/rules/multi-agent-persistence.md | 44 | path | ai-documents-audit_2026-01-16T10-30-00.md | no such file |
| .claude/rules/multi-agent-persistence.md | 110 | path | *-audit_*.json | glob matches no file |
| .claude/rules/multi-agent-persistence.md | 111 | path | *-analysis_*.json | glob matches no file |
| .claude/rules/multi-agent-persistence.md | 112 | path | *-review_*.json | glob matches no file |
| .claude/rules/naming-conventions.md | 17 | path | LoginForm.tsx | no such file |
| .claude/rules/naming-conventions.md | 18 | path | useAuth.ts | no such file |
| .claude/rules/naming-conventions.md | 19 | path | formatDate.ts | no such file |
| .claude/rules/naming-conventions.md | 20 | path | UserTypes.ts | no such file |
| .claude/rules/naming-conventions.md | 21 | path | apiEndpoints.ts | no such file |
| .claude/rules/naming-conventions.md | 22 | path | AuthService.ts | no such file |
| .claude/rules/naming-conventions.md | 23 | path | UserRepository.ts | no such file |
| .claude/rules/naming-conventions.md | 24 | path | LoginForm.test.tsx | no such file |
| .claude/rules/naming-conventions.md | 35 | path | schema.ts | no such file |
| .claude/rules/no-hardcoding.md | 232 | path | features/users/domain/types/index.ts | no such file |
| .claude/rules/no-hardcoding.md | 233 | path | shared/domain/types/index.ts | no such file |
| .claude/rules/no-hardcoding.md | 233 | path | shared/domain/types/index.ts | no such file |
| .claude/rules/no-hardcoding.md | 234 | path | src/mocks/data/users.ts | no such file |
| .claude/rules/no-hardcoding.md | 235 | path | src/mocks/handlers/users.ts | no such file |
| .claude/rules/no-hardcoding.md | 236 | path | shared/infrastructure/config/env.ts | no such file |
| .claude/rules/no-hardcoding.md | 236 | path | shared/infrastructure/config/env.ts | no such file |
| .claude/rules/no-hardcoding.md | 237 | path | shared/infrastructure/config/features.ts | no such file |
| .claude/rules/no-hardcoding.md | 237 | path | shared/infrastructure/config/features.ts | no such file |
| .claude/rules/no-hardcoding.md | 238 | path | features/users/infrastructure/api/endpoints.ts | no such file |
| .claude/rules/one-component-per-file.md | 132 | path | *.spec.tsx | glob matches no file |
| .claude/rules/one-component-per-file.md | 180 | path | UserCard.tsx | no such file |
| .claude/rules/one-component-per-file.md | 181 | path | UserList.tsx | no such file |
| .claude/rules/one-component-per-file.md | 182 | path | UserForm.tsx | no such file |
| .claude/rules/one-component-per-file.md | 298 | path | react/no-multi-comp | no such file |
| .claude/rules/single-source-of-truth.md | 17 | path | domain/constants.ts | no such file |
| .claude/rules/single-source-of-truth.md | 219 | path | shared/presentation/theme/constants.ts | no such file |
| .claude/rules/storybook.md | 438 | command | pnpm storybook | no such pnpm script |
| .claude/rules/storybook.md | 441 | command | pnpm build-storybook | no such pnpm script |
| .claude/rules/storybook.md | 444 | command | pnpm test-storybook | no such pnpm script |
| .claude/rules/storybook.md | 447 | command | pnpm test-storybook | no such pnpm script |
| .claude/rules/tailwind.md | 17 | path | tailwind.config.js | no such file |
| .claude/rules/tailwind.md | 70 | path | text-foreground/50 | no such file |
| .claude/rules/telegram-notifications.md | 35 | path | notify-deploy.yml | no such file |
| .claude/rules/url-state.md | 123 | path | src/test/utils.tsx | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 314 | path | .ai-context/README.md | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 646 | path | ai-documents-audit_YYYY-MM-DDTHH-MM-SS.md | no such file |
| .claude/skills/ai-documents-audit/SKILL.md | 650 | path | ai-documents-audit_2026-01-09T17-00-28.md | no such file |
| .claude/skills/checkpoint/SKILL.md | 65 | path | .ai-context/checkpoints/ai-structure/RESUME.md | no such file |
| .claude/skills/checkpoint/SKILL.md | 66 | path | .ai-context/checkpoints/feat-GH-42_User-Auth/RESUME.md | no such file |
| .claude/skills/checkpoint/SKILL.md | 434 | link | ../../../.ai-context/README.md | no such file |
| .claude/skills/code-review/SKILL.md | 134 | path | features/X | no such file |
| .claude/skills/code-review/SKILL.md | 134 | path | features/Y | no such file |
| .claude/skills/code-review/SKILL.md | 164 | path | bg-green-500/10 | no such file |
| .claude/skills/code-review/SKILL.md | 164 | path | bg-success/10 | no such file |
| .claude/skills/create-api-integration/SKILL.md | 275 | path | features/orders/domain/types/order.ts | no such file |
| .claude/skills/create-api-integration/SKILL.md | 276 | path | features/orders/infrastructure/api/orderApi.ts | no such file |
| .claude/skills/create-api-integration/SKILL.md | 277 | path | features/orders/application/hooks/useOrders.ts | no such file |
| .claude/skills/create-hook/SKILL.md | 293 | path | src/features/orders/application/hooks/useOrders.ts | no such file |
| .claude/skills/create-hook/SKILL.md | 301 | path | src/shared/application/hooks/useDebounce.ts | no such file |
| .claude/skills/create-hook/SKILL.md | 309 | path | src/features/orders/presentation/hooks/useOrderModal.ts | no such file |
| .claude/skills/e2e-eval/SKILL.md | 45 | path | .ai-context/reports/e2e-eval-*.md | glob matches no file |
| .claude/skills/e2e-eval/SKILL.md | 708 | path | .ai-context/reports/e2e-eval-*.md | glob matches no file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 46 | path | ai-documents-audit_*.md | glob matches no file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 55 | path | ai-documents-audit_YYYY-MM-DDTHH-MM-SS.md | no such file |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 193 | path | mycompany/myproject | no such file |
| .claude/skills/generate-setup-guide/SKILL.md | 49 | path | .ai-context/setup-guide.md | no such file |
| .claude/skills/i18n/SKILL.md | 419 | path | routing.ts | no such file |
| .claude/skills/i18n/SKILL.md | 421 | path | navigation.ts | no such file |
| .claude/skills/i18n/SKILL.md | 422 | path | middleware.ts | no such file |
| .claude/skills/resume-checkpoint/SKILL.md | 352 | link | ../../../.ai-context/README.md | no such file |
| .claude/skills/review-pr-comments/SKILL.md | 73 | path | .ai-context/task-outputs/GH-XXXX/08-pr-review-tracking.md | no such file |
| .claude/skills/review-pr-comments/SKILL.md | 378 | path | .ai-context/task-outputs/GH-XXXX/08-pr-review-tracking.md | no such file |
| .claude/skills/run-tests/SKILL.md | 309 | path | vitest.config.ts | no such file |
| .claude/skills/start-task/SKILL.md | 83 | path | task-overview.md | no such file |
| .claude/skills/start-task/SKILL.md | 84 | path | setup.md | no such file |
| .claude/skills/start-task/SKILL.md | 85 | path | analysis.md | no such file |
| .claude/skills/start-task/SKILL.md | 86 | path | implementation-plan.md | no such file |
| .claude/skills/start-task/SKILL.md | 87 | path | implementation-log.md | no such file |
| .claude/skills/start-task/SKILL.md | 88 | path | testing-results.md | no such file |
| .claude/skills/start-task/SKILL.md | 89 | path | review-notes.md | no such file |
| .claude/skills/start-task/SKILL.md | 123 | path | docs/GH-92_API-Documentation | no such file |
| .claude/skills/start-task/SKILL.md | 810 | path | path/to/file.tsx | no such file |
| .claude/skills/start-task/SKILL.md | 868 | path | path/to/file.tsx | no such file |
| .claude/skills/start-task/SKILL.md | 902 | path | Component.test.tsx | no such file |
| .claude/skills/start-task/SKILL.md | 903 | path | useHook.test.ts | no such file |
| .claude/skills/storybook/SKILL.md | 327 | command | pnpm storybook | no such pnpm script |
| .claude/skills/storybook/SKILL.md | 345 | command | pnpm build-storybook | no such pnpm script |
| .claude/skills/storybook/SKILL.md | 364 | command | pnpm test-storybook | no such pnpm script |
| .claude/skills/storybook/SKILL.md | 367 | command | pnpm test-storybook | no such pnpm script |
| .claude/skills/storybook/SKILL.md | 417 | path | Component/Component.stories.tsx | no such file |
| .claude/skills/storybook/SKILL.md | 418 | path | ComponentName.stories.tsx | no such file |
| .claude/skills/storybook/SKILL.md | 451 | path | .storybook/preview.ts | no such file |
| .claude/skills/tailwind/SKILL.md | 14 | path | tailwind.config.js | no such file |
| .claude/skills/tailwind/SKILL.md | 26 | path | components.json | no such file |
| .claude/skills/verify-code/SKILL.md | 103 | path | import/order | no such file |
| .claude/skills/verify-code/SKILL.md | 159 | path | vitest.config.ts | no such file |
| .claude/skills/verify-code/SKILL.md | 182 | command | pnpm smoke | no such pnpm script |
| .claude/agents/nextjs-architecture-expert.md | 163 | path | _app.js | no such file |
| .claude/agents/nextjs-architecture-expert.md | 164 | path | app/api/*/route.ts | glob matches no file |

Exceptions:

| file | line | kind | token | why |
|---|---|---|---|---|
| CLAUDE.md | 133 | path | @/* | package specifier |
| CLAUDE.md | 227 | skill | auth | route |
| CLAUDE.md | 228 | skill | store | route |
| CLAUDE.md | 229 | skill | admin | route |
| CLAUDE.md | 230 | path | <absolute path> | absolute |
| CLAUDE.md | 231 | skill | payments | route |
| CLAUDE.md | 232 | skill | studio | route |
| CLAUDE.md | 304 | skill | submit-pr | route |
| CLAUDE.md | 305 | skill | full-review | route |
| CLAUDE.md | 306 | skill | verify-code | route |
| CLAUDE.md | 307 | skill | review-branch | route |
| .claude/rules/architecture.md | 39 | path | <absolute path> | absolute |
| .claude/rules/architecture.md | 40 | path | <absolute path> | absolute |
| .claude/rules/architecture.md | 48 | path | ../../../ | import specifier |
| .claude/rules/architecture.md | 54 | path | @/features/dashboard/domain/types | package specifier |
| .claude/rules/architecture.md | 55 | path | @/features/auth/application/hooks | package specifier |
| .claude/rules/architecture.md | 56 | path | @/shared/infrastructure/i18n | package specifier |
| .claude/rules/architecture.md | 57 | path | ./Component | import specifier |
| .claude/rules/architecture.md | 57 | path | ./types | import specifier |
| .claude/rules/architecture.md | 58 | path | @/test/utils | package specifier |
| .claude/rules/architecture.md | 95 | path | ../ | import specifier |
| .claude/rules/architecture.md | 130 | skill | app | route |
| .claude/rules/architecture.md | 151 | skill | shared | route |
| .claude/rules/architecture.md | 235 | path | api/generated/<tag>/<tag> | example |
| .claude/rules/build-checks.md | 155 | skill | submit-pr | route |
| .claude/rules/build-checks.md | 269 | skill | submit-pr | route |
| .claude/rules/code-review-standards.md | 9 | skill | full-review | route |
| .claude/rules/code-review-standards.md | 180 | path | @/features/[feature]/[layer] | package specifier |
| .claude/rules/code-review-standards.md | 180 | path | ../domain | import specifier |
| .claude/rules/code-review-standards.md | 181 | path | @/features/[other] | package specifier |
| .claude/rules/code-review-standards.md | 181 | path | ../../other-feature | import specifier |
| .claude/rules/code-review-standards.md | 182 | path | @/shared/[layer] | package specifier |
| .claude/rules/code-review-standards.md | 182 | path | ../shared | import specifier |
| .claude/rules/code-review-standards.md | 183 | path | ./types | import specifier |
| .claude/rules/code-review-standards.md | 184 | path | ../.. | import specifier |
| .claude/rules/code-review-standards.md | 184 | path | ../domain | import specifier |
| .claude/rules/code-review-standards.md | 184 | path | ../application | import specifier |
| .claude/rules/code-review-standards.md | 184 | path | ../shared | import specifier |
| .claude/rules/code-review-standards.md | 543 | skill | full-review | route |
| .claude/rules/code-review-standards.md | 544 | skill | fix-full-review | route |
| .claude/rules/e2e-selectors.md | 341 | skill | e2e-eval | route |
| .claude/rules/git-safety.md | 147 | skill | start-task | route |
| .claude/rules/git-safety.md | 148 | skill | submit-pr | route |
| .claude/rules/git-safety.md | 149 | skill | commit-push | route |
| .claude/rules/git-safety.md | 150 | skill | merge-pr | route |
| .claude/rules/git-safety.md | 151 | skill | sync-with-develop | route |
| .claude/rules/git-safety.md | 152 | skill | checkpoint | route |
| .claude/rules/git-workflow.md | 31 | path | release/* | branch name |
| .claude/rules/git-workflow.md | 32 | path | fix/* | branch name |
| .claude/rules/git-workflow.md | 48 | path | feat/* | branch name |
| .claude/rules/git-workflow.md | 49 | path | chore/* | branch name |
| .claude/rules/git-workflow.md | 50 | path | refactor/* | branch name |
| .claude/rules/git-workflow.md | 52 | path | release/* | branch name |
| .claude/rules/git-workflow.md | 53 | path | fix/* | branch name |
| .claude/rules/git-workflow.md | 61 | skill | start-task | route |
| .claude/rules/git-workflow.md | 73 | skill | submit-pr | route |
| .claude/rules/git-workflow.md | 82 | skill | submit-pr | route |
| .claude/rules/git-workflow.md | 82 | path | fix/* | branch name |
| .claude/rules/git-workflow.md | 91 | skill | start-task | route |
| .claude/rules/git-workflow.md | 109 | skill | submit-pr | route |
| .claude/rules/git-workflow.md | 141 | path | feat/GH-42_User-Authentication | branch name |
| .claude/rules/git-workflow.md | 142 | path | fix/GH-15_Login-Error | branch name |
| .claude/rules/git-workflow.md | 143 | path | chore/GH-88_Update-Dependencies | branch name |
| .claude/rules/git-workflow.md | 145 | path | refactor/GH-55_Cleanup-Auth | branch name |
| .claude/rules/git-workflow.md | 146 | path | release/GH-100_v2026.04.22.1 | branch name |
| .claude/rules/git-workflow.md | 170 | skill | start-task | route |
| .claude/rules/git-workflow.md | 186 | skill | submit-pr | route |
| .claude/rules/git-workflow.md | 294 | skill | merge-pr | route |
| .claude/rules/git-workflow.md | 317 | path | release/GH-XXX_vYYYY.MM.DD.N | branch name |
| .claude/rules/git-workflow.md | 410 | skill | start-task | route |
| .claude/rules/git-workflow.md | 411 | skill | submit-pr | route |
| .claude/rules/git-workflow.md | 412 | skill | merge-pr | route |
| .claude/rules/libraries-over-manual-code.md | 13 | path | unicorn/no-document-cookie | eslint rule |
| .claude/rules/libraries-over-manual-code.md | 33 | path | @tanstack/react-query | package specifier |
| .claude/rules/libraries-over-manual-code.md | 39 | path | @tanstack/react-table | package specifier |
| .claude/rules/monorepo-architecture.md | 214 | path | ./Component | import specifier |
| .claude/rules/monorepo-architecture.md | 218 | path | ./ThemeProvider | import specifier |
| .claude/rules/monorepo-architecture.md | 219 | path | @shared/hooks/useTheme | package specifier |
| .claude/rules/monorepo-architecture.md | 220 | path | @ui/utils/cn | package specifier |
| .claude/rules/multi-agent-persistence.md | 43 | path | {sub-agent-type}_{timestamp}.json | placeholder |
| .claude/rules/multi-agent-persistence.md | 44 | path | {skill-name}_{timestamp}.md | placeholder |
| .claude/rules/multi-agent-persistence.md | 99 | skill | fix-ai-documents-audit | route |
| .claude/rules/multi-agent-persistence.md | 110 | skill | ai-documents-audit | route |
| .claude/rules/multi-agent-persistence.md | 111 | skill | project-intelligence | route |
| .claude/rules/multi-agent-persistence.md | 112 | skill | full-review | route |
| .claude/rules/naming-conventions.md | 202 | path | @/features/... | package specifier |
| .claude/rules/naming-conventions.md | 203 | path | ./types | import specifier |
| .claude/rules/one-component-per-file.md | 299 | skill | full-review | route |
| .claude/rules/one-component-per-file.md | 300 | skill | code-review | route |
| .claude/rules/one-component-per-file.md | 301 | skill | commit-push | route |
| .claude/rules/one-component-per-file.md | 302 | skill | sync-with-develop | route |
| .claude/rules/portability.md | 33 | path | <absolute path> | absolute |
| .claude/rules/portability.md | 44 | path | ./src/ | import specifier |
| .claude/rules/portability.md | 151 | skill | ai-documents-audit | route |
| .claude/rules/portability.md | 206 | path | <absolute path> | absolute |
| .claude/rules/storybook.md | 13 | path | @storybook/nextjs-vite | package specifier |
| .claude/rules/tailwind.md | 14 | path | @tailwindcss/postcss | package specifier |
| .claude/rules/testing.md | 13 | path | <workspace>/tests/ | example |
| .claude/rules/testing.md | 151 | path | ./LoginForm | import specifier |
| .claude/rules/testing.md | 152 | path | @/ | package specifier |
| .claude/rules/testing.md | 164 | path | ../src/styles/ | import specifier |
| .claude/rules/testing.md | 441 | path | @axe-core/playwright | package specifier |
| .claude/rules/testing.md | 687 | skill | start-task | route |
| .claude/rules/testing.md | 833 | skill | run-tests | route |
| .claude/rules/testing.md | 834 | skill | e2e-eval | route |
| .claude/skills/ai-documents-audit/SKILL.md | 74 | skill | fix-ai-documents-audit | route |
| .claude/skills/ai-documents-audit/SKILL.md | 91 | path | {audit-type}_YYYY-MM-DDTHH-MM-SS.json | placeholder |
| .claude/skills/ai-documents-audit/SKILL.md | 326 | path | <absolute path> | absolute |
| .claude/skills/ai-documents-audit/SKILL.md | 644 | skill | fix-ai-documents-audit | route |
| .claude/skills/ai-documents-audit/SKILL.md | 655 | skill | fix-ai-documents-audit | route |
| .claude/skills/ai-documents-audit/SKILL.md | 1309 | skill | fix-ai-documents-audit | route |
| .claude/skills/analyze-bundle/SKILL.md | 121 | path | @mui/icons-material | package specifier |
| .claude/skills/capture-evidences/SKILL.md | 53 | path | feat/GH-162_Title | branch name |
| .claude/skills/capture-evidences/SKILL.md | 311 | skill | start-task | route |
| .claude/skills/capture-evidences/SKILL.md | 312 | skill | e2e-eval | route |
| .claude/skills/capture-evidences/SKILL.md | 313 | skill | submit-pr | route |
| .claude/skills/capture-evidences/SKILL.md | 314 | skill | code-review | route |
| .claude/skills/checkpoint/SKILL.md | 66 | path | feat/GH-42_User-Auth | branch name |
| .claude/skills/checkpoint/SKILL.md | 68 | path | <absolute path> | absolute |
| .claude/skills/checkpoint/SKILL.md | 144 | path | <absolute path> | absolute |
| .claude/skills/checkpoint/SKILL.md | 298 | path | feat/GH-42_User-Auth | branch name |
| .claude/skills/checkpoint/SKILL.md | 412 | path | <absolute path> | absolute |
| .claude/skills/checkpoint/SKILL.md | 420 | skill | checkpoint | route |
| .claude/skills/checkpoint/SKILL.md | 431 | skill | resume-checkpoint | route |
| .claude/skills/checkpoint/SKILL.md | 432 | skill | start-task | route |
| .claude/skills/checkpoint/SKILL.md | 433 | skill | submit-pr | route |
| .claude/skills/code-review/SKILL.md | 127 | skill | app | route |
| .claude/skills/commit-push/SKILL.md | 209 | path | ../domain | import specifier |
| .claude/skills/commit-push/SKILL.md | 209 | path | @/features/[feature]/domain | package specifier |
| .claude/skills/create-component/SKILL.md | 95 | path | [ComponentName].test.tsx | placeholder |
| .claude/skills/create-release/SKILL.md | 25 | path | release/* | branch name |
| .claude/skills/create-release/SKILL.md | 65 | path | release/* | branch name |
| .claude/skills/create-release/SKILL.md | 65 | path | fix/* | branch name |
| .claude/skills/create-release/SKILL.md | 65 | path | release/vYYYY.MM.DD.N | branch name |
| .claude/skills/create-release/SKILL.md | 79 | path | release/vYYYY.MM.DD.N | branch name |
| .claude/skills/create-release/SKILL.md | 86 | path | release/v2025.01.09.1 | branch name |
| .claude/skills/create-release/SKILL.md | 87 | path | release/v2025.01.09.2 | branch name |
| .claude/skills/create-release/SKILL.md | 88 | path | release/v2025.12.15.1 | branch name |
| .claude/skills/create-release/SKILL.md | 177 | path | release/* | branch name |
| .claude/skills/create-release/SKILL.md | 178 | path | release/* | branch name |
| .claude/skills/create-release/SKILL.md | 178 | path | fix/* | branch name |
| .claude/skills/create-release/SKILL.md | 340 | path | release/vYYYY.MM.DD.N | branch name |
| .claude/skills/create-release/SKILL.md | 348 | path | fix/GH-XXX_Description | branch name |
| .claude/skills/create-release/SKILL.md | 359 | path | release/ | branch name |
| .claude/skills/create-release/SKILL.md | 395 | path | release/v2025.01.09.1 | branch name |
| .claude/skills/create-release/SKILL.md | 419 | path | release/v2025.01.09.2 | branch name |
| .claude/skills/e2e-eval/SKILL.md | 167 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 168 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 169 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 170 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 176 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 177 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 178 | command | pnpm --dir | flags |
| .claude/skills/e2e-eval/SKILL.md | 179 | command | pnpm --dir | flags |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 47 | skill | ai-documents-audit | route |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 193 | path | {owner}/{repo} | placeholder |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 194 | path | <absolute path> | absolute |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 194 | path | ./ | import specifier |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 356 | skill | ai-documents-audit | route |
| .claude/skills/fix-full-review/SKILL.md | 14 | skill | fix-full-review | route |
| .claude/skills/fix-full-review/SKILL.md | 14 | skill | full-review | route |
| .claude/skills/fix-full-review/SKILL.md | 151 | skill | full-review | route |
| .claude/skills/full-review/SKILL.md | 14 | skill | full-review | route |
| .claude/skills/full-review/SKILL.md | 98 | skill | fix-full-review | route |
| .claude/skills/full-review/SKILL.md | 169 | path | {id}_architecture.json | placeholder |
| .claude/skills/full-review/SKILL.md | 170 | path | {id}_solid.json | placeholder |
| .claude/skills/full-review/SKILL.md | 171 | path | {id}_dry.json | placeholder |
| .claude/skills/full-review/SKILL.md | 172 | path | {id}_component-patterns.json | placeholder |
| .claude/skills/full-review/SKILL.md | 173 | path | {id}_naming-conventions.json | placeholder |
| .claude/skills/full-review/SKILL.md | 174 | path | {id}_bug-detection.json | placeholder |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_tailwind.json | placeholder |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_testing.json | placeholder |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_security.json | placeholder |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_performance.json | placeholder |
| .claude/skills/full-review/SKILL.md | 176 | path | {id}_pattern-discovery.json | placeholder |
| .claude/skills/full-review/SKILL.md | 359 | skill | fix-full-review | route |
| .claude/skills/full-review/SKILL.md | 508 | skill | fix-full-review | route |
| .claude/skills/full-review/SKILL.md | 546 | path | {review_id}_*.json | placeholder |
| .claude/skills/full-review/SKILL.md | 554 | skill | fix-full-review | route |
| .claude/skills/generate-setup-guide/SKILL.md | 412 | skill | run-tests | route |
| .claude/skills/generate-setup-guide/SKILL.md | 413 | skill | submit-pr | route |
| .claude/skills/generate-setup-guide/SKILL.md | 418 | path | {type}/GH-{number}_{title} | placeholder |
| .claude/skills/generate-setup-guide/SKILL.md | 420 | path | @/ | package specifier |
| .claude/skills/merge-pr/SKILL.md | 458 | path | feat/GH-42_User-Auth | branch name |
| .claude/skills/merge-pr/SKILL.md | 632 | skill | submit-pr | route |
| .claude/skills/post-merge/SKILL.md | 53 | skill | merge-pr | route |
| .claude/skills/post-merge/SKILL.md | 308 | path | feat/GH-42_User-Auth | branch name |
| .claude/skills/post-merge/SKILL.md | 443 | skill | merge-pr | route |
| .claude/skills/post-merge/SKILL.md | 444 | skill | submit-pr | route |
| .claude/skills/post-merge/SKILL.md | 445 | skill | start-task | route |
| .claude/skills/project-intelligence/SKILL.md | 583 | path | <absolute path> | absolute |
| .claude/skills/project-intelligence/SKILL.md | 620 | skill | project-intelligence | route |
| .claude/skills/resume-checkpoint/SKILL.md | 59 | path | <absolute path> | absolute |
| .claude/skills/resume-checkpoint/SKILL.md | 189 | path | feat/GH-42_User-Auth | branch name |
| .claude/skills/resume-checkpoint/SKILL.md | 335 | skill | resume-checkpoint | route |
| .claude/skills/resume-checkpoint/SKILL.md | 349 | skill | checkpoint | route |
| .claude/skills/resume-checkpoint/SKILL.md | 350 | skill | start-task | route |
| .claude/skills/resume-checkpoint/SKILL.md | 351 | skill | submit-pr | route |
| .claude/skills/review-branch/SKILL.md | 163 | skill | verify-code | route |
| .claude/skills/review-branch/SKILL.md | 189 | skill | code-review | route |
| .claude/skills/review-branch/SKILL.md | 190 | skill | full-review | route |
| .claude/skills/review-branch/SKILL.md | 191 | skill | verify-code | route |
| .claude/skills/review-pr-comments/SKILL.md | 183 | path | feat/GH-42_Title | branch name |
| .claude/skills/review-pr-comments/SKILL.md | 702 | skill | submit-pr | route |
| .claude/skills/review-pr-comments/SKILL.md | 703 | skill | merge-pr | route |
| .claude/skills/run-tests/SKILL.md | 297 | skill | run-tests | route |
| .claude/skills/run-tests/SKILL.md | 298 | skill | run-tests | route |
| .claude/skills/run-tests/SKILL.md | 299 | skill | run-tests | route |
| .claude/skills/security-audit/SKILL.md | 506 | path | .ai-context/reports/security-audit-${timestamp}.md | variable |
| .claude/skills/start-task/SKILL.md | 83 | skill | start-task | route |
| .claude/skills/start-task/SKILL.md | 84 | skill | start-task | route |
| .claude/skills/start-task/SKILL.md | 85 | skill | start-task | route |
| .claude/skills/start-task/SKILL.md | 88 | skill | run-tests | route |
| .claude/skills/start-task/SKILL.md | 88 | skill | e2e-eval | route |
| .claude/skills/start-task/SKILL.md | 120 | path | feat/GH-42_User-Authentication | branch name |
| .claude/skills/start-task/SKILL.md | 121 | path | fix/GH-15_Login-Redirect-Error | branch name |
| .claude/skills/start-task/SKILL.md | 122 | path | chore/GH-88_Update-Dependencies | branch name |
| .claude/skills/start-task/SKILL.md | 219 | skill | submit-pr | route |
| .claude/skills/start-task/SKILL.md | 330 | path | {type}/GH-{number}_{Formatted-Title} | placeholder |
| .claude/skills/start-task/SKILL.md | 806 | skill | run-tests | route |
| .claude/skills/start-task/SKILL.md | 817 | skill | run-tests | route |
| .claude/skills/start-task/SKILL.md | 827 | skill | run-tests | route |
| .claude/skills/start-task/SKILL.md | 837 | skill | run-tests | route |
| .claude/skills/start-task/SKILL.md | 838 | skill | e2e-eval | route |
| .claude/skills/start-task/SKILL.md | 954 | path | feat/GH-42_Other-Task | branch name |
| .claude/skills/start-task/SKILL.md | 965 | path | feat/GH-42_User-Auth | branch name |
| .claude/skills/storybook/SKILL.md | 46 | path | @storybook/nextjs-vite | package specifier |
| .claude/skills/storybook/SKILL.md | 452 | path | @storybook/nextjs-vite | package specifier |
| .claude/skills/submit-pr/SKILL.md | 66 | path | release/* | branch name |
| .claude/skills/submit-pr/SKILL.md | 67 | path | fix/* | branch name |
| .claude/skills/submit-pr/SKILL.md | 114 | path | feat/GH-42_Title | branch name |
| .claude/skills/submit-pr/SKILL.md | 164 | path | feat/GH-42_Login | branch name |
| .claude/skills/submit-pr/SKILL.md | 165 | path | chore/GH-88_Deps | branch name |
| .claude/skills/submit-pr/SKILL.md | 166 | path | release/GH-100_v1.0 | branch name |
| .claude/skills/submit-pr/SKILL.md | 167 | path | fix/GH-99_Hotfix | branch name |
| .claude/skills/submit-pr/SKILL.md | 683 | path | release/* | branch name |
| .claude/skills/submit-pr/SKILL.md | 684 | path | fix/* | branch name |
| .claude/skills/submit-pr/SKILL.md | 685 | path | feat/* | branch name |
| .claude/skills/submit-pr/SKILL.md | 686 | path | chore/* | branch name |
| .claude/skills/submit-pr/SKILL.md | 687 | path | refactor/* | branch name |
| .claude/skills/submit-pr/SKILL.md | 715 | path | git@github.com:{owner}/{repo}.git | placeholder |
| .claude/skills/submit-pr/SKILL.md | 758 | skill | start-task | route |
| .claude/skills/sync-with-develop/SKILL.md | 111 | path | feat/GH-XXX_Title | branch name |
| .claude/skills/sync-with-develop/SKILL.md | 389 | path | ../domain | import specifier |
| .claude/skills/sync-with-develop/SKILL.md | 438 | path | @/test/utils | package specifier |
| .claude/skills/tailwind/SKILL.md | 24 | path | @tailwindcss/postcss | package specifier |
| .claude/skills/verify-code/SKILL.md | 275 | command | pnpm --filter | flags |
| .claude/skills/verify-code/SKILL.md | 276 | command | pnpm --filter | flags |
| .claude/skills/verify-code/SKILL.md | 277 | command | pnpm --filter | flags |
| .claude/skills/verify-code/SKILL.md | 278 | command | pnpm --filter | flags |
| .claude/skills/verify-code/SKILL.md | 279 | command | pnpm --filter | flags |
| .claude/skills/verify-code/SKILL.md | 318 | skill | run-tests | route |
| .claude/skills/verify-code/SKILL.md | 319 | skill | e2e-eval | route |
| .claude/skills/verify-code/SKILL.md | 320 | skill | submit-pr | route |
| .claude/agents/frontend-developer.md | 87 | path | <absolute path> | absolute |
| .claude/agents/mcp-first/AGENT.md | 152 | skill | ai-documents-audit | route |
| .claude/rules/architecture.md | 198 | path | features/orders/domain/types/ | ignored by .gitignore |
| .claude/rules/code-review-standards.md | 188 | path | domain/types/ | ignored by .gitignore |
| .claude/rules/code-review-standards.md | 189 | path | src/mocks/data/ | ignored by .gitignore |
| .claude/rules/mcp-standards.md | 33 | path | node_modules/ | ignored by .gitignore |
| .claude/rules/monorepo-architecture.md | 141 | path | src/generated/ | ignored by .gitignore |
| .claude/rules/monorepo-architecture.md | 142 | path | src/types/generated/ | ignored by .gitignore |
| .claude/rules/monorepo-architecture.md | 143 | path | src/mutator/ | ignored by .gitignore |
| .claude/rules/monorepo-architecture.md | 177 | path | generated/ | ignored by .gitignore |
| .claude/rules/monorepo-architecture.md | 177 | path | types/generated/ | ignored by .gitignore |
| .claude/rules/multi-agent-persistence.md | 30 | path | .ai-context/reports/ | ignored by .gitignore |
| .claude/rules/naming-conventions.md | 9 | path | user-management/ | ignored by .gitignore |
| .claude/rules/naming-conventions.md | 11 | path | LoginForm/ | ignored by .gitignore |
| .claude/rules/naming-conventions.md | 26 | path | src/shared/presentation/components/ui/ | ignored by .gitignore |
| .claude/rules/no-hardcoding.md | 234 | path | src/mocks/data/[entity].ts | ignored by .gitignore |
| .claude/rules/no-hardcoding.md | 239 | path | shared/presentation/theme/ | ignored by .gitignore |
| .claude/rules/one-component-per-file.md | 114 | path | src/shared/presentation/components/ui/ | ignored by .gitignore |
| .claude/rules/portability.md | 216 | path | .claude/portability-exceptions.json | ignored by .gitignore |
| .claude/rules/single-source-of-truth.md | 18 | path | domain/types/ | ignored by .gitignore |
| .claude/rules/testing.md | 17 | path | e2e/visual/ | ignored by .gitignore |
| .claude/skills/ai-documents-audit/SKILL.md | 80 | path | .ai-context/reports/ | ignored by .gitignore |
| .claude/skills/ai-documents-audit/SKILL.md | 112 | path | .ai-context/reports/ | ignored by .gitignore |
| .claude/skills/ai-documents-audit/SKILL.md | 360 | path | .claude/portability-exceptions.json | ignored by .gitignore |
| .claude/skills/ai-documents-audit/SKILL.md | 368 | path | .claude/portability-exceptions.json | ignored by .gitignore |
| .claude/skills/ai-documents-audit/SKILL.md | 406 | path | .claude/portability-exceptions.json | ignored by .gitignore |
| .claude/skills/ai-documents-audit/SKILL.md | 618 | path | .claude/docs/examples/ | ignored by .gitignore |
| .claude/skills/ai-documents-audit/SKILL.md | 644 | path | .ai-context/reports/ | ignored by .gitignore |
| .claude/skills/ai-documents-audit/SKILL.md | 648 | path | .ai-context/reports/ai-documents-audit_YYYY-MM-DDTHH-MM-SS.md | ignored by .gitignore |
| .claude/skills/ai-documents-audit/SKILL.md | 1290 | path | .ai-context/reports/ | ignored by .gitignore |
| .claude/skills/analyze-bundle/SKILL.md | 48 | path | .ai-context/reports/bundle-analysis-{timestamp}.md | ignored by .gitignore |
| .claude/skills/commit-push/SKILL.md | 229 | path | services/ | ignored by .gitignore |
| .claude/skills/create-feature/SKILL.md | 154 | path | app/(protected)/[feature-name]/page.tsx | ignored by .gitignore |
| .claude/skills/e2e-eval/SKILL.md | 412 | path | test-results/ | ignored by .gitignore |
| .claude/skills/e2e-eval/SKILL.md | 536 | path | .ai-context/reports/ | ignored by .gitignore |
| .claude/skills/figma/SKILL.md | 93 | path | src/shared/presentation/components/ui/ | ignored by .gitignore |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 34 | path | .ai-context/reports/ | ignored by .gitignore |
| .claude/skills/fix-ai-documents-audit/SKILL.md | 45 | path | .ai-context/reports/ | ignored by .gitignore |
| .claude/skills/investigate-error/SKILL.md | 72 | path | .ai-context/reports/error-investigation-{timestamp}.md | ignored by .gitignore |
| .claude/skills/project-intelligence/SKILL.md | 45 | path | .ai-context/reports/project-intelligence_{timestamp}.md | ignored by .gitignore |
| .claude/skills/project-intelligence/SKILL.md | 87 | path | .ai-context/reports/ | ignored by .gitignore |
| .claude/skills/security-audit/SKILL.md | 36 | path | .ai-context/reports/security-audit-{YYYY-MM-DD-HHmmss}.md | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 308 | path | shared/presentation/components/atoms/ | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 308 | path | Atoms/ | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 309 | path | shared/presentation/components/molecules/ | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 309 | path | Molecules/ | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 310 | path | shared/presentation/components/organisms/ | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 310 | path | Organisms/ | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 311 | path | shared/presentation/layouts/ | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 311 | path | Templates/ | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 312 | path | Features/[Name]/ | ignored by .gitignore |
| .claude/skills/storybook/SKILL.md | 348 | path | storybook-static/ | ignored by .gitignore |
| .claude/skills/sync-with-develop/SKILL.md | 547 | path | coverage/coverage-summary.json | ignored by .gitignore |
| .claude/agents/nextjs-architecture-expert.md | 164 | path | pages/api/ | ignored by .gitignore |

External:

| file | line | token | plugin |
|---|---|---|---|
| .claude/skills/start-task/SKILL.md | 31 | brainstorming | unverified |

## eclipse-con

Files read: 23, references checked: 156, broken: 13, exceptions: 12, external: 0

Broken:

| file | line | kind | token | reason |
|---|---|---|---|---|
| .claude/rules/dry-principle.md | 8 | path | src/shared/domain/ | no such file |
| .claude/rules/dry-principle.md | 16 | path | src/shared/presentation/components/ | no such file |
| .claude/rules/naming-conventions.md | 7 | path | UserCard.tsx | no such file |
| .claude/rules/naming-conventions.md | 8 | path | UserProfile.ts | no such file |
| .claude/rules/naming-conventions.md | 9 | path | useAuth.ts | no such file |
| .claude/rules/naming-conventions.md | 10 | path | formatDate.ts | no such file |
| .claude/rules/naming-conventions.md | 11 | path | authService.ts | no such file |
| .claude/rules/naming-conventions.md | 12 | path | tailwind.config.ts | no such file |
| .claude/rules/naming-conventions.md | 13 | path | UserCard.test.tsx | no such file |
| .claude/rules/naming-conventions.md | 13 | path | formatDate.test.ts | no such file |
| .claude/rules/one-component-per-file.md | 38 | path | .types.ts | no such file |
| .claude/rules/portability.md | 47 | path | package-lock.json | no such file |
| .claude/rules/single-source-of-truth.md | 48 | path | src/shared/domain/constants/ | no such file |

Exceptions:

| file | line | kind | token | why |
|---|---|---|---|---|
| CLAUDE.md | 41 | path | fco.bz/<slug> | example |
| CLAUDE.md | 212 | path | @/* | package specifier |
| CLAUDE.md | 321 | path | [Name].test.tsx | placeholder |
| .claude/rules/git-workflow.md | 9 | path | feature/ | branch name |
| .claude/rules/git-workflow.md | 9 | path | feature/user-profile | branch name |
| .claude/rules/git-workflow.md | 10 | path | fix/ | branch name |
| .claude/rules/git-workflow.md | 10 | path | fix/login-redirect | branch name |
| .claude/rules/git-workflow.md | 11 | path | chore/ | branch name |
| .claude/rules/git-workflow.md | 11 | path | chore/update-tailwind | branch name |
| .claude/rules/git-workflow.md | 12 | path | refactor/ | branch name |
| .claude/rules/git-workflow.md | 12 | path | refactor/auth-service | branch name |
| .claude/rules/portability.md | 5 | path | @/ | package specifier |

