# ADR 0002 — ESLint reconciliation input: aeleos vs. libra

**Date:** 2026-09-07
**Status:** accepted

## What this is

This record is a measurement, not a ruling. It captures the output of
`orrery diff-eslint` run once against the two donor repositories, so the
reconciliation work in Phase 2b has a fixed, reproducible starting point. It
contains no judgement on which side of any conflict is correct — that is the
next plan's work.

## Provenance

Command:

```
pnpm orrery diff-eslint Z:/Github/aeleos Z:/Github/libra --json
```

| | aeleos | libra |
|---|---|---|
| Repo path | `Z:/Github/aeleos` | `Z:/Github/libra` |
| Git branch | `fix/clerk-test-identity-leak` | `develop` |
| Git commit | `b9e1c4d` | `1c79de72` |
| Sample file (`pickSampleFile`) | `apps/hub/src/app/[locale]/layout.tsx` | `apps/store/src/app/layout.tsx` |
| `eslint` version (`node_modules/eslint/package.json`) | 9.39.5 | 9.39.4 |

Both repositories had `node_modules` already installed; no install or other
mutating command was run against either.

## Bucket counts

| Bucket | Count |
|---|---|
| agree | 530 |
| onlyA (aeleos only) | 391 |
| onlyB (libra only) | 34 |
| conflict | 55 |

`agree + onlyA + conflict` = 976 = the total rule count `eslint --print-config`
reported for aeleos. `agree + onlyB + conflict` = 619 = the total for libra.

## Conflicts

55 rules, each set to a different value by the two repositories. Values are
exactly as `diffRules` reported them (raw `rules` entries from
`eslint --print-config`, before any normalisation for display).

- `@next/next/no-html-link-for-pages`
  - aeleos: [2]
  - libra: [0]
- `@typescript-eslint/no-unused-expressions`
  - aeleos: [2,{"allowShortCircuit":false,"allowTaggedTemplates":false,"allowTernary":false}]
  - libra: [1,{"allowShortCircuit":false,"allowTaggedTemplates":false,"allowTernary":false}]
- `@typescript-eslint/no-unused-vars`
  - aeleos: [2]
  - libra: [2,{"argsIgnorePattern":"^_","varsIgnorePattern":"^_","caughtErrorsIgnorePattern":"^_","destructuredArrayIgnorePattern":"^_"}]
- `better-tailwindcss/enforce-canonical-classes`
  - aeleos: [1]
  - libra: [2,{"entryPoint":"apps/store/src/app/globals.css","collapse":true,"logical":true}]
- `better-tailwindcss/enforce-consistent-class-order`
  - aeleos: [1]
  - libra: [0]
- `better-tailwindcss/no-conflicting-classes`
  - aeleos: [2]
  - libra: [2,{"entryPoint":"apps/store/src/app/globals.css"}]
- `better-tailwindcss/no-deprecated-classes`
  - aeleos: [1]
  - libra: [2,{"entryPoint":"apps/store/src/app/globals.css"}]
- `better-tailwindcss/no-duplicate-classes`
  - aeleos: [1]
  - libra: [2,{"entryPoint":"apps/store/src/app/globals.css"}]
- `better-tailwindcss/no-unknown-classes`
  - aeleos: [2]
  - libra: [0]
- `better-tailwindcss/no-unnecessary-whitespace`
  - aeleos: [1]
  - libra: [1,{"entryPoint":"apps/store/src/app/globals.css","allowMultiline":true}]
