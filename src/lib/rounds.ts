import { periodStartDate } from './calc'

/**
 * A name for the next round: "… (round 2)" counts up, a year in the name
 * moves on one ("Station Partner 2026" → "Station Partner 2027"), and
 * anything else gets "(round 2)".
 */
export function nextRoundName(name: string): string {
  const round = name.match(/^(.*)\(round (\d+)\)\s*$/i)
  if (round) return `${round[1]}(round ${Number(round[2]) + 1})`
  const years = [...name.matchAll(/\b(20\d{2})\b/g)]
  if (years.length) {
    const last = years[years.length - 1]
    const at = last.index ?? 0
    return name.slice(0, at) + String(Number(last[1]) + 1) + name.slice(at + 4)
  }
  return `${name} (round 2)`.slice(0, 80)
}

/** The day after this round's last month ends: the first day of month term + 1, as YYYY-MM-DD. */
export function nextRoundStart(startIso: string, termMonths: number): string {
  const d = periodStartDate(startIso, termMonths + 1)
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
