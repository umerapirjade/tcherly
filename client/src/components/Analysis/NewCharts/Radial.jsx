import React, { useState, useEffect } from "react";
import useFeedback from "provider/feedback";
import { Form } from "react-bootstrap";
import { DEBE_COLORS } from "./Venn";

// Donut segments run clockwise from 12 o'clock; labels sit beside the quadrant they usually fall in
const SEGMENTS = [
  { key: "engaging", label: "Engaging", side: "right", y: 58 },
  { key: "easy", label: "Easy", side: "right", y: 146 },
  { key: "difficult", label: "Difficult", side: "left", y: 146 },
  { key: "boring", label: "Boring", side: "left", y: 58 },
];

const CX = 200;
const CY = 100;
const RING_R = 60; // middle of the ring
const RING_W = 24;
const OUTER_R = RING_R + RING_W / 2;
const CIRC = 2 * Math.PI * RING_R;
const GAP = 1.5; // white gap between segments, in px along the ring

// Label columns: left labels start at the panel edge, right labels after the ring; a horizontal
// leader runs from each label to the ring's outer edge at the label's height
const LABEL_X = { left: 18, right: 300 };
const LEADER_START_X = { left: 108, right: 290 };
const ringEdgeX = (side, y) => {
  const dy = Math.min(OUTER_R - 1, Math.abs(y - CY));
  const dx = Math.sqrt(OUTER_R * OUTER_R - dy * dy) + 5;
  return side === "left" ? CX - dx : CX + dx;
};

/** Donut of DEBE reactions with labelled callouts ("7 (19%)") and the total in the middle. */
function DebeDonut({ values, total, centerLabel, isActive, percentOf, unit }) {
  const sum = SEGMENTS.reduce((s, seg) => s + values[seg.key], 0);
  let start = 0;
  const arcs = SEGMENTS.map((seg) => {
    const value = values[seg.key];
    const frac = sum > 0 ? value / sum : 0;
    const arc = { ...seg, value, frac, start, pct: percentOf > 0 ? Math.round((value * 100) / percentOf) : 0 };
    start += frac;
    return arc;
  });

  return (
    <svg viewBox="0 0 400 200" width="100%" height="100%" role="img" aria-label={`DEBE distribution: ${arcs.map((a) => `${a.label} ${a.value} (${a.pct}%)`).join(", ")}`}>
      <circle cx={CX} cy={CY} r={RING_R} fill="none" stroke="#ece9f5" strokeWidth={RING_W} />
      <g transform={`rotate(-90 ${CX} ${CY})`}>
        {arcs
          .filter((a) => a.frac > 0)
          .map((a) => {
            const len = Math.max(0.5, a.frac * CIRC - (a.frac < 1 ? GAP : 0));
            return (
              <circle
                key={a.key}
                className="debe-donut-seg"
                cx={CX}
                cy={CY}
                r={RING_R}
                fill="none"
                stroke={DEBE_COLORS[a.key]}
                strokeWidth={RING_W}
                strokeDasharray={`${len} ${CIRC - len}`}
                strokeDashoffset={-a.start * CIRC}
                opacity={isActive[a.key] ? 1 : 0.25}
              >
                <title>{`${a.label}: ${a.value} ${unit} (${a.pct}%)`}</title>
              </circle>
            );
          })}
      </g>

      <text x={CX} y={CY - 4} textAnchor="middle" className="debe-donut-total">{total}</text>
      <text x={CX} y={CY + 16} textAnchor="middle" className="debe-donut-sub">{centerLabel}</text>

      {arcs.map((a) => {
        const x = LABEL_X[a.side];
        const ly = a.y - 8;
        const edge = ringEdgeX(a.side, ly);
        return (
          <g key={a.key} opacity={isActive[a.key] ? 1 : 0.35}>
            <line x1={LEADER_START_X[a.side]} y1={ly} x2={edge} y2={ly} stroke={DEBE_COLORS[a.key]} strokeWidth={1.25} />
            <circle cx={edge} cy={ly} r={2.5} fill={DEBE_COLORS[a.key]} />
            <circle cx={x} cy={a.y - 8} r={5} fill={DEBE_COLORS[a.key]} />
            <text x={x + 10} y={a.y - 4} className="debe-donut-name">{a.label}</text>
            <text x={x + 10} y={a.y + 12} className="debe-donut-value">{`${a.value} (${a.pct}%)`}</text>
          </g>
        );
      })}
    </svg>
  );
}

function Radial() {
  const { data, lesson, activated } = useFeedback();
  const [validResponses, setValidResponses] = useState(0);
  const [clicks, setClicks] = useState(true);

  useEffect(() => {
    const participation_all = data.participation_all;
    if (participation_all && lesson.watched) {
      const validResponsesSet = new Set();
      participation_all.easy.forEach(validResponsesSet.add, validResponsesSet);
      participation_all.difficult.forEach(validResponsesSet.add, validResponsesSet);
      participation_all.engaging.forEach(validResponsesSet.add, validResponsesSet);
      participation_all.boring.forEach(validResponsesSet.add, validResponsesSet);
      setValidResponses(validResponsesSet.size);
    }
  }, [data.participation_all, lesson.watched]);

  if (!data || !data.unique) return null;

  const active = activated.reduce((pv, cv) => ({ ...pv, [cv]: true }), {});
  const isActive = {
    difficult: active.net_difficult || active.difficult,
    easy: active.net_difficult || active.easy,
    boring: active.net_engaging || active.boring,
    engaging: active.net_engaging || active.engaging,
  };
  const pickCounts = (src) => ({ difficult: src.difficult || 0, easy: src.easy || 0, boring: src.boring || 0, engaging: src.engaging || 0 });
  const clickValues = pickCounts(data.radial || {});
  const totalClicks = Object.values(clickValues).reduce((s, v) => s + v, 0);

  return (
    <div className="td-radial-heatmap">
      <div className="nd-radial-slider" key="radial-x">
        <div className="toggle-percentage">
          <div className="mr-2" onClick={() => setClicks(false)} style={{ cursor: "pointer" }}>
            Students
          </div>
          <Form.Check checked={clicks} onChange={() => setClicks((s) => !s)} type="switch" id="custom-switch-2" />
          <div onClick={() => setClicks(true)} style={{ cursor: "pointer" }}>
            Clicks
          </div>
        </div>
      </div>
      <div className="child-caption">DEBE Distribution</div>
      {clicks ? (
        <DebeDonut values={clickValues} total={totalClicks} percentOf={totalClicks} centerLabel="Total interactions" unit="clicks" isActive={isActive} />
      ) : (
        // A student can give several reactions, so the shares of students add up to more than 100%
        <DebeDonut values={pickCounts(data.unique)} total={validResponses} percentOf={validResponses} centerLabel="Students responded" unit="students" isActive={isActive} />
      )}
    </div>
  );
}

export default Radial;
