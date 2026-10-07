import { useEffect, useRef, useState, type PointerEvent } from 'react';
import { useDeepContext } from '../data/api';
import { handovers } from '../data/control';
import { addUnits, eventsChrono, formatDate, inWindow, MAX_YEAR, MIN_MS, MIN_YEAR, neighbourEvent, parts, startOf, tickLabel, toMs, utc, yearLabel, type Scale } from '../data/time';
import { useCollapse } from '../state/collapse';
import { DEEP_START_MA, DEEP_STEP_MA, RATES, useTime } from '../state/time';

const SCALES: Scale[] = ['century', 'year', 'month', 'day', 'hour'];
const SCALE_NAME: Record<Scale, string> = { century: 'Century', year: 'Year', month: 'Month', day: 'Day', hour: 'Hour' };
const FINER: Record<Scale, Scale> = { century: 'year', year: 'month', month: 'day', day: 'hour', hour: 'hour' };
const DAY = 86400000;
const UNIT_MS: Record<Scale, number> = { hour: DAY / 24, day: DAY, month: DAY * 30.4369, year: DAY * 365.2425, century: DAY * 36524.25 };
const TICK_PX = 130;
const LABEL_EVERY = 4; // every 4th tick carries a reference date; the rest stay bare lines
const DRAG_SLOP = 4;
const SPAN = MAX_YEAR - MIN_YEAR;
// Share of the overview bar given to deep time. The two stretches use different scales
// (millions of years, then years), joined end to end so the bar reads as one line.
const DEEP_SHARE = 0.3;

const maLabel = (ma: number) => (ma === 0 ? 'Present-day continents' : `${ma} million years ago`);

