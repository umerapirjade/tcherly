import React, { useState } from "react";
import useFeedback from "provider/feedback";
import "assets/styles/venn.scss";
import Loader from "components/Loader";
import { Form } from "react-bootstrap";

export const DEBE_COLORS = {
  difficult: "#ff7785",
  easy: "#ffbc55",
  boring: "#9F8CFF",
  engaging: "#69b9a6",
};

const LABELS = { difficult: "Difficult", easy: "Easy", boring: "Boring", engaging: "Engaging" };

// Two equal circles: "only left", "both", "only right" (students, within the selected range)
const R = 34;
const CY = 50;
const LEFT_X = 78;
const RIGHT_X = 122;
const HALF_CHORD = Math.sqrt(R * R - ((RIGHT_X - LEFT_X) / 2) ** 2);
const MID_X = (LEFT_X + RIGHT_X) / 2;
const LENS = `M${MID_X},${CY - HALF_CHORD} A${R},${R} 0 0 1 ${MID_X},${CY + HALF_CHORD} A${R},${R} 0 0 1 ${MID_X},${CY - HALF_CHORD}Z`;

const students = (n) => `${n} student${n === 1 ? "" : "s"}`;

/** A two-set Venn diagram: each circle shows the students who gave only that reaction, the overlap those who gave both. */
export function PairVenn({ left, right, both, caption }) {
  const onlyLeft = Math.max(0, left.total - both);
  const onlyRight = Math.max(0, right.total - both);
  const bothActive = left.active && right.active;
  return (
    <div className="venn-container">
      <svg viewBox="0 0 200 100" role="img" aria-label={`${caption}: ${onlyLeft} only ${left.label}, ${both} both, ${onlyRight} only ${right.label}`}>
        <circle className="debe-venn-region" cx={LEFT_X} cy={CY} r={R} fill={left.color} fillOpacity={0.7} opacity={left.active ? 1 : 0.2}>
          <title>{`Only ${left.label}: ${students(onlyLeft)} (${left.total} gave ${left.label} in total)`}</title>
        </circle>
        <circle className="debe-venn-region" cx={RIGHT_X} cy={CY} r={R} fill={right.color} fillOpacity={0.7} opacity={right.active ? 1 : 0.2}>
          <title>{`Only ${right.label}: ${students(onlyRight)} (${right.total} gave ${right.label} in total)`}</title>
        </circle>
        <path className="debe-venn-region" d={LENS} fill="transparent" opacity={bothActive ? 1 : 0.2}>
          <title>{`Both ${left.label} and ${right.label}: ${students(both)}`}</title>
        </path>
        <g className="debe-venn-num" textAnchor="middle" dominantBaseline="central">
          <text x={LEFT_X - R / 2} y={CY} opacity={left.active ? 1 : 0.3}>{onlyLeft}</text>
          <text x={MID_X} y={CY} opacity={bothActive ? 1 : 0.3}>{both}</text>
          <text x={RIGHT_X + R / 2} y={CY} opacity={right.active ? 1 : 0.3}>{onlyRight}</text>
        </g>
      </svg>
      <div className="venn-caption">{caption}</div>
    </div>
  );
}

export default function Venn() {
  const { data, refreshing, activated } = useFeedback();
  const [view2, setView2] = useState(false);

  if (!data) return null;
  if (!data.venn) return <div className="d-flex justify-content-center align-items-center w-100">No data...</div>;
  if (refreshing) return <Loader asDiv />;

  const active = activated.reduce((pv, cv) => ({ ...pv, [cv]: true }), {});
  const isActive = {
    difficult: active.net_difficult || active.difficult,
    easy: active.net_difficult || active.easy,
    boring: active.net_engaging || active.boring,
    engaging: active.net_engaging || active.engaging,
  };
  const set = (key) => ({ label: LABELS[key], color: DEBE_COLORS[key], total: data.venn[key] || 0, active: !!isActive[key] });
  const pair = (a, b, bothKey) => <PairVenn left={set(a)} right={set(b)} both={data.venn[bothKey] || 0} caption={`${LABELS[a]} - ${LABELS[b]}`} />;

  return (
    <>
      <div className="child-caption">DEBE Interactions</div>
      <div className="toggle-percentage">
        <div className="mr-2" onClick={() => setView2(false)} style={{ cursor: "pointer" }}>
          View 1
        </div>
        <Form.Check checked={view2} onChange={() => setView2((s) => !s)} type="switch" id="custom-switch" />
        <div onClick={() => setView2(true)} style={{ cursor: "pointer" }}>
          View 2
        </div>
      </div>
      <div className="td-venn-left">{view2 ? pair("difficult", "engaging", "difficult_engaging") : pair("difficult", "easy", "difficult_easy")}</div>
      <div className="td-venn-right">{view2 ? pair("easy", "boring", "boring_easy") : pair("boring", "engaging", "boring_engaging")}</div>
    </>
  );
}
