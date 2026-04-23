import React, { useRef, useState, useMemo } from 'react';
import { View, StyleSheet, PanResponder, Dimensions } from 'react-native';
import Svg, { Path, Circle, Defs, LinearGradient as SvgGrad, Stop, G, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '@/src/theme/colors';

import { KnotEngine, Knot, KnotSegment } from './RopeSeekbar/KnotEngine';
import {
  ropeTexture,
  KnotBundle,
  KnotLoop,
  LooseRope,
  GhostKnot,
  ConvergenceStrands,
} from './RopeSeekbar/KnotRenderer';

export { Knot };

// ─── CONSTANTS ───────────────────────────────────────────
const { width } = Dimensions.get('window');
const SLIDER_W = width - 42; // Match KnotEngine
const MIN_DROP = 25;
const MAX_DROP = 195;
const ROPE_Y = 28; // Match KnotEngine
const CONTAINER_H = 145;
const THICK = 12; // Slightly thicker per previous preference
const KNOB_R = 7;
const SHRINK_INTENSITY = 0.3; // Reduced from 0.8 to keep rope longer

// ─── PROPS ───────────────────────────────────────────────
interface Props {
  duration: number;
  position: number;
  knots: Knot[];
  pendingA: number | null;
  pendingB: number | null;
  onSeek?: (t: number) => void;
  onKnotToggle?: (i: number) => void;
  onKnotMerge?: (idx1: number, idx2: number) => void;
  onKnotDoubleTap?: (i: number) => void;
  onKnotDelete?: (i: number) => void;
}

// ─── DROP CALCULATOR ─────────────────────────────────────
function drop(k: Knot, totalDur: number, active: boolean) {
  if (!active) return 0;
  const dur = Math.max(k.endTime, k.startTime) - Math.min(k.endTime, k.startTime);
  const ratio = Math.min(dur / (totalDur * 0.77 || 1), 1.0);
  return MIN_DROP + (MAX_DROP - MIN_DROP) * ratio;
}

// ═════════════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════════════
export function RopeSeekbar({
  duration,
  position,
  knots,
  pendingA,
  pendingB,
  onSeek,
  onKnotToggle,
  onKnotMerge,
  onKnotDoubleTap,
  onKnotDelete,
}: Props) {
  const [localPos, setLocalPos] = useState<number | null>(null);
  const [draggingKnot, setDraggingKnot] = useState<{ idx: number; x: number } | null>(null);
  const [isMerging, setIsMerging] = useState(false);

  const displayPos = localPos !== null ? localPos : position;

  // Sort knots by start time, attach original index
  const sorted: (Knot & { s: number; e: number; idx: number })[] = useMemo(() => {
    return knots.map((k: Knot, i: number) => ({
      ...k,
      idx: i,
      s: Math.min(k.startTime, k.endTime),
      e: Math.max(k.startTime, k.endTime),
    }))
      .sort((a, b) => a.s - b.s);
  }, [knots]);

  // ─── SEGMENT BUILDER ────────────────────────────────────
  const MIN_ROPE_SEG_W = 32; // Minimum pixels between knots
  const segs: KnotSegment[] = [];
  let curT = 0;

  // Calculate merged active duration to avoid over-counting overlaps
  let activeMerged: { s: number, e: number }[] = [];
  for (const k of sorted) {
    if (!k.active) continue;
    if (activeMerged.length > 0 && k.s < activeMerged[activeMerged.length - 1].e) {
      activeMerged[activeMerged.length - 1].e = Math.max(activeMerged[activeMerged.length - 1].e, k.e);
    } else {
      activeMerged.push({ s: k.s, e: k.e });
    }
  }
  const activeKnotDuration = activeMerged.reduce((sum, m) => sum + (m.e - m.s), 0);

  // 1. Calculate how many segments we have and their raw durations
  let rawSegs: { t1: number; t2: number; isLoose?: boolean }[] = [];
  curT = 0;
  for (const k of sorted) {
    if (k.s > curT) {
      rawSegs.push({ t1: curT, t2: k.s });
      curT = k.s;
    }
    if (k.e > curT) {
      if (k.active) {
        curT = k.e;
      } else {
        rawSegs.push({ t1: curT, t2: k.e, isLoose: true });
        curT = k.e;
      }
    }
  }
  if (curT < duration) {
    rawSegs.push({ t1: curT, t2: duration });
  }

  // 2. Determine available width for scaling
  const baseVisualWidth = SLIDER_W * (1 - (duration > 0 ? (activeKnotDuration / duration) * SHRINK_INTENSITY : 0));

  // 3. Ensure minimum width for each segment
  // We allow the very first segment (t=0) to have 0 min-width so knots can sit at the start
  const totalMinW = rawSegs.reduce((sum, rs) => sum + (rs.t1 === 0 ? 0 : MIN_ROPE_SEG_W), 0);
  const flexibleWidth = Math.max(0, baseVisualWidth - totalMinW);
  const totalRopeDuration = rawSegs.reduce((sum, s) => sum + (s.t2 - s.t1), 0);

  const centeringOffset = (SLIDER_W - baseVisualWidth) / 2;
  let visualX = centeringOffset;

  for (const rs of rawSegs) {
    const dur = rs.t2 - rs.t1;
    const minW = rs.t1 === 0 ? 0 : MIN_ROPE_SEG_W;
    // Width = min_width + (proportional share of flexible width)
    const w = minW + (totalRopeDuration > 0 ? (dur / totalRopeDuration) * flexibleWidth : 0);
    segs.push({ x1: visualX, y1: ROPE_Y, x2: visualX + w, y2: ROPE_Y, t1: rs.t1, t2: rs.t2, isLoose: rs.isLoose });
    visualX += w;
  }

  const px = KnotEngine.timeToVisualX(displayPos, segs, duration);
  const knobInKnot = sorted.some(k => k.active && displayPos > k.s + 0.1 && displayPos < k.e - 0.1);
  const svgH = ROPE_Y + MAX_DROP + 40;

  // ─── REFS FOR GESTURE HANDLER ────────────────────────────
  const draggingKnotRef = useRef(draggingKnot);
  draggingKnotRef.current = draggingKnot;

  const latest = useRef({ segs, sorted, duration, onKnotToggle, onSeek, onKnotMerge, onKnotDoubleTap, onKnotDelete, centeringOffset });
  latest.current = { segs, sorted, duration, onKnotToggle, onSeek, onKnotMerge, onKnotDoubleTap, onKnotDelete, centeringOffset };

  const gestureType = useRef<'seek' | 'knot_drag' | 'unknot' | 're_knot' | null>(null);
  const lastTapRef = useRef<{ time: number, idx: number | null }>({ time: 0, idx: null });
  const longPressTimer = useRef<NodeJS.Timeout | null>(null);

  // ─── PAN RESPONDER ───────────────────────────────────────
  const pan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gs) => Math.abs(gs.dx) > 3 || Math.abs(gs.dy) > 3,

      onPanResponderGrant: (e) => {
        const { pageX, locationY } = e.nativeEvent;
        const { sorted, segs, duration, centeringOffset } = latest.current;
        const x = KnotEngine.getRelativeX(pageX);

        const hit = KnotEngine.hitTest(x, locationY, sorted, segs, duration, centeringOffset, drop);

        if (hit && (hit.type === 'loop' || hit.type === 'active_knot')) {
          longPressTimer.current = setTimeout(() => {
            if (latest.current.onKnotDelete) {
              latest.current.onKnotDelete(hit.idx!);
              gestureType.current = null;
            }
          }, 600);
        }

        if (hit?.type === 'loop') {
          // Tap on the hanging loop → unknot immediately on release
          gestureType.current = 'unknot';
        } else if (hit?.type === 'active_knot') {
          // Tap on the knot bundle → start potential merge drag
          gestureType.current = 'knot_drag';
          setDraggingKnot({ idx: hit.idx!, x: hit.x! });
        } else if (hit?.type === 'loose_rope') {
          // Touch on sagging loose rope → Single tap to seek, Double tap to re-knot
          gestureType.current = 're_knot';
          const p = KnotEngine.visualXToTime(x, segs, duration);
          setLocalPos(p);
        } else {
          // Bare rope → seek
          gestureType.current = 'seek';
          const p = KnotEngine.visualXToTime(x, segs, duration);
          setLocalPos(p);
        }
      },

      onPanResponderMove: (_, gs) => {
        if (Math.abs(gs.dx) > 10 || Math.abs(gs.dy) > 10) {
          if (longPressTimer.current) {
            clearTimeout(longPressTimer.current);
            longPressTimer.current = null;
          }
        }
        const { segs, duration } = latest.current;
        const x = KnotEngine.getRelativeX(gs.moveX);

        if (gestureType.current === 'knot_drag') {
          setDraggingKnot(prev => prev ? { ...prev, x } : null);

          // Real-time magnetism check for visual feedback
          let merging = false;
          for (const k of latest.current.sorted) {
            if (!k.active || k.idx === draggingKnotRef.current?.idx) continue;
            const tieX = KnotEngine.timeToVisualX(k.s, latest.current.segs, latest.current.duration);
            if (Math.abs(x - tieX) < 45) {
              merging = true;
              break;
            }
          }
          setIsMerging(merging);
        } else if (gestureType.current === 'seek') {
          const p = KnotEngine.visualXToTime(x, segs, duration);
          setLocalPos(p);
        }
        // unknot and re_knot don't track movement
      },

      onPanResponderRelease: (e, gs) => {
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        const { pageX, locationY } = e.nativeEvent;
        const { sorted, onKnotToggle, onSeek, onKnotMerge, segs, duration, centeringOffset } = latest.current;
        const x = KnotEngine.getRelativeX(Math.abs(gs.dx) > 2 ? gs.moveX : pageX);
        const currentDragging = draggingKnotRef.current;

        if ((gestureType.current === 'unknot' || gestureType.current === 'knot_drag') && Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
          const hit = KnotEngine.hitTest(x, locationY, sorted, segs, duration, centeringOffset, drop);
          if (hit && (hit.type === 'loop' || hit.type === 'active_knot')) {
            const now = Date.now();
            const lastTap = lastTapRef.current;
            const isDoubleTap = (now - lastTap.time < 500) && (lastTap.idx === hit.idx);

            if (isDoubleTap) {
              lastTapRef.current = { time: 0, idx: null };
              if (onKnotDoubleTap) onKnotDoubleTap(hit.idx!);
            } else {
              lastTapRef.current = { time: now, idx: hit.idx! };
              if (gestureType.current === 'unknot') {
                if (onKnotToggle) onKnotToggle(hit.idx!);
              } else {
                const knot = sorted.find(k => k.idx === hit.idx);
                if (knot && onSeek) onSeek(knot.s);
              }
            }
          }
        } else if (gestureType.current === 'knot_drag' && currentDragging) {
          // Find nearest other knot within a magnetism radius
          let nearestKnotIdx: number | null = null;
          let minKnotDist = 45; // Magnetism threshold in pixels

          for (const k of sorted) {
            if (!k.active || k.idx === currentDragging.idx) continue;
            const tieX = KnotEngine.timeToVisualX(k.s, segs, duration);
            const dist = Math.abs(x - tieX);
            if (dist < minKnotDist) {
              minKnotDist = dist;
              nearestKnotIdx = k.idx;
            }
          }

          if (nearestKnotIdx !== null) {
            if (onKnotMerge) onKnotMerge(currentDragging.idx, nearestKnotIdx);
          }
        } else if (gestureType.current === 're_knot' && Math.abs(gs.dx) < 5 && Math.abs(gs.dy) < 5) {
          const hit = KnotEngine.hitTest(x, locationY, sorted, segs, duration, centeringOffset, drop);
          if (hit?.type === 'loose_rope') {
            const now = Date.now();
            const lastTap = lastTapRef.current;
            const isDoubleTap = (now - lastTap.time < 500) && (lastTap.idx === hit.idx);

            if (isDoubleTap) {
              lastTapRef.current = { time: 0, idx: null };
              if (onKnotToggle) onKnotToggle(hit.idx!);
            } else {
              lastTapRef.current = { time: now, idx: hit.idx! };
              // Single tap on loose rope -> Seek
              const p = KnotEngine.visualXToTime(x, segs, duration);
              if (onSeek) onSeek(p);
            }
          }
        } else if (gestureType.current === 'seek') {
          const p = KnotEngine.visualXToTime(x, segs, duration);
          if (onSeek) onSeek(p);
        }

        setIsMerging(false);
        setLocalPos(null);
        setDraggingKnot(null);
        gestureType.current = null;
      },
    })
  ).current;

  // ═════════════════════════════════════════════════════════
  // RENDER
  // ═════════════════════════════════════════════════════════
  return (
    <View style={s.box}>
      <View {...pan.panHandlers} style={[s.svg, { height: svgH, width: width }]}>
        <Svg width={width} height={svgH} pointerEvents="none">
          <Defs>
            <SvgGrad id="rBase" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FF9800" />
              <Stop offset="0.3" stopColor="#F57C00" />
              <Stop offset="1" stopColor="#E65100" />
            </SvgGrad>
            <SvgGrad id="rHi" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFCC80" stopOpacity="0.7" />
              <Stop offset="1" stopColor="#FF9800" stopOpacity="0" />
            </SvgGrad>
            <SvgGrad id="rPlay" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FFD54F" />
              <Stop offset="0.5" stopColor="#FFA000" />
              <Stop offset="1" stopColor="#FF6F00" />
            </SvgGrad>
            <SvgGrad id="kLoop" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#FB8C00" />
              <Stop offset="0.5" stopColor="#EF6C00" />
              <Stop offset="1" stopColor="#BF360C" />
            </SvgGrad>
            <SvgGrad id="silver" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor="#F0F0F0" />
              <Stop offset="0.4" stopColor="#B0B0B0" />
              <Stop offset="0.6" stopColor="#A0A0A0" />
              <Stop offset="1" stopColor="#D0D0D0" />
            </SvgGrad>
          </Defs>

          <G transform={`translate(${(width - SLIDER_W) / 2}, 0)`}>
            {/* === SHADOW === */}
            {segs.map((sg, i) => !sg.isLoose && (
              <Path key={`sh${i}`} d={`M ${sg.x1} ${ROPE_Y + 4} L ${sg.x2} ${ROPE_Y + 4}`}
                fill="none" stroke="rgba(0,0,0,0.2)" strokeWidth={THICK + 2} strokeLinecap="round" />
            ))}

            {/* === BASE ROPE === */}
            {segs.map((sg, i) => !sg.isLoose && (
              <Path key={`b${i}`} d={`M ${sg.x1} ${ROPE_Y} L ${sg.x2} ${ROPE_Y}`}
                fill="none" stroke="url(#rBase)" strokeWidth={THICK} strokeLinecap="round" />
            ))}

            {/* === HIGHLIGHT === */}
            {segs.map((sg, i) => !sg.isLoose && (
              <Path key={`hi${i}`} d={`M ${sg.x1} ${ROPE_Y} L ${sg.x2} ${ROPE_Y}`}
                fill="none" stroke="url(#rHi)" strokeWidth={THICK} strokeLinecap="round" />
            ))}

            {/* === PLAYED PROGRESS === */}
            {segs.map((sg, i) => {
              if (sg.isLoose || px <= sg.x1) return null;
              const end = Math.min(px, sg.x2);
              return (
                <Path key={`pl${i}`} d={`M ${sg.x1} ${ROPE_Y} L ${end} ${ROPE_Y}`}
                  fill="none" stroke="url(#rPlay)" strokeWidth={THICK} strokeLinecap="round" />
              );
            })}

            {/* === TWISTED TEXTURE === */}
            {segs.map((sg, i) => !sg.isLoose && ropeTexture(sg.x1, sg.x2, ROPE_Y, `rt${i}`))}

            {/* === ACTIVE KNOT LOOPS (using KnotRenderer) === */}
            {sorted.map((k, i) => {
              if (!k.active) return null;
              const segIdx = segs.findIndex(seg => Math.abs(seg.t2 - k.s) < 0.01);
              if (segIdx === -1) return null;

              const tieX = segs[segIdx].x2;
              const tieY = ROPE_Y + 6;
              const d = drop(k, duration, true);

              const leftX = segs[segIdx].x2 - 12;
              const rightX = segs[segIdx + 1]?.x1 ?? segs[segIdx].x2 + 12;

              // Knot size proportional to duration
              const knotSize = Math.min(Math.max((k.e - k.s) / (duration * 0.05 || 1), 0.7), 1.4);

              return (
                <React.Fragment key={`kn${i}`}>
                  {/* Convergence strands (rope → knot) */}
                  <ConvergenceStrands
                    leftX={leftX} rightX={rightX}
                    tieX={tieX} tieY={tieY} ropeY={ROPE_Y}
                  />
                  {/* The teardrop loop hanging below */}
                  <KnotLoop tieX={tieX} tieY={tieY} depth={d} />
                  {/* The intertwined knot bundle on the rope */}
                  <KnotBundle tieX={tieX} tieY={ROPE_Y} size={knotSize} />
                </React.Fragment>
              );
            })}

            {/* === POINT A / B MARKERS === */}
            {pendingA !== null && (
              <G transform={`translate(${KnotEngine.timeToVisualX(pendingA, segs, duration)}, ${ROPE_Y})`}>
                <Rect x={-22} y={-14} width={44} height={28} rx={6} fill="url(#silver)" />
                <SvgText x="0" y="3" fontSize="8" fontWeight="bold" fill="#333" textAnchor="middle">POINT A</SvgText>
              </G>
            )}
            {pendingB !== null && (
              <G transform={`translate(${KnotEngine.timeToVisualX(pendingB, segs, duration)}, ${ROPE_Y})`}>
                <Rect x={-22} y={-14} width={44} height={28} rx={6} fill="url(#silver)" />
                <SvgText x="0" y="3" fontSize="8" fontWeight="bold" fill="#333" textAnchor="middle">POINT B</SvgText>
              </G>
            )}

            {/* === LOOSE ROPE (Inactive/Unknotted Memory) === */}
            {segs.map((sg, i) => sg.isLoose && (
              <LooseRope key={`ls${i}`} x1={sg.x1} x2={sg.x2} ropeY={ROPE_Y} isPlayed={displayPos >= sg.t2} prefix={`lr-${i}`} />
            ))}

            {/* === GHOST KNOT (Merge Drag Visual) === */}
            {draggingKnot && <GhostKnot x={draggingKnot.x} y={ROPE_Y} isMerging={isMerging} />}

            {/* === KNOB (Playhead) === */}
            {!knobInKnot && (
              <G transform={`translate(${px}, ${ROPE_Y})`}>
                <Circle r={KNOB_R + 6} fill={colors.primary} opacity={0.15} />
                <Circle r={KNOB_R + 3} fill="rgba(0,0,0,0.15)" />
                <Circle r={KNOB_R} fill="#FFF" />
                <Circle r={KNOB_R - 3} fill={colors.primary} />
                <Path d={`M ${-KNOB_R / 2} ${-KNOB_R / 2} Q 0 ${-KNOB_R} ${KNOB_R / 2} ${-KNOB_R / 2}`}
                  fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth={2} />
              </G>
            )}
          </G>
        </Svg>
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  box: { width: '100%', alignItems: 'center', height: CONTAINER_H, zIndex: 10 },
  svg: { position: 'absolute', top: 0 },
});
