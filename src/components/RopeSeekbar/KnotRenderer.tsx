import React from 'react';
import { Path, G, Circle, Ellipse } from 'react-native-svg';

const THICK = 12;
const LOOP_THICK = 9;
const STRAND_W = 7;

// ───────────────────────────────────────────────────────────
// ROPE TEXTURE — twisted strand marks along straight or curved paths
// ───────────────────────────────────────────────────────────
export function ropeTexture(
  x1: number, x2: number, y: number, prefix: string,
  isSagging = false, sagDepth = 0
): React.ReactElement[] {
  const els: React.ReactElement[] = [];
  const spacing = 5;
  const w = Math.max(x2 - x1, 1);
  const twist = 8;

  for (let x = 0; x < w; x += spacing) {
    const t = Math.max(0, Math.min(1, x / w));
    const cx = x1 + x;
    const cy = isSagging ? y + Math.sin(t * Math.PI) * sagDepth : y;

    els.push(
      <Path key={`${prefix}-s-${x}`}
        d={`M ${cx} ${cy - THICK / 2} L ${cx + twist} ${cy + THICK / 2}`}
        fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth={2.2} />,
      <Path key={`${prefix}-h-${x}`}
        d={`M ${cx + 1.5} ${cy - THICK / 2} L ${cx + twist + 1.5} ${cy + THICK / 2}`}
        fill="none" stroke="rgba(255,255,255,0.13)" strokeWidth={1} />
    );
  }
  return els;
}

// ───────────────────────────────────────────────────────────
// STRAND TEXTURE — twist marks along a curved path (for loops)
// ───────────────────────────────────────────────────────────
function strandTexture(
  points: { x: number; y: number }[],
  prefix: string,
  strandWidth: number
): React.ReactElement[] {
  const els: React.ReactElement[] = [];
  const step = 3; // every 3rd point gets a twist mark
  for (let i = 0; i < points.length - 1; i += step) {
    const p = points[i];
    const pNext = points[Math.min(i + step, points.length - 1)];
    // tangent direction
    const dx = pNext.x - p.x;
    const dy = pNext.y - p.y;
    const len = Math.sqrt(dx * dx + dy * dy) || 1;
    // normal (perpendicular)
    const nx = -dy / len;
    const ny = dx / len;
    const hw = strandWidth * 0.45;

    els.push(
      <Path key={`${prefix}-ts-${i}`}
        d={`M ${p.x - nx * hw} ${p.y - ny * hw} L ${p.x + nx * hw} ${p.y + ny * hw}`}
        fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={2} />,
      <Path key={`${prefix}-th-${i}`}
        d={`M ${p.x - nx * hw + 1} ${p.y - ny * hw + 1} L ${p.x + nx * hw + 1} ${p.y + ny * hw + 1}`}
        fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth={0.8} />
    );
  }
  return els;
}

// Sample points along a quadratic bezier Q(p0, cp, p1)
function sampleQuadBezier(
  p0: { x: number; y: number },
  cp: { x: number; y: number },
  p1: { x: number; y: number },
  steps: number
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    pts.push({
      x: mt * mt * p0.x + 2 * mt * t * cp.x + t * t * p1.x,
      y: mt * mt * p0.y + 2 * mt * t * cp.y + t * t * p1.y,
    });
  }
  return pts;
}

