/**
 * A Supabase query that fails returns `{ data: null, error }` rather than
 * throwing — left unchecked, `data ?? []` silently renders as an honest
 * empty state, indistinguishable from a real empty result (this is exactly
 * how the Phase 7 search bug hid: a jsonb ilike type error looked like "no
 * matches" until someone actually searched for something that should have
 * matched). Call this after every read query in a list/dashboard page so a
 * failure is at least visible in the server logs instead of silently
 * rendering as zero/empty.
 */
export function logQueryError(context: string, error: { message: string } | null) {
  if (error) {
    console.error(`[${context}] query failed:`, error);
  }
}
