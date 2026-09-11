// Markers are the hand-written stand-ins a ruling's `chosen` carries where a real value cannot be
// written down at reconcile time: `{ $parameter }` (body data, resolved by the bundle writer and
// by observe), `{ $union }` (both donors' arrays merged, resolved in reconcile), `{ $fromSide }`
// (one donor's value, likewise). Every marker key is `$`-prefixed so a plugin's own option object
// can never be mistaken for one — `union`, `parameter` and `fromSide` are all names real ESLint
// rule options use.
//
// C2/I5: a marker attribute nobody implements used to be dropped in silence. `boundaries/
// dependencies` carried `{ $parameter: "boundaries.allow", base: "a" }`, meaning "aeleos's layered
// policy is the base"; `literal`, `resolveParameters` and `matches` all ignored `base`, so the
// generated class shipped a boundaries policy with NO base rules at all and every check agreed
// with it, because they agreed with each other. Every consumer of a marker now runs `assertMarker`
// first, so an attribute no one implements is a loud error at the first place it is read rather
// than a silently narrower policy.
export const MARKER_ATTRIBUTES = {
  // The body-config path this value is read from. No further attributes.
  $parameter: [],
  // The option key whose arrays both donors contribute to. `join` turns the union back into one
  // delimited string (sonarjs/no-duplicate-string's `ignoreStrings`).
  $union: ["join"],
  // The named donor's own value for the key this marker sits at. `withoutElementType` strips one
  // eslint-plugin-boundaries element type out of the borrowed policy — the donor's own element
  // (aeleos's `identity`) is body data, so it leaves the class base and returns as that body's
  // `boundaries.elements`/`boundaries.allow`.
  $fromSide: ["withoutElementType"],
};

const MARKER_KEYS = Object.keys(MARKER_ATTRIBUTES);

// Throws on any `$`-prefixed key that is not a known marker, on two markers in one object, and on
// any extra key beside a marker that the marker does not define. Returns the marker key, or null
// when `value` is an ordinary object (or not an object at all).
export function assertMarker(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const keys = Object.keys(value);
  const dollar = keys.filter((k) => k.startsWith("$"));
  if (dollar.length === 0) return null;
  if (dollar.length > 1) throw new Error(`marker object carries more than one marker key: ${dollar.join(", ")}`);
  const [marker] = dollar;
  if (!MARKER_KEYS.includes(marker)) throw new Error(`unknown marker "${marker}"; known markers are ${MARKER_KEYS.join(", ")}`);
  const extra = keys.filter((k) => k !== marker && !MARKER_ATTRIBUTES[marker].includes(k));
  if (extra.length > 0) {
    throw new Error(`marker ${marker} carries unknown attribute${extra.length > 1 ? "s" : ""} ${extra.map((k) => `"${k}"`).join(", ")}; ${marker} understands ${MARKER_ATTRIBUTES[marker].length ? MARKER_ATTRIBUTES[marker].join(", ") : "no other attribute"}`);
  }
  return marker;
}