- `boundaries/dependencies`
  - aeleos: [2,{"default":"disallow","message":"{{ from.type }} must not import {{ to.type }}. See docs/superpowers/specs/2026-08-12-hub-layering-and-contract-seam-design.md.","rules":[{"from":{"type":"app"},"allow":{"to":{"type":["app","feature-barrel","shared","identity"]}}},{"from":{"type":"proxy"},"allow":{"to":{"type":["feature-barrel","shared"]}}},{"from":{"type":"feature-barrel"},"allow":{"to":[{"type":"feature","captured":{"feature":"{{ from.captured.feature }}"}},{"type":["shared","identity"]}]}},{"from":{"type":"feature","captured":{"layer":"domain"}},"allow":{"to":[{"type":"feature","captured":{"feature":"{{ from.captured.feature }}","layer":"domain"}},{"type":"shared","captured":{"layer":"domain"}},{"type":"identity"}]}},{"from":{"type":"feature","captured":[{"layer":"application"},{"layer":"infrastructure"}]},"allow":{"to":[{"type":"feature","captured":[{"feature":"{{ from.captured.feature }}","layer":"domain"},{"feature":"{{ from.captured.feature }}","layer":"application"},{"feature":"{{ from.captured.feature }}","layer":"infrastructure"}]},{"type":"shared","captured":[{"layer":"domain"},{"layer":"application"},{"layer":"infrastructure"}]},{"type":"identity"}]}},{"from":{"type":"feature","captured":{"layer":"presentation"}},"allow":{"to":[{"type":"feature","captured":{"feature":"{{ from.captured.feature }}"}},{"type":["shared","identity"]}]}},{"from":{"type":"shared","captured":{"layer":"domain"}},"allow":{"to":[{"type":"shared","captured":{"layer":"domain"}},{"type":"identity"}]}},{"from":{"type":"shared","captured":[{"layer":"application"},{"layer":"infrastructure"}]},"allow":{"to":[{"type":"shared","captured":[{"layer":"domain"},{"layer":"application"},{"layer":"infrastructure"}]},{"type":"identity"}]}},{"from":{"type":"shared","captured":{"layer":"presentation"}},"allow":{"to":{"type":["shared","identity"]}}},{"from":{"type":"identity"},"allow":{"to":{"type":"identity"}}}]}]
  - libra: [2,{"default":"disallow","rules":[{"from":{"type":"shared"},"allow":{"to":{"type":["shared"]}}},{"from":{"type":"shared-layouts"},"allow":{"to":{"type":["shared","feature"]}}},{"from":{"type":"feature"},"allow":{"to":{"type":["shared","feature","mocks"]}}},{"from":{"type":"app"},"allow":{"to":{"type":["shared","shared-layouts","feature"]}}},{"from":{"type":"test"},"allow":{"to":{"type":["shared","feature","app","test"]}}},{"from":{"type":"mocks"},"allow":{"to":{"type":["shared","feature","app","test","mocks"]}}},{"from":{"type":"root"},"allow":{"to":{"type":["shared","feature","app","mocks"]}}}]}]
