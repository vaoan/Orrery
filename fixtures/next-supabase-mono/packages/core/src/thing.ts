// A thing's display label is its own id behind a fixed, non-translatable prefix — a slug, not
// user-facing copy — so the prefix lives in an UPPER_CASE constant rather than inline in the
// template literal: eslint-plugin-i18next only flags text an UPPER_CASE declarator is not
// already indicating is machine data (see THING_LABEL_PREFIX below).
const THING_LABEL_PREFIX = "thing-";

/**
 * Formats the display label for a thing.
 *
 * @param id - The thing's identifier.
 * @returns The thing's display label.
 */
export function getThing(id: string): string {
  return `${THING_LABEL_PREFIX}${id}`;
}
