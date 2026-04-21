import { Dimensions } from 'react-native';

export interface Knot {
  startTime: number;
  endTime: number;
  active: boolean;
  idx?: number;
  subKnots?: Knot[];
}

export interface KnotSegment {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  t1: number;
  t2: number;
  isLoose?: boolean;
}

const { width: SCREEN_W } = Dimensions.get('window');
const SLIDER_W = SCREEN_W - 42;
const ROPE_Y = 28;

export type HitZone = 'loop' | 'active_knot' | 'loose_rope' | 'rope';

export interface HitResult {
  type: HitZone;
  idx?: number;
  x?: number;
}

export const KnotEngine = {
  getRelativeX: (pageX: number) => {
    const margin = (SCREEN_W - SLIDER_W) / 2;
    return pageX - margin;
  },

  /**
   * Maps a visual X coordinate on the rope back to the song's timeline.
   */
  visualXToTime: (x: number, segs: KnotSegment[], _totalDuration: number) => {
    const clampedX = Math.max(0, Math.min(x, SLIDER_W));
    const seg = segs.find(s => clampedX >= s.x1 && clampedX <= s.x2);
    if (!seg) return 0;
    const ratio = (clampedX - seg.x1) / (seg.x2 - seg.x1 || 1);
    return seg.t1 + ratio * (seg.t2 - seg.t1);
  },

  /**
   * Maps a time (in seconds) to a visual X coordinate on the rope.
   */
  timeToVisualX: (time: number, segs: KnotSegment[], _totalDuration: number) => {
    // Exact match or within segment
    const seg = segs.find(s => time >= s.t1 && time <= s.t2);
    if (seg) {
      const ratio = (time - seg.t1) / (seg.t2 - seg.t1 || 1);
      return seg.x1 + ratio * (seg.x2 - seg.x1);
    }

    // If time is in a gap (active knot), find the segment that ends at or after this time
    // We sort segs by t1 just in case, though they usually are.
    const sortedSegs = [...segs].sort((a, b) => a.t1 - b.t1);
    
    // If time is before the first segment
    if (sortedSegs.length > 0 && time < sortedSegs[0].t1) {
      return sortedSegs[0].x1;
    }

    // Find the segment immediately following the gap
    const nextSeg = sortedSegs.find(s => s.t1 >= time);
    if (nextSeg) return nextSeg.x1; // This is the tieX where the knot is bunched

    // If time is after the last segment
    if (sortedSegs.length > 0) {
      return sortedSegs[sortedSegs.length - 1].x2;
    }

    return 0;
  },

  /**
   * 4-zone hit testing:
   * 1. LOOP — the hanging teardrop below an active knot (Y > ROPE_Y + 15)
   * 2. ACTIVE_KNOT — the knot bundle on the rope line (Y ≈ ROPE_Y ± 15)
   * 3. LOOSE_ROPE — the sagging parabola of an inactive knot
   * 4. null — bare rope / empty space
   */
  hitTest: (
    x: number,
    y: number,
    knots: Knot[],
    segs: KnotSegment[],
    duration: number,
    _centeringOffset: number,
    dropFunc: (k: Knot, d: number, active: boolean) => number
  ): HitResult | null => {

    // ── 1. Check LOOP zone (below rope, on the hanging teardrop) ──
    // This is checked FIRST so tapping a loop can never trigger seek
    if (y > ROPE_Y + 15) {
      for (const k of knots) {
        if (!k.active) continue;

        const sVal = Math.min(k.startTime, k.endTime);
        const tieX = KnotEngine._findTieX(sVal, segs);
        const d = dropFunc(k, duration, true);

        // The loop hangs from tieX, from ROPE_Y+6 down to ROPE_Y+6+d
        const loopBottom = ROPE_Y + 6 + d;
        const loopWidth = 22; // horizontal extent of the teardrop

        // Check if touch is within the teardrop region
        if (x > tieX - loopWidth && x < tieX + loopWidth && y > ROPE_Y + 10 && y < loopBottom + 10) {
          return { type: 'loop', idx: k.idx, x: tieX };
        }
      }
    }

    // ── 2. Check ACTIVE KNOT BUNDLE zone (on the rope line) ──
    for (const k of knots) {
      if (!k.active) continue;

      const sVal = Math.min(k.startTime, k.endTime);
      const tieX = KnotEngine._findTieX(sVal, segs);

      const dx = Math.abs(x - tieX);
      const dy = Math.abs(y - ROPE_Y);

      // Knot bundle is ~30px wide, ±20px vertically from rope
      if (dx < 30 && dy < 20) {
        return { type: 'active_knot', idx: k.idx, x: tieX };
      }
    }

    // ── 3. Check LOOSE ROPE zone (inactive knot memory) ──
    for (const k of knots) {
      if (k.active) continue;

      const s = Math.min(k.startTime, k.endTime);
      const e = Math.max(k.startTime, k.endTime);
      const x1 = KnotEngine.timeToVisualX(s, segs, duration);
      const x2 = KnotEngine.timeToVisualX(e, segs, duration);
      const midX = (x1 + x2) / 2;
      const span = x2 - x1;
      const sagDepth = Math.min(10 + span * 0.04, 18);

      // Point-to-parabola proximity check
      // The sag curve: y = ROPE_Y + sagDepth * sin(π * t) where t = (x - x1)/(x2 - x1)
      if (x > x1 - 15 && x < x2 + 15) {
        const t = Math.max(0, Math.min(1, (x - x1) / (x2 - x1 || 1)));
        const curveY = ROPE_Y + Math.sin(t * Math.PI) * sagDepth;
        const dist = Math.abs(y - curveY);

        if (dist < 20) {
          return { type: 'loose_rope', idx: k.idx };
        }
      }
    }

    return null;
  },

  /**
   * Find the tieX for a knot by finding the segment whose t2 is closest to sVal.
   * Uses closest-match instead of exact equality to avoid floating-point misses.
   */
  _findTieX: (sVal: number, segs: KnotSegment[]): number => {
    let bestSeg: KnotSegment | null = null;
    let bestDist = Infinity;

    for (const seg of segs) {
      const dist = Math.abs(seg.t2 - sVal);
      if (dist < bestDist) {
        bestDist = dist;
        bestSeg = seg;
      }
    }

    return bestSeg ? bestSeg.x2 : 0;
  },
};