- `i18next/no-literal-string`
  - aeleos: [2,{"mode":"jsx-text-only","should-validate-template":true,"jsx-attributes":{"include":["alt","aria-label","aria-placeholder","title"]},"words":{"exclude":["AeleOS","Furry Colombia","@"]}}]
  - libra: [2,{"mode":"all","should-validate-template":true,"jsx-attributes":{"include":["alt","aria-description","aria-label","aria-labelledby","aria-valuetext","label","placeholder","title"]},"ignoreAttribute":["className","class","id","name","type","href","src","srcSet","data-testid","data-state","data-collapsed","data-side","data-align","role","htmlFor","target","rel","method","action","encType","autoComplete","inputMode","pattern","accept","xmlns","viewBox","fill","stroke","strokeWidth","strokeLinecap","strokeLinejoin","d","cx","cy","r","x","y","x1","x2","y1","y2","width","height","transform","clipPath","clipRule","fillRule","variant","size","align","side","orientation","direction","position","layout","mode","theme","color","severity","status","priority","asChild","sideOffset","alignOffset","collisionPadding","locale","prefetch","scroll","shallow","replace","passHref","legacyBehavior","defaultValue","defaultChecked","dataKey","tickFormatter","domain","ticks","tickLine","axisLine","strokeDasharray","animationDuration","animationEasing","connectNulls","dot","activeDot","legendType","stackId","initial","animate","exit","transition","whileHover","whileTap","whileFocus","whileInView","tid"],"words":{"exclude":[{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{},{}]},"callees":{"exclude":[{},{},"useTranslations","getTranslations","tid","console.log","console.warn","console.error","console.info","console.debug",{},"Error","TypeError","RangeError","throw","require","import","document.getElementById","document.querySelector","document.querySelectorAll","localStorage.getItem","localStorage.setItem","sessionStorage.getItem","sessionStorage.setItem","JSON.parse","JSON.stringify","Object.keys","Object.values","Object.entries","Array.from","Set","Map","URLSearchParams","encodeURIComponent","decodeURIComponent","replaceAll","replace","split","join","match","matchAll","startsWith","endsWith","includes","padStart","padEnd","matchMedia","globalThis.matchMedia","window.matchMedia","router.push","router.replace","router.prefetch","useRouter","usePathname","useSearchParams","redirect","getStaticProps","getServerSideProps","generateStaticParams","generateMetadata","cookies","headers","useRecommendationSelection","useState","useQuery","useMutation","queryClient.invalidateQueries","queryClient.setQueryData","cn","clsx","cva","twMerge","toLocaleString","toLocaleDateString","toLocaleTimeString","Intl.DateTimeFormat","Intl.NumberFormat","Intl.RelativeTimeFormat","describe","it","test","expect","vi.mock","vi.fn","vi.spyOn","beforeEach","afterEach","beforeAll","afterAll"]}}]
- `no-restricted-imports`
  - aeleos: [2,{"patterns":[{"group":["../*"],"message":"Reach sideways with an absolute @/ import. A ../ chain breaks the moment a file moves."}]}]
  - libra: [2,{"patterns":[{"group":["@ui/*"],"message":"Import from 'ui' package instead of internal @ui/ alias. Example: import { Button } from 'ui'"},{"group":["@shared/*"],"message":"Import from 'shared' package instead of internal @shared/ alias. Example: import { useTheme } from 'shared'"}]}]
- `no-restricted-properties`
  - aeleos: [2,{"object":"document","property":"querySelector","message":"Avoid document.querySelector — use a React ref."},{"object":"document","property":"querySelectorAll","message":"Avoid document.querySelectorAll — use a React ref."}]
  - libra: [2,{"object":"document","property":"querySelector","message":"Avoid document.querySelector — use React refs or Radix UI primitives."},{"object":"document","property":"querySelectorAll","message":"Avoid document.querySelectorAll — use React refs or Radix UI primitives."}]
- `no-unexpected-multiline`
  - aeleos: [0]
  - libra: [2]
- `react-hooks/exhaustive-deps`
  - aeleos: [1]
  - libra: [2]
- `react-hooks/refs`
  - aeleos: [2]
  - libra: [0]
- `react-hooks/set-state-in-effect`
  - aeleos: [2]
  - libra: [0]
- `sonarjs/cognitive-complexity`
  - aeleos: [2,20]
  - libra: [2,15]
- `sonarjs/confidential-information-logging`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/cyclomatic-complexity`
  - aeleos: [0,{"threshold":10}]
  - libra: [2,{"threshold":15}]
- `sonarjs/deprecation`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/expression-complexity`
  - aeleos: [0,{"max":3}]
  - libra: [2,{"max":4}]
- `sonarjs/fixme-tag`
  - aeleos: [2]
  - libra: [1]
- `sonarjs/frame-ancestors`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/hidden-files`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/max-lines`
  - aeleos: [0,{"maximum":1000}]
  - libra: [2,{"maximum":400}]
- `sonarjs/max-lines-per-function`
  - aeleos: [0,{"maximum":200}]
  - libra: [2,{"maximum":100}]
- `sonarjs/nested-control-flow`
  - aeleos: [0,{"maximumNestingLevel":3}]
  - libra: [2,{"maximumNestingLevel":4}]
- `sonarjs/no-collapsible-if`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/no-commented-code`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/no-duplicate-string`
  - aeleos: [0,{"threshold":3,"ignoreStrings":"application/json"}]
  - libra: [2,{"threshold":2,"ignoreStrings":"var\\(--[a-zA-Z0-9-]+\\)|text-[a-z-]+|bg-[a-z-]+|common\\.[a-zA-Z]+"}]
- `sonarjs/no-intrusive-permissions`
  - aeleos: [0,{"permissions":["geolocation"]}]
  - libra: [2,{"permissions":["geolocation"]}]
- `sonarjs/no-ip-forward`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/no-mixed-content`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/no-nested-functions`
  - aeleos: [0,{"threshold":4}]
  - libra: [2,{"threshold":4}]
- `sonarjs/no-nested-switch`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/os-command`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/prefer-immediate-return`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/prefer-read-only-props`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/strings-comparison`
  - aeleos: [0]
  - libra: [2]
- `sonarjs/todo-tag`
  - aeleos: [2]
  - libra: [1]
- `unicorn/consistent-function-scoping`
  - aeleos: [2,{"checkArrowFunctions":true}]
  - libra: [0,{"checkArrowFunctions":true}]
- `unicorn/filename-case`
  - aeleos: [2]
  - libra: [0]
- `unicorn/no-array-reduce`
  - aeleos: [2,{"allowSimpleOperations":true}]
  - libra: [0,{"allowSimpleOperations":true}]
- `unicorn/no-array-sort`
  - aeleos: [2,{"allowExpressionStatement":true}]
  - libra: [0,{"allowExpressionStatement":true}]
- `unicorn/no-await-expression-member`
  - aeleos: [2]
  - libra: [0]
- `unicorn/number-literal-case`
  - aeleos: [2,{"hexadecimalValue":"lowercase"}]
  - libra: [2,{"hexadecimalValue":"uppercase"}]
- `unicorn/numeric-separators-style`
  - aeleos: [2,{"onlyIfContainsSeparator":false,"binary":{"minimumDigits":0,"groupLength":4},"octal":{"minimumDigits":0,"groupLength":4},"hexadecimal":{"minimumDigits":0,"groupLength":2,"onlyIfContainsSeparator":true},"number":{"minimumDigits":5,"groupLength":3}}]
  - libra: [2,{"onlyIfContainsSeparator":false,"binary":{"minimumDigits":0,"groupLength":4},"octal":{"minimumDigits":0,"groupLength":4},"hexadecimal":{"minimumDigits":0,"groupLength":2},"number":{"minimumDigits":5,"groupLength":3}}]
- `unicorn/prefer-math-trunc`
  - aeleos: [0]
  - libra: [2]
- `unicorn/prefer-module`
  - aeleos: [2]
  - libra: [0]
- `unicorn/prefer-query-selector`
  - aeleos: [2]
  - libra: [0]
- `unicorn/prefer-single-call`
  - aeleos: [2,{"ignore":[]}]
  - libra: [0,{"ignore":[]}]
- `unicorn/prefer-string-raw`
  - aeleos: [0]
  - libra: [2]
- `unicorn/prefer-top-level-await`
  - aeleos: [2]
  - libra: [0]

## onlyA — set only in aeleos

391 rules.

- `@babel/object-curly-spacing`
- `@babel/semi`
- `@next/next/no-location-assign-relative-destination`
- `@stylistic/array-bracket-newline`
- `@stylistic/array-bracket-spacing`
- `@stylistic/array-element-newline`
- `@stylistic/arrow-parens`
- `@stylistic/arrow-spacing`
- `@stylistic/block-spacing`
- `@stylistic/brace-style`
- `@stylistic/comma-dangle`
- `@stylistic/comma-spacing`
- `@stylistic/comma-style`
- `@stylistic/computed-property-spacing`
- `@stylistic/dot-location`
- `@stylistic/eol-last`
- `@stylistic/func-call-spacing`
- `@stylistic/function-call-argument-newline`
- `@stylistic/function-call-spacing`
- `@stylistic/function-paren-newline`
- `@stylistic/generator-star-spacing`
- `@stylistic/implicit-arrow-linebreak`
- `@stylistic/indent`
- `@stylistic/indent-binary-ops`
- `@stylistic/js/array-bracket-newline`
- `@stylistic/js/array-bracket-spacing`
- `@stylistic/js/array-element-newline`
- `@stylistic/js/arrow-parens`
- `@stylistic/js/arrow-spacing`
- `@stylistic/js/block-spacing`
- `@stylistic/js/brace-style`
- `@stylistic/js/comma-dangle`
- `@stylistic/js/comma-spacing`
- `@stylistic/js/comma-style`
- `@stylistic/js/computed-property-spacing`
- `@stylistic/js/dot-location`
- `@stylistic/js/eol-last`
- `@stylistic/js/func-call-spacing`
- `@stylistic/js/function-call-argument-newline`
- `@stylistic/js/function-call-spacing`
- `@stylistic/js/function-paren-newline`
- `@stylistic/js/generator-star-spacing`
- `@stylistic/js/implicit-arrow-linebreak`
- `@stylistic/js/indent`
- `@stylistic/js/jsx-quotes`
- `@stylistic/js/key-spacing`
- `@stylistic/js/keyword-spacing`
- `@stylistic/js/linebreak-style`
- `@stylistic/js/lines-around-comment`
- `@stylistic/js/max-len`
- `@stylistic/js/max-statements-per-line`
- `@stylistic/js/multiline-ternary`
- `@stylistic/js/new-parens`
- `@stylistic/js/newline-per-chained-call`
- `@stylistic/js/no-confusing-arrow`
- `@stylistic/js/no-extra-parens`
- `@stylistic/js/no-extra-semi`
- `@stylistic/js/no-floating-decimal`
- `@stylistic/js/no-mixed-operators`
- `@stylistic/js/no-mixed-spaces-and-tabs`
- `@stylistic/js/no-multi-spaces`
- `@stylistic/js/no-multiple-empty-lines`
- `@stylistic/js/no-tabs`
- `@stylistic/js/no-trailing-spaces`
- `@stylistic/js/no-whitespace-before-property`
- `@stylistic/js/nonblock-statement-body-position`
- `@stylistic/js/object-curly-newline`
- `@stylistic/js/object-curly-spacing`
- `@stylistic/js/object-property-newline`
- `@stylistic/js/one-var-declaration-per-line`
- `@stylistic/js/operator-linebreak`
- `@stylistic/js/padded-blocks`
- `@stylistic/js/quote-props`
- `@stylistic/js/quotes`
- `@stylistic/js/rest-spread-spacing`
- `@stylistic/js/semi`
- `@stylistic/js/semi-spacing`
- `@stylistic/js/semi-style`
- `@stylistic/js/space-before-blocks`
- `@stylistic/js/space-before-function-paren`
- `@stylistic/js/space-in-parens`
- `@stylistic/js/space-infix-ops`
- `@stylistic/js/space-unary-ops`
- `@stylistic/js/switch-colon-spacing`
- `@stylistic/js/template-curly-spacing`
- `@stylistic/js/template-tag-spacing`
- `@stylistic/js/wrap-iife`
- `@stylistic/js/wrap-regex`
- `@stylistic/js/yield-star-spacing`
- `@stylistic/jsx-child-element-spacing`
- `@stylistic/jsx-closing-bracket-location`
- `@stylistic/jsx-closing-tag-location`
- `@stylistic/jsx-curly-newline`
- `@stylistic/jsx-curly-spacing`
- `@stylistic/jsx-equals-spacing`
- `@stylistic/jsx-first-prop-new-line`
- `@stylistic/jsx-indent`
- `@stylistic/jsx-indent-props`
- `@stylistic/jsx-max-props-per-line`
- `@stylistic/jsx-newline`
- `@stylistic/jsx-one-expression-per-line`
- `@stylistic/jsx-props-no-multi-spaces`
- `@stylistic/jsx-quotes`
- `@stylistic/jsx-tag-spacing`
- `@stylistic/jsx-wrap-multilines`
- `@stylistic/jsx/jsx-child-element-spacing`
- `@stylistic/jsx/jsx-closing-bracket-location`
- `@stylistic/jsx/jsx-closing-tag-location`
- `@stylistic/jsx/jsx-curly-newline`
- `@stylistic/jsx/jsx-curly-spacing`
- `@stylistic/jsx/jsx-equals-spacing`
- `@stylistic/jsx/jsx-first-prop-new-line`
- `@stylistic/jsx/jsx-indent`
- `@stylistic/jsx/jsx-indent-props`
- `@stylistic/jsx/jsx-max-props-per-line`
- `@stylistic/key-spacing`
- `@stylistic/keyword-spacing`
- `@stylistic/linebreak-style`
- `@stylistic/lines-around-comment`
- `@stylistic/max-len`
- `@stylistic/max-statements-per-line`
- `@stylistic/member-delimiter-style`
- `@stylistic/multiline-ternary`
- `@stylistic/new-parens`
- `@stylistic/newline-per-chained-call`
- `@stylistic/no-confusing-arrow`
- `@stylistic/no-extra-parens`
- `@stylistic/no-extra-semi`
- `@stylistic/no-floating-decimal`
- `@stylistic/no-mixed-operators`
- `@stylistic/no-mixed-spaces-and-tabs`
- `@stylistic/no-multi-spaces`
- `@stylistic/no-multiple-empty-lines`
- `@stylistic/no-tabs`
- `@stylistic/no-trailing-spaces`
- `@stylistic/no-whitespace-before-property`
- `@stylistic/nonblock-statement-body-position`
- `@stylistic/object-curly-newline`
- `@stylistic/object-curly-spacing`
- `@stylistic/object-property-newline`
- `@stylistic/one-var-declaration-per-line`
- `@stylistic/operator-linebreak`
- `@stylistic/padded-blocks`
- `@stylistic/quote-props`
- `@stylistic/quotes`
- `@stylistic/rest-spread-spacing`
- `@stylistic/semi`
- `@stylistic/semi-spacing`
- `@stylistic/semi-style`
- `@stylistic/space-before-blocks`
- `@stylistic/space-before-function-paren`
- `@stylistic/space-in-parens`
- `@stylistic/space-infix-ops`
- `@stylistic/space-unary-ops`
- `@stylistic/switch-colon-spacing`
- `@stylistic/template-curly-spacing`
- `@stylistic/template-tag-spacing`
- `@stylistic/ts/block-spacing`
- `@stylistic/ts/brace-style`
- `@stylistic/ts/comma-dangle`
- `@stylistic/ts/comma-spacing`
- `@stylistic/ts/func-call-spacing`
- `@stylistic/ts/function-call-spacing`
- `@stylistic/ts/indent`
- `@stylistic/ts/key-spacing`
- `@stylistic/ts/keyword-spacing`
- `@stylistic/ts/lines-around-comment`
- `@stylistic/ts/member-delimiter-style`
- `@stylistic/ts/no-extra-parens`
- `@stylistic/ts/no-extra-semi`
- `@stylistic/ts/object-curly-spacing`
- `@stylistic/ts/quotes`
- `@stylistic/ts/semi`
- `@stylistic/ts/space-before-blocks`
- `@stylistic/ts/space-before-function-paren`
- `@stylistic/ts/space-infix-ops`
- `@stylistic/ts/type-annotation-spacing`
- `@stylistic/type-annotation-spacing`
- `@stylistic/type-generic-spacing`
- `@stylistic/type-named-tuple-spacing`
- `@stylistic/wrap-iife`
- `@stylistic/wrap-regex`
- `@stylistic/yield-star-spacing`
- `@typescript-eslint/block-spacing`
- `@typescript-eslint/brace-style`
- `@typescript-eslint/comma-dangle`
- `@typescript-eslint/comma-spacing`
- `@typescript-eslint/func-call-spacing`
- `@typescript-eslint/indent`
- `@typescript-eslint/key-spacing`
- `@typescript-eslint/keyword-spacing`
- `@typescript-eslint/lines-around-comment`
- `@typescript-eslint/member-delimiter-style`
- `@typescript-eslint/no-deprecated`
- `@typescript-eslint/no-extra-parens`
- `@typescript-eslint/no-extra-semi`
- `@typescript-eslint/object-curly-spacing`
- `@typescript-eslint/quotes`
- `@typescript-eslint/semi`
- `@typescript-eslint/space-before-blocks`
- `@typescript-eslint/space-before-function-paren`
- `@typescript-eslint/space-infix-ops`
- `@typescript-eslint/type-annotation-spacing`
- `array-bracket-newline`
- `array-bracket-spacing`
- `array-element-newline`
- `arrow-parens`
- `arrow-spacing`
- `babel/object-curly-spacing`
- `babel/quotes`
- `babel/semi`
- `better-tailwindcss/no-concatenated-classes`
- `block-spacing`
- `brace-style`
- `comma-dangle`
- `comma-spacing`
- `comma-style`
- `computed-property-spacing`
- `curly`
- `dot-location`
- `eol-last`
- `flowtype/boolean-style`
- `flowtype/delimiter-dangle`
- `flowtype/generic-spacing`
- `flowtype/object-type-curly-spacing`
- `flowtype/object-type-delimiter`
- `flowtype/quotes`
- `flowtype/semi`
- `flowtype/space-after-type-colon`
- `flowtype/space-before-generic-bracket`
- `flowtype/space-before-type-colon`
- `flowtype/union-intersection-spacing`
- `func-call-spacing`
- `function-call-argument-newline`
- `function-paren-newline`
- `generator-star`
- `generator-star-spacing`
- `implicit-arrow-linebreak`
- `indent`
- `indent-legacy`
- `jsdoc/check-param-names`
- `jsdoc/no-types`
- `jsdoc/require-description`
- `jsdoc/require-jsdoc`
- `jsdoc/require-param`
- `jsdoc/require-param-description`
- `jsdoc/require-param-type`
- `jsdoc/require-returns-description`
- `jsdoc/require-returns-type`
- `jsx-a11y/anchor-is-valid`
- `jsx-a11y/no-autofocus`
- `jsx-quotes`
- `key-spacing`
- `keyword-spacing`
- `linebreak-style`
- `lines-around-comment`
- `max-len`
- `max-statements-per-line`
- `multiline-ternary`
- `new-parens`
- `newline-per-chained-call`
- `no-arrow-condition`
- `no-comma-dangle`
- `no-confusing-arrow`
- `no-extra-parens`
- `no-extra-semi`
- `no-floating-decimal`
- `no-mixed-operators`
- `no-mixed-spaces-and-tabs`
- `no-multi-spaces`
- `no-multiple-empty-lines`
- `no-reserved-keys`
- `no-space-before-semi`
- `no-spaced-func`
- `no-tabs`
- `no-trailing-spaces`
- `no-whitespace-before-property`
- `no-wrap-func`
- `nonblock-statement-body-position`
- `object-curly-newline`
- `object-curly-spacing`
- `object-property-newline`
- `one-var-declaration-per-line`
- `operator-linebreak`
- `padded-blocks`
- `quote-props`
- `quotes`
- `react/jsx-child-element-spacing`
- `react/jsx-closing-bracket-location`
- `react/jsx-closing-tag-location`
- `react/jsx-curly-newline`
- `react/jsx-curly-spacing`
- `react/jsx-equals-spacing`
- `react/jsx-first-prop-new-line`
- `react/jsx-indent`
- `react/jsx-indent-props`
- `react/jsx-max-props-per-line`
- `react/jsx-newline`
- `react/jsx-one-expression-per-line`
- `react/jsx-props-no-multi-spaces`
- `react/jsx-space-before-closing`
- `react/jsx-tag-spacing`
- `react/jsx-wrap-multilines`
- `rest-spread-spacing`
- `security/detect-eval-with-expression`
- `security/detect-unsafe-regex`
- `semi`
- `semi-spacing`
- `semi-style`
- `sonarjs/assertions-in-test-cases`
- `sonarjs/async-test-assertions`
- `sonarjs/explicit-test-skip`
- `sonarjs/hooks-before-test-cases`
- `sonarjs/memoize-cache-key`
- `sonarjs/no-debug-commands-in-ui-tests`
- `sonarjs/no-default-utility-imports`
- `sonarjs/no-duplicate-test-title`
- `sonarjs/no-empty-test-title`
- `sonarjs/no-fixed-wait-in-tests`
- `sonarjs/no-floating-point-equality`
- `sonarjs/no-forced-browser-interaction`
- `sonarjs/no-incompatible-assertion-types`
- `sonarjs/no-interpolation-in-inline-snapshots`
- `sonarjs/no-mixed-completion-style`
- `sonarjs/no-trivial-assertions`
- `sonarjs/parameterized-tests`
- `sonarjs/prefer-native-lodash-alternative`
- `sonarjs/prefer-specific-assertions`
- `sonarjs/super-linear-regex`
- `sonarjs/synchronous-suite-callback`
- `space-after-function-name`
- `space-after-keywords`
- `space-before-blocks`
- `space-before-function-paren`
- `space-before-function-parentheses`
- `space-before-keywords`
- `space-in-brackets`
- `space-in-parens`
- `space-infix-ops`
- `space-return-throw-case`
- `space-unary-ops`
- `space-unary-word-ops`
- `standard/array-bracket-even-spacing`
- `standard/computed-property-even-spacing`
- `standard/object-curly-even-spacing`
- `switch-colon-spacing`
- `template-curly-spacing`
- `template-tag-spacing`
- `tsdoc/syntax`
- `vue/array-bracket-newline`
- `vue/array-bracket-spacing`
- `vue/array-element-newline`
- `vue/arrow-spacing`
- `vue/block-spacing`
- `vue/block-tag-newline`
- `vue/brace-style`
- `vue/comma-dangle`
- `vue/comma-spacing`
- `vue/comma-style`
- `vue/dot-location`
- `vue/func-call-spacing`
- `vue/html-closing-bracket-newline`
- `vue/html-closing-bracket-spacing`
- `vue/html-end-tags`
- `vue/html-indent`
- `vue/html-quotes`
- `vue/html-self-closing`
- `vue/key-spacing`
- `vue/keyword-spacing`
- `vue/max-attributes-per-line`
- `vue/max-len`
- `vue/multiline-html-element-content-newline`
- `vue/multiline-ternary`
- `vue/mustache-interpolation-spacing`
- `vue/no-extra-parens`
- `vue/no-multi-spaces`
- `vue/no-spaces-around-equal-signs-in-attribute`
- `vue/object-curly-newline`
- `vue/object-curly-spacing`
- `vue/object-property-newline`
- `vue/operator-linebreak`
- `vue/quote-props`
- `vue/script-indent`
- `vue/singleline-html-element-content-newline`
- `vue/space-in-parens`
- `vue/space-infix-ops`
- `vue/space-unary-ops`
- `vue/template-curly-spacing`
- `wrap-iife`
- `wrap-regex`
- `yield-star-spacing`

## onlyB — set only in libra

34 rules.

- `@tanstack/query/exhaustive-deps`
- `@tanstack/query/infinite-query-property-order`
- `@tanstack/query/mutation-property-order`
- `@tanstack/query/no-rest-destructuring`
- `@tanstack/query/no-unstable-deps`
- `@tanstack/query/no-void-query-fn`
- `@tanstack/query/stable-query-client`
- `@typescript-eslint/consistent-type-imports`
- `@typescript-eslint/naming-convention`
- `@typescript-eslint/no-magic-numbers`
- `@typescript-eslint/no-non-null-assertion`
- `import/no-duplicates`
- `import/order`
- `no-restricted-syntax`
- `no-unassigned-vars`
- `no-useless-assignment`
- `preserve-caught-error`
- `react/jsx-no-constructed-context-values`
- `react/no-danger`
- `react/no-multi-comp`
- `react/no-unstable-nested-components`
- `security/detect-object-injection`
- `sonarjs/aws-s3-bucket-server-encryption`
- `sonarjs/certificate-transparency`
- `sonarjs/cookies`
- `sonarjs/dns-prefetching`
- `sonarjs/encryption`
- `sonarjs/no-vue-bypass-sanitization`
- `sonarjs/process-argv`
- `sonarjs/regular-expr`
- `sonarjs/sockets`
- `sonarjs/standard-input`
- `sonarjs/xpath`
- `unused-imports/no-unused-vars`

## Where the raw data lives

The full JSON (`diffRules` output, unmodified) is at
`.superpowers/sdd/2026-09-07-phase-2a-diff-eslint/eslint-diff.json`, which is
git-ignored — this document is the committed artifact.
