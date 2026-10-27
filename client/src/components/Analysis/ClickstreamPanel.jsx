import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ComposedChart, Bar, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceArea, ReferenceLine, ResponsiveContainer } from "recharts";
import { useAuth } from "provider/auth";
import useFeedback from "provider/feedback";
import { PanelHeader, Stat, PanelSkeleton, PanelState, fmtMin, pct, useSelection, useFocusRange, errorText } from "./panelKit";

// The dashboard's own purples: slider #9333ea, slider track #7c77a5, header #3b0764, borders #e9d5ff
const C = {
  back: "#9333ea",
  skip: "#b8b3cc",
  pause: "#3b0764",
  reachedFill: "#e9d5ff",
  reachedLine: "#c084fc",
  quiz: "#7c77a5",
  grid: "#e4e0f0",
  axis: "#6c757d",
  band: "#e9d5ff",
};

const MIN_STUDENTS_FOR_MOMENT = 3;

// One plain-language takeaway per kind of behaviour, strongest first
const KINDS = [
  { key: "back", verb: "went back to", icon: "fa-undo-alt", hint: "likely hard to follow" },
  { key: "skip", verb: "skipped ahead to", icon: "fa-forward", hint: "the part before may be slow or already familiar" },
  { key: "pause", verb: "paused at", icon: "fa-pause", hint: "not for a quiz; maybe to think or take notes" },
];

/** The strongest moment for each kind: adjacent minutes with at least 60% of that kind's peak, merged. */
function findMoments(rows, opened) {
  const moments = [];
  for (const kind of KINDS) {
    const values = rows.map((r) => r[kind.key]);
    const max = Math.max(0, ...values);
    if (max < MIN_STUDENTS_FOR_MOMENT) continue;
    const threshold = Math.max(MIN_STUDENTS_FOR_MOMENT, Math.ceil(max * 0.6));
    const peakAt = values.indexOf(max);
    let i = peakAt;
    let j = peakAt;
    while (i > 0 && values[i - 1] >= threshold) i--;
    while (j + 1 < rows.length && values[j + 1] >= threshold) j++;
    moments.push({ ...kind, from: rows[i].minute, to: rows[j].minute + 1, peak: max, share: pct(max, opened) });
  }
  return moments.sort((a, b) => b.peak - a.peak);
}

function ChartTip({ active, payload, opened }) {
  if (!active || !payload || !payload.length) return null;
  const r = payload[0].payload;
  return (
    <div className="tc-tip">
      <div className="tc-tip-title num">{fmtMin(r.minute)}–{fmtMin(r.minute + 1)}{r.quiz ? ` · ${r.quiz}` : ""}</div>
      <div className="tc-tip-row"><span className="sw" style={{ background: C.back, width: 8, height: 8, borderRadius: 2 }} />Went back to here<b className="num">{r.back}</b></div>
      <div className="tc-tip-row"><span className="sw" style={{ background: C.skip, width: 8, height: 8, borderRadius: 2 }} />Skipped ahead to here<b className="num">{r.skip}</b></div>
      <div className="tc-tip-row"><span className="sw" style={{ background: C.pause, width: 8, height: 8, borderRadius: "50%" }} />Paused here (not for a quiz)<b className="num">{r.pause}</b></div>
      <div className="tc-tip-row"><span className="sw" style={{ background: C.reachedFill, border: `1.5px solid ${C.reachedLine}`, width: 8, height: 8, borderRadius: 2 }} />Still watching<b className="num">{r.reached} of {opened}</b></div>
      <div className="tc-tip-hint"><i className="fas fa-mouse-pointer" /> Click to watch this minute</div>
    </div>
  );
}