export default function TimeWorkspace() {
  const { ms, scale, playing, rate, deep, ma, setMs, setScale, setPlaying, setRate, setDeep, setMa } = useTime();
  const [collapsed, toggle] = useCollapse('timeline');
  const ruler = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; at: number; moved: boolean } | null>(null);
  const [width, setWidth] = useState(1000);
  const marks = useDeepContext(0, 0).marks;
  const prev = neighbourEvent(ms, scale, -1);
  const next = neighbourEvent(ms, scale, 1);
  const { y, m, d } = parts(ms);
  // One pixel of drag is this much time: milliseconds in history, million years in deep time.
  const perPx = deep ? DEEP_STEP_MA / TICK_PX : UNIT_MS[scale] / TICK_PX;
  const live = useRef({ ms, ma, deep, perPx });
  live.current = { ms, ma, deep, perPx };

  useEffect(() => {
    const el = ruler.current!;
    const observer = new ResizeObserver(() => setWidth(el.clientWidth));
    observer.observe(el);
    // Wheel scrolls time. Registered directly so the page itself does not scroll.
    const onWheel = (ev: WheelEvent) => {
      ev.preventDefault();
      const c = live.current;
      const delta = (ev.deltaX || ev.deltaY) * c.perPx;
      if (c.deep) setMa(c.ma - delta);
      else setMs(c.ms + delta);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => {
      observer.disconnect();
      el.removeEventListener('wheel', onWheel);
    };
  }, [setMs, setMa]);

  const down = (ev: PointerEvent<HTMLDivElement>) => {
    ev.currentTarget.setPointerCapture(ev.pointerId);
    drag.current = { x: ev.clientX, at: deep ? ma : ms, moved: false };
    setPlaying(false);
  };
  const move = (ev: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    if (!g) return;
    const dx = ev.clientX - g.x;
    if (Math.abs(dx) > DRAG_SLOP) g.moved = true;
    if (!g.moved) return;
    if (deep) setMa(g.at + dx * perPx); // dragging right goes back in time, so the count of years ago rises
    else setMs(g.at - dx * perPx);
  };
  const up = (ev: PointerEvent<HTMLDivElement>) => {
    const g = drag.current;
    drag.current = null;
    if (!g || g.moved) return;
    // A press without a drag drops the playhead on the point that was pressed.
    const offset = ev.clientX - ev.currentTarget.getBoundingClientRect().left - width / 2;
    if (deep) setMa(ma - offset * perPx);
    else setMs(ms + offset * perPx);
  };

  const count = Math.ceil(width / TICK_PX / 2) + 1;
  const base = startOf(ms, scale);
  const ticks = Array.from({ length: count * 2 + 1 }, (_, i) => addUnits(base, scale, i - count));
  const deepTicks = Array.from({ length: count * 2 + 1 }, (_, i) => ma + (count - i) * DEEP_STEP_MA).filter((t) => t >= 0 && t <= DEEP_START_MA);
  const enterDeep = (at: number) => { setDeep(true); setMa(at); };
  const fromStart = () => { setDeep(true); setMa(DEEP_START_MA); setPlaying(true); };

  return (
    <footer className="time">
      <div className="time__controls">
        <div className="time__transport">
          {!deep && <button type="button" disabled={!prev} onClick={() => prev && setMs(toMs(prev.date))} title={prev ? `Previous event: ${prev.title}` : undefined}>‹ Previous</button>}
          <button type="button" className="is-accent" onClick={() => setPlaying(!playing)}>{playing ? '❚❚ Pause' : '▶ Play'}</button>
          {!deep && <button type="button" disabled={!next} onClick={() => next && setMs(toMs(next.date))} title={next ? `Next event: ${next.title}` : undefined}>Next ›</button>}
          <button type="button" onClick={fromStart} title="Play the whole timeline from 200 million years ago to the present">⏮ From the beginning</button>
        </div>
        <p className="time__now" aria-live="polite">{deep ? maLabel(ma) : formatDate(ms, scale)}</p>
        <span className="time__controls-end">
          <p className="time__rate-summary">1 second = {deep ? `${DEEP_STEP_MA} million years` : RATES.find((r) => r.id === rate)!.label}</p>
          <button type="button" className="time__collapse" onClick={toggle} title={collapsed ? 'Show the scale, rate and ruler' : 'Hide everything but play/pause and the date'} aria-expanded={!collapsed}>
            {collapsed ? '▲ Ruler' : '▼ Ruler'}
          </button>
        </span>
      </div>
      {!collapsed && <>
      {/* Its own full-width row: the scale and playback-rate controls were previously crammed
          into the same column as transport and the date, overflowed past the edge on any
          normal window width, and simply vanished with no scrollbar to reach them.
          Every button here uses the same `option` class the rest of the app uses for a visible,
          bordered, clickable-looking control — without it (the previous state) these rendered
          as plain dim text with no border or background, reading as a caption, not a set of
          configuration buttons, which is exactly the "looks like some default thing" complaint. */}
      <div className="time__speed">
        <span className="time__units">
          <button type="button" className={`option${deep ? ' is-on' : ''}`} onClick={() => enterDeep(ma)} aria-pressed={deep}>Million years</button>
          {SCALES.map((s) => (
            <button key={s} type="button" className={`option${!deep && s === scale ? ' is-on' : ''}`} onClick={() => setScale(s)} aria-pressed={!deep && s === scale}>{SCALE_NAME[s]}</button>
          ))}
        </span>
        <span title="How much history passes in one second of playback. Every change is still shown, however fast.">· 1 second =</span>
        {deep
          ? <button type="button" className="option is-on" disabled>{DEEP_STEP_MA} million years</button>
          : RATES.map((r) => (
            <button key={r.id} type="button" className={`option${r.id === rate ? ' is-on' : ''}`} onClick={() => setRate(r.id)} aria-pressed={r.id === rate}>{r.label}</button>
          ))}
      </div>

      <div ref={ruler} className="time__ruler" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={() => { drag.current = null; }} title="Drag to scroll through time, or click a point to jump there">
        {/* The selected moment (the playhead below) is the only date shown in full, but a bare
            field of unlabelled lines made it impossible to tell what a distant tick actually
            was without dragging all the way there — so every LABEL_EVERY-th tick carries a
            short reference date too (smaller and dimmer than the playhead's own), the rest stay
            plain marks. A periodic subset, not every tick: enough to orient by by without
            re-creating the "every tick has its own date" clutter this deliberately replaced. */}
        {deep
          ? deepTicks.map((t, i) => (
            <span key={t} className={`time__tick${marks.some((w) => Math.abs(w.ma - t) < DEEP_STEP_MA / 2) ? ' has-events' : ''}`} style={{ left: width / 2 + (ma - t) / perPx }}>
              {i % LABEL_EVERY === 0 && <i className="time__tick-label">{t} Ma</i>}
            </span>
          ))
          : ticks.map((t, i) => (
            <span key={t} className={`time__tick${eventsChrono.some((e) => inWindow(e, t, scale)) ? ' has-events' : ''}${(scale === 'year' || scale === 'century') && handovers.some((h) => h.year >= parts(t).y && h.year < parts(t).y + (scale === 'century' ? 100 : 1)) ? ' has-change' : ''}`} style={{ left: width / 2 + (t - ms) / perPx }}>
              {(i - count) % LABEL_EVERY === 0 && <i className="time__tick-label">{tickLabel(t, scale)}</i>}
            </span>
          ))}
        <div className="time__playhead">
          <span />
          <p>{deep ? (ma === 0 ? 'Today' : `${ma} Ma`) : formatDate(ms, FINER[scale], false)}</p>
        </div>
      </div>

      {/* One line for the whole span: deep time on the left, recorded history on the right.
          Each track's thumb already tracks the current position, but a thin 3px bar among a
          field of 1px event ticks reads as nothing in particular — there was no actual date
          visible here, only a cursor you'd have to already know the meaning of. A label at the
          same position, showing the same date the main ruler's playhead shows, makes "where am
          I, and which way do I drag to get somewhere else" legible at a glance. */}
      <div className="time__overview">
        <span>{DEEP_START_MA} Ma</span>
        <div className="time__track time__track--deep" style={{ flex: DEEP_SHARE }}>
          {marks.map((w) => <i key={w.title} style={{ left: `${((DEEP_START_MA - Math.min(DEEP_START_MA, w.ma)) / DEEP_START_MA) * 100}%` }} title={`${w.ma} Ma · ${w.title}`} />)}
          {deep && <div className="time__track-now" style={{ left: `${((DEEP_START_MA - Math.min(DEEP_START_MA, ma)) / DEEP_START_MA) * 100}%` }}>{maLabel(ma)}</div>}
          <input type="range" className={deep ? '' : 'is-idle'} min={0} max={DEEP_START_MA} step={DEEP_STEP_MA} value={DEEP_START_MA - ma} onChange={(ev) => enterDeep(DEEP_START_MA - Number(ev.target.value))} aria-label="Million years ago" />
        </div>
        <button type="button" className="time__join" onClick={() => { setScale('century'); setMs(MIN_MS); }} title="Jump to the start of recorded history">{yearLabel(MIN_YEAR)}</button>
        <div className="time__track" style={{ flex: 1 - DEEP_SHARE }}>
          {eventsChrono.map((e) => (
            <i key={e.id} style={{ left: `${((parts(toMs(e.date)).y - MIN_YEAR) / SPAN) * 100}%` }} />
          ))}
          {!deep && <div className="time__track-now" style={{ left: `${((y - MIN_YEAR) / SPAN) * 100}%` }}>{yearLabel(y)}</div>}
          <input type="range" className={deep ? 'is-idle' : ''} min={MIN_YEAR} max={MAX_YEAR} value={y} onChange={(ev) => setMs(utc(Number(ev.target.value), m, Math.min(d, 28)))} aria-label="Year" />
        </div>
        <span>{yearLabel(MAX_YEAR)}</span>
        <span className="time__key"><i className="gold">●</i> event <i className="rust">■</i> change of holder</span>
      </div>
      </>}
    </footer>
  );
}
