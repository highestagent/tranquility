/**
 * Splits what the agent said into a headline and the rest, so the layout holds
 * however much it writes. The next sentence must start with a capital, so that
 * something like "e.g. this" doesn't end the headline early.
 */
export function splitSpeech(text: string) {
  const trimmed = text.trim()
  const match = /^(.+?[.!?])\s+(?=[A-Z"“'‘])([\s\S]+)$/.exec(trimmed)
  return match
    ? { headline: match[1]!, rest: match[2]! }
    : { headline: trimmed, rest: null }
}
