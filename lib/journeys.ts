// Delay-aware journey ranking, kept separate from the API route so it can be tested on its own.

export type Candidate = { stops: string[]; routeCodes: string[]; segmentMinutes: number };

export type RankedJourney = Candidate & {
  transfers: number;
  legs: string[];               // routes boarded, in order (R-B, R-D)
  scheduledMinutes: number;     // segment minutes + transfer allowance
  delayMinutes: number;         // current reported delay on the routes boarded
  estimatedMinutes: number;     // scheduled + delay: what the ranking uses
  delayedLegs: { routeCode: string; minutes: number }[];
  label: string;
};

export const TRANSFER_MINUTES = 5;      // allowance for changing buses
export const LIVE_DELAY_WINDOW_HOURS = 3; // reports newer than this count as "current"

// The routes a passenger boards: consecutive segments on the same route are one leg.
export function legsOf(routeCodes: string[]): string[] {
  return routeCodes.filter((c, i) => i === 0 || c !== routeCodes[i - 1]);
}

// liveDelay maps route code -> current average reported delay in minutes (missing = 0).
export function rankJourneys(candidates: Candidate[], liveDelay: Record<string, number>, limit = 3): RankedJourney[] {
  const seen = new Set<string>();
  const ranked: RankedJourney[] = [];
  for (const c of candidates) {
    const key = c.stops.join("|") + "#" + c.routeCodes.join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    const legs = legsOf(c.routeCodes);
    const transfers = legs.length - 1;
    const delayedLegs = legs.filter(l => (liveDelay[l] ?? 0) > 0).map(l => ({ routeCode: l, minutes: Math.round(liveDelay[l]) }));
    const delayMinutes = delayedLegs.reduce((s, d) => s + d.minutes, 0);
    const scheduledMinutes = c.segmentMinutes + transfers * TRANSFER_MINUTES;
    ranked.push({ ...c, transfers, legs, scheduledMinutes, delayMinutes, delayedLegs,
      estimatedMinutes: scheduledMinutes + delayMinutes,
      label: `${transfers} transfer${transfers === 1 ? "" : "s"}` });
  }
  ranked.sort((a, b) => a.estimatedMinutes - b.estimatedMinutes || a.transfers - b.transfers || a.stops.length - b.stops.length);
  return ranked.slice(0, limit);
}
