export interface RequestIdentity { input: string; intent: string; location?: string; text?: string; session?: string }
export function normalizeInputIdentity(raw: string): string { return (raw || '').trim().toUpperCase(); }
export function normalizeDetailIdentity(raw: string | undefined): string { return (raw || '').trim(); }
/** Publication guard: a response may publish only while it is still the latest
 * request and the user's current input identity (raw code, sample: alias or
 * parsed sample URL token, exactly as entered), intent, location, seller's
 * explanation and demo-session epoch still match the identity captured when
 * that request started. The server-resolved unit token is deliberately not
 * part of this identity. Code is case/space-normalized; location and claim
 * text are trim-normalized (otherwise exact). */
export function isCurrentRequest(captured: RequestIdentity, current: RequestIdentity): boolean {
  return captured.intent === current.intent
    && normalizeInputIdentity(captured.input) === normalizeInputIdentity(current.input)
    && normalizeDetailIdentity(captured.location) === normalizeDetailIdentity(current.location)
    && normalizeDetailIdentity(captured.text) === normalizeDetailIdentity(current.text)
    && String(captured.session ?? '') === String(current.session ?? '');
}
export function shouldPublish(capturedSeq: number, latestSeq: number, captured: RequestIdentity, current: RequestIdentity): boolean {
  return capturedSeq === latestSeq && isCurrentRequest(captured, current);
}