// ───────────────────────────────────────────────────────────
// KNOT BUNDLE — Realistic intertwined rope strands at the tie point
// ───────────────────────────────────────────────────────────
export function KnotBundle({ tieX, tieY, size = 1 }: {
  tieX: number; tieY: number; size?: number;
}) {
  const sc = 0.85; // Fixed, slightly smaller size for all knots regardless of loop duration

  return (
    <G transform={`translate(${tieX}, ${tieY})`}>
      {/* Deep shadow */}
      <Ellipse cx={0} cy={5 * sc} rx={18 * sc} ry={13 * sc} fill="rgba(0,0,0,0.25)" />

      {/* === BACK STRANDS (behind everything) === */}
      {/* Left entry → curves up-right behind */}
      <Path d={`M ${-20 * sc} 0 C ${-14 * sc} ${-12 * sc}, ${-3 * sc} ${-14 * sc}, ${4 * sc} ${-3 * sc}`}
        fill="none" stroke="#BF360C" strokeWidth={THICK * 0.85 * sc} strokeLinecap="round" />
      {/* Right entry → curves up-left behind */}
      <Path d={`M ${20 * sc} 0 C ${14 * sc} ${-12 * sc}, ${3 * sc} ${-14 * sc}, ${-4 * sc} ${-3 * sc}`}
        fill="none" stroke="#BF360C" strokeWidth={THICK * 0.85 * sc} strokeLinecap="round" />

      {/* === MIDDLE CROSS STRANDS (the weave) === */}
      {/* Diagonal cross left→right */}
      <Path d={`M ${-12 * sc} ${5 * sc} C ${-4 * sc} ${-6 * sc}, ${4 * sc} ${-6 * sc}, ${12 * sc} ${5 * sc}`}
        fill="none" stroke="url(#rBase)" strokeWidth={THICK * 0.75 * sc} strokeLinecap="round" />
      {/* Diagonal cross right→left */}
      <Path d={`M ${12 * sc} ${-5 * sc} C ${4 * sc} ${6 * sc}, ${-4 * sc} ${6 * sc}, ${-12 * sc} ${-5 * sc}`}
        fill="none" stroke="url(#rBase)" strokeWidth={THICK * 0.75 * sc} strokeLinecap="round" />

      {/* === FRONT STRANDS (on top of everything) === */}
      {/* Left entry front highlight */}
      <Path d={`M ${-20 * sc} 0 C ${-12 * sc} ${-10 * sc}, ${-6 * sc} ${-12 * sc}, ${0} ${-5 * sc}`}
        fill="none" stroke="url(#rBase)" strokeWidth={THICK * 0.8 * sc} strokeLinecap="round" />
      {/* Right entry front highlight */}
      <Path d={`M ${20 * sc} 0 C ${12 * sc} ${-10 * sc}, ${6 * sc} ${-12 * sc}, ${0} ${-5 * sc}`}
        fill="none" stroke="url(#rBase)" strokeWidth={THICK * 0.8 * sc} strokeLinecap="round" />

      {/* === HORIZONTAL WRAP (binding tie) === */}
      <Path d={`M ${-16 * sc} ${1 * sc} Q 0 ${7 * sc}, ${16 * sc} ${1 * sc}`}
        fill="none" stroke="#E65100" strokeWidth={THICK * 0.6 * sc} strokeLinecap="round" />
      {/* Wrap highlight */}
      <Path d={`M ${-16 * sc} ${-1 * sc} Q 0 ${-6 * sc}, ${16 * sc} ${-1 * sc}`}
        fill="none" stroke="#FFCC80" strokeWidth={2 * sc} strokeLinecap="round" strokeOpacity={0.4} />

      {/* === TOP HIGHLIGHTS (3D depth) === */}
      <Path d={`M ${-14 * sc} ${-4 * sc} C ${-6 * sc} ${-14 * sc}, ${6 * sc} ${-14 * sc}, ${14 * sc} ${-4 * sc}`}
        fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth={2.5 * sc} strokeLinecap="round" />

      {/* Center knot "eye" details */}
      <Circle cx={-3 * sc} cy={-2 * sc} r={2.5 * sc} fill="#804D00" opacity={0.5} />
      <Circle cx={3 * sc} cy={-2 * sc} r={2.5 * sc} fill="#804D00" opacity={0.5} />
    </G>
  );
}

// ───────────────────────────────────────────────────────────
// KNOT LOOP — Double-strand teardrop hanging below active knot
// ───────────────────────────────────────────────────────────
export function KnotLoop({ tieX, tieY, depth }: {
  tieX: number; tieY: number; depth: number;
}) {
  const gap = 4;        // horizontal separation at top
  const bw = 16;        // bottom width of the U curve
  const bottomY = tieY + depth;

  // Left strand: from knot center-left, down and curving to bottom-center
  const lStart = { x: tieX - gap, y: tieY + 8 };
  const lCtrl = { x: tieX - bw - 4, y: bottomY - 5 };
  const lEnd = { x: tieX, y: bottomY + 4 };

  // Right strand: mirror
  const rStart = { x: tieX + gap, y: tieY + 8 };
  const rCtrl = { x: tieX + bw + 4, y: bottomY - 5 };
  const rEnd = { x: tieX, y: bottomY + 4 };

  const leftPath = `M ${lStart.x} ${lStart.y} Q ${lCtrl.x} ${lCtrl.y} ${lEnd.x} ${lEnd.y}`;
  const rightPath = `M ${rStart.x} ${rStart.y} Q ${rCtrl.x} ${rCtrl.y} ${rEnd.x} ${rEnd.y}`;

  // Sample points for twist texture
  const leftPts = sampleQuadBezier(lStart, lCtrl, lEnd, 30);
  const rightPts = sampleQuadBezier(rStart, rCtrl, rEnd, 30);

  return (
    <G>
      {/* Shadow for both strands */}
      <Path d={`M ${lStart.x + 2} ${lStart.y + 3} Q ${lCtrl.x + 2} ${lCtrl.y + 3} ${lEnd.x + 2} ${lEnd.y + 3}`}
        fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={STRAND_W + 2} strokeLinecap="round" />
      <Path d={`M ${rStart.x + 2} ${rStart.y + 3} Q ${rCtrl.x + 2} ${rCtrl.y + 3} ${rEnd.x + 2} ${rEnd.y + 3}`}
        fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={STRAND_W + 2} strokeLinecap="round" />

      {/* Left strand */}
      <Path d={leftPath} fill="none" stroke="url(#kLoop)" strokeWidth={STRAND_W} strokeLinecap="round" />
      {/* Right strand */}
      <Path d={rightPath} fill="none" stroke="url(#kLoop)" strokeWidth={STRAND_W} strokeLinecap="round" />

      {/* Left strand highlight */}
      <Path d={leftPath} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5}
        strokeLinecap="round" strokeDasharray="3,4" />
      {/* Right strand highlight */}
      <Path d={rightPath} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5}
        strokeLinecap="round" strokeDasharray="3,4" />

      {/* Twist texture on strands */}
      {strandTexture(leftPts, 'lt', STRAND_W)}
      {strandTexture(rightPts, 'rt', STRAND_W)}

      {/* Bottom connection — small arc joining both strands */}
      <Path d={`M ${tieX - 3} ${bottomY + 3} A 4 3 0 0 0 ${tieX + 3} ${bottomY + 3}`}
        fill="none" stroke="url(#kLoop)" strokeWidth={STRAND_W - 1} strokeLinecap="round" />
    </G>
  );
}

