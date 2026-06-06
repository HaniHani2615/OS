/**
 * Feature flags tied to the active testbank.
 *
 * The site is currently running on Mrs.Q's bank (final.json → questions.json),
 * which has NO chapter data and NO matching per-question explanations. So both
 * features below are off to avoid empty pools / broken filters / "Ch unknown".
 *
 * To switch back to Mrs.H's bank:
 *   1. Restore data:  copy web/public/data/questions.mrs_h.json over questions.json
 *      (and restore the original stats.json), then bump DATA_VERSION in data.ts.
 *   2. Set BOTH flags below to `true`.
 */
export const SHOW_CHAPTERS = false;
export const SHOW_EXPLANATIONS = false;