export default function ClickstreamPanel() {
  const { lesson } = useFeedback();
  const { request } = useAuth();
  const sel = useSelection();
  const focusRange = useFocusRange();
  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading");
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const subs = useRef(true);
  const lessonKey = lesson ? lesson.id || lesson._id : null;

  useEffect(() => () => { subs.current = false; }, []);

  // Fetched once per lesson; the range only changes highlights (no refetch on range changes).
  const load = useCallback(() => {
    if (!lessonKey) return;
    setRefreshing(true);
    request("GET", `/lessons/${lessonKey}/clickstream`)
      .then(({ data: r }) => {
        if (!subs.current) return;
        if (r && r.success) {
          setData(r);
          setStatus("ready");
          setError(null);
        } else throw new Error("Unexpected response");
      })
      .catch((err) => {
        if (!subs.current) return;
        setError(err);
        setStatus((s) => (s === "ready" ? "ready" : "error"));
      })
      .finally(() => subs.current && setRefreshing(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonKey]);

  useEffect(() => { load(); }, [load]);

  const model = useMemo(() => {
    if (!data) return null;
    const st = data.students;
    const opened = st ? st.opened : data.summary.unique_students;
    // Quiz labels per minute ("Q1", "Q2 Q3") for the axis markers
    const quizByMinute = {};
    (data.quiz_times || []).forEach((t, i) => {
      const m = Math.floor(t / 60);
      quizByMinute[m] = (quizByMinute[m] ? quizByMinute[m] + " " : "") + `Q${i + 1}`;
    });
    const rows = (data.students_by_minute || (data.by_minute || []).map((m) => ({ minute: m.minute, back: m.backward_seek, skip: m.forward_seek, pause: m.pause, reached: 0 })))
      // The last bucket is often a partial minute past the end of the video
      .filter((r) => !lesson || !lesson.minutes || r.minute < lesson.minutes)
      .map((r) => ({ ...r, reachedPct: pct(r.reached, opened), quiz: quizByMinute[r.minute] }));
    return {
      studentsBased: !!st,
      opened,
      rows,
      st,
      quizMinutes: Object.keys(quizByMinute).map(Number).filter((m) => m < rows.length),
      moments: findMoments(rows, opened),
      maxMagnitude: Math.max(1, ...rows.map((r) => Math.max(r.back, r.skip))),
    };
  }, [data, lesson]);

  const header = (
    <PanelHeader
      title="Clickstream"
      info="How students moved through the video, counted in students (not clicks). Bars show where students went back to or skipped ahead to; the shaded area shows how many were still watching. Pauses for quiz pop-ups are left out. Click any minute to watch it."
    >
      {refreshing && <span className="tc-spinner" aria-label="Refreshing" />}
    </PanelHeader>
  );

  const shell = (children) => (
    <section className="tc-panel" aria-label="Clickstream" aria-busy={refreshing}>
      {header}
      {children}
    </section>
  );

  if (status === "loading") return shell(<PanelSkeleton rows={3} />);

  if (status === "error" || !model)
    return shell(
      <PanelState
        error
        icon="fa-exclamation-triangle"
        title="Couldn't load viewing data"
        text={errorText(error)}
        action={<button type="button" className="tc-btn" onClick={load}><i className="fas fa-redo-alt" /> Try again</button>}
      />
    );

  if (!model.opened)
    return shell(<PanelState icon="fa-play-circle" title="No one has watched this lesson yet" text="Share the student link to see where students go back, skip or pause." />);

  const { st, opened } = model;
  const selTo = Math.min(sel.to, model.rows.length) - 1;
  const lim = Math.ceil(model.maxMagnitude / 10) * 10;

  return shell(
    <>
      {error && (
        <div className="tc-banner" role="alert">
          <i className="fas fa-exclamation-circle" /> Couldn't refresh; showing the last data.
          <button type="button" className="tc-btn" onClick={load}>Retry</button>
        </div>
      )}
      <div className="tc-stats">
        {st && st.reached_end !== null && (
          <Stat value={`${pct(st.reached_end, opened)}%`} label="watched to the end" info={`${st.reached_end} of ${opened} students (estimated from the furthest point each reached).`} />
        )}
        <Stat value={st ? st.jumped_back : "—"} label="rewatched a part" info="Students who went back to an earlier point at least once; often a sign a part was hard." />
        <Stat value={st ? st.skipped : "—"} label="skipped a part" info="Students who jumped forward past part of the video." />
        <span className="tc-stats-of" title="Students who opened the lesson">of {opened} students</span>
      </div>

      <ul className="tc-insights" aria-label="What stands out">
        {model.moments.length ? (
          model.moments.map((m) => {
            const inRange = sel.partial && m.from < sel.to && m.to > sel.from;
            const range = `${fmtMin(m.from)}–${fmtMin(m.to)}`;
            return (
              <li key={m.key}>
                <button
                  type="button"
                  className={`tc-insight is-${m.key}` + (inRange ? " is-sel" : "")}
                  onClick={() => focusRange(m.from, m.to)}
                  title={`Up to ${m.peak} of ${opened} students (${m.share}%) in one minute. Click to watch.`}
                >
                  <i className={`fas ${m.icon} tc-insight-icon`} aria-hidden="true" />
                  <span className="tc-insight-text">
                    <b className="num">{m.to - m.from > 1 ? "Up to " : ""}{m.peak} students</b> {m.verb} <b className="num">{range}</b>
                    <span className="tc-insight-hint"> · {m.hint}</span>
                  </span>
                  <span className="tc-insight-watch"><i className="fas fa-play" aria-hidden="true" /> Watch</span>
                </button>
              </li>
            );
          })
        ) : (
          <li className="tc-insights-none">No moment stands out; viewing was fairly even.</li>
        )}
      </ul>

      <div className="tc-legend" aria-hidden="true">
        <span><i className="sw" style={{ background: C.back }} />Went back to</span>
        <span><i className="sw" style={{ background: C.skip }} />Skipped ahead to</span>
        {model.studentsBased && <span><i className="sw" style={{ background: C.reachedFill, border: `1.5px solid ${C.reachedLine}` }} />Still watching</span>}
        {model.quizMinutes.length > 0 && <span><b className="tc-legend-q">Q</b>Quiz</span>}
      </div>
      <div className="tc-chart" role="group" aria-label={`Students going back or skipping ahead per minute over the ${model.rows.length}-minute video`}>
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart
            data={model.rows}
            margin={{ top: 14, right: 0, bottom: 0, left: 0 }}
            barGap={1}
            onClick={(e) => { if (e && e.activeLabel !== undefined) focusRange(e.activeLabel, e.activeLabel + 1); }}
          >
            <CartesianGrid vertical={false} stroke={C.grid} />
            {sel.partial && <ReferenceArea yAxisId="students" x1={sel.from} x2={selTo} fill={C.band} fillOpacity={0.55} ifOverflow="extendDomain" />}
            <XAxis dataKey="minute" tickFormatter={fmtMin} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={28} height={20} />
            <YAxis yAxisId="students" orientation="right" domain={[0, lim]} ticks={[0, lim / 2, lim]} allowDecimals={false} tick={{ fill: C.axis, fontSize: 11 }} axisLine={false} tickLine={false} width={30} />
            <YAxis yAxisId="reach" hide domain={[0, 100]} />
            {model.studentsBased && (
              <Area yAxisId="reach" dataKey="reachedPct" type="stepAfter" fill={C.reachedFill} fillOpacity={0.22} stroke={C.reachedLine} strokeWidth={1} isAnimationActive={false} />
            )}
            {model.quizMinutes.map((m) => (
              <ReferenceLine
                key={m}
                yAxisId="students"
                x={m}
                stroke={C.quiz}
                strokeDasharray="2 3"
                label={{ value: model.rows[m].quiz, position: "top", fill: C.quiz, fontSize: 10, fontWeight: 600 }}
              />
            ))}
            <Bar yAxisId="students" dataKey="back" fill={C.back} radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Bar yAxisId="students" dataKey="skip" fill={C.skip} radius={[3, 3, 0, 0]} maxBarSize={14} />
            <Tooltip content={<ChartTip opened={opened} />} cursor={{ fill: "rgba(147, 51, 234, 0.07)" }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}