// ───────────────────────────────────────────────────────────
// LOOSE ROPE — gentle gravity sag for unknotted (inactive) segments
// ───────────────────────────────────────────────────────────
export function LooseRope({ x1, x2, ropeY, prefix = 'lr' }: {
  x1: number; x2: number; ropeY: number; prefix?: string;
}) {
  const midX = (x1 + x2) / 2;
  const span = x2 - x1;
  // Gentle sag — proportional to span but capped. NOT a deep loop.
  const sagDepth = Math.min(10 + span * 0.04, 18);
  const sagY = ropeY + sagDepth;

  return (
    <G>
      {/* Shadow */}
      <Path d={`M ${x1} ${ropeY + 2} Q ${midX} ${sagY + 4} ${x2} ${ropeY + 2}`}
        fill="none" stroke="rgba(0,0,0,0.12)" strokeWidth={THICK} strokeLinecap="round" />

      {/* Main sag rope */}
      <Path d={`M ${x1} ${ropeY} Q ${midX} ${sagY} ${x2} ${ropeY}`}
        fill="none" stroke="url(#rBase)" strokeWidth={THICK - 2} strokeOpacity={0.45}
        strokeLinecap="round" />

      {/* Highlight on sag */}
      <Path d={`M ${x1} ${ropeY - 2} Q ${midX} ${sagY - 2} ${x2} ${ropeY - 2}`}
        fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={3} strokeLinecap="round" />

      {/* Subtle "memory" glow pulse hint */}
      <Path d={`M ${x1} ${ropeY} Q ${midX} ${sagY} ${x2} ${ropeY}`}
        fill="none" stroke="#FFCC80" strokeWidth={THICK + 4} strokeOpacity={0.06}
        strokeLinecap="round" />

      {/* Twist texture along the sag */}
      {ropeTexture(x1, x2, ropeY, prefix, true, sagDepth)}
    </G>
  );
}

// ───────────────────────────────────────────────────────────
// GHOST KNOT — semi-transparent knot during merge drag
// ───────────────────────────────────────────────────────────
export function GhostKnot({ x, y }: { x: number; y: number }) {
  return (
    <G transform={`translate(${x}, ${y})`} opacity={0.45}>
      {/* Glow ring */}
      <Circle r={24} fill="#FF9800" opacity={0.15} />
      {/* Simplified knot silhouette */}
      <Path d="M -14 0 C -8 -10, 8 -10, 14 0" fill="none" stroke="#FF9800" strokeWidth={6} strokeLinecap="round" />
      <Path d="M -10 3 C -3 -5, 3 -5, 10 3" fill="none" stroke="#FFCC80" strokeWidth={4} strokeLinecap="round" />
      <Path d="M -12 1 Q 0 8, 12 1" fill="none" stroke="#E65100" strokeWidth={5} strokeLinecap="round" />
      {/* Drop hint */}
      <Path d="M -6 6 Q 0 22 6 6" fill="none" stroke="#FF9800" strokeWidth={3} strokeLinecap="round" strokeDasharray="4,3" />
    </G>
  );
}

// ───────────────────────────────────────────────────────────
// CONVERGENCE STRANDS — rope converging into knot from main line
// ───────────────────────────────────────────────────────────
export function ConvergenceStrands({ leftX, rightX, tieX, tieY, ropeY }: {
  leftX: number; rightX: number; tieX: number; tieY: number; ropeY: number;
}) {
  const lConv = `M ${leftX} ${ropeY} Q ${leftX + 6} ${ropeY} ${tieX - 6} ${tieY}`;
  const rConv = `M ${rightX} ${ropeY} Q ${rightX - 6} ${ropeY} ${tieX + 6} ${tieY}`;

  return (
    <G>
      {/* Shadow */}
      <Path d={lConv} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth={THICK} strokeLinecap="round" />
      <Path d={rConv} fill="none" stroke="rgba(0,0,0,0.15)" strokeWidth={THICK} strokeLinecap="round" />
      {/* Main strands */}
      <Path d={lConv} fill="none" stroke="url(#rBase)" strokeWidth={THICK - 2} strokeLinecap="round" />
      <Path d={rConv} fill="none" stroke="url(#rBase)" strokeWidth={THICK - 2} strokeLinecap="round" />
    </G>
  );
}
