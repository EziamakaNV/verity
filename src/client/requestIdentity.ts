export interface RequestIdentity { input: string; intent: string }
export function normalizeInputIdentity(raw: string): string { return (raw || '').trim().toUpperCase(); }
/** Publication guard: a response may publish only while it is still the latest
 * request and the user's current input identity (raw code, sample: alias or
 * parsed sample URL token, exactly as entered) and intent still match the
 * identity captured when that request started. The server-resolved unit token
 * is deliberately not part of this identity. */
export function isCurrentRequest(captured: RequestIdentity, current: RequestIdentity): boolean {
  return captured.intent === current.intent && normalizeInputIdentity(captured.input) === normalizeInputIdentity(current.input);
}
export function shouldPublish(capturedSeq: number, latestSeq: number, captured: RequestIdentity, current: RequestIdentity): boolean {
  return capturedSeq === latestSeq && isCurrentRequest(captured, current);
}
