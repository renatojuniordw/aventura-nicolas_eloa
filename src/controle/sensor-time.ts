/**
 * The moment a devicemotion sample was measured, not the moment our handler
 * happened to run. When the browser delivers samples in a batch, handler time
 * squeezes them together and distorts the freefall duration checks
 * (minFreefallMs / maxFreefallMs). Falls back to handler time whenever the
 * event stamp can't be trusted: missing, in the future, or from another clock.
 */
export function resolveEventTime(eventTimeStamp: number, handlerNowMs: number): number {
  if (!Number.isFinite(eventTimeStamp) || eventTimeStamp <= 0) return handlerNowMs;
  if (eventTimeStamp > handlerNowMs + 5) return handlerNowMs;
  if (handlerNowMs - eventTimeStamp > 1000) return handlerNowMs;
  return eventTimeStamp;
}
