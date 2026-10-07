import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { SourceList } from '../components/Evidence';
import { Page } from '../components/Shell';
import { eventById } from '../data/events';
import { sceneById, SHOTS } from '../data/scenes';
import { logActivity } from '../state/recent';

const CHAPTER_SECONDS = 9;
const MODES = ['Third-person', 'Narrator context', 'Evidence overlay'] as const;

export default function LivingHistory() {
  const { id = '' } = useParams();
  const scene = sceneById[id];
  const [chapterIndex, setChapterIndex] = useState(1);
  const [shotId, setShotId] = useState<string | null>(null);
  const [mode, setMode] = useState<(typeof MODES)[number]>('Third-person');
  const [hotspot, setHotspot] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  const last = scene ? scene.chapters.length - 1 : 0;

  useEffect(() => {
    if (!playing) return;
    const t = window.setInterval(() => setElapsed((e) => e + 0.25), 250);
    return () => window.clearInterval(t);
  }, [playing]);

  useEffect(() => {
    if (elapsed < CHAPTER_SECONDS) return;
    if (chapterIndex >= last) {
      setPlaying(false);
      return;
    }
    setChapterIndex(chapterIndex + 1);
    setShotId(null);
    setElapsed(0);
  }, [elapsed, chapterIndex, last]);

  if (!scene) {
    return (
      <Page>
        <main className="directory">
          <h1>No scene here</h1>
          <p>Only moments with enough evidence to stage have a Living History scene.</p>
          <Link className="link" to="/">‹ Back to the map</Link>
        </main>
      </Page>
    );
  }

  const chapter = scene.chapters[chapterIndex];
  const shot = SHOTS.find((s) => s.id === (shotId ?? chapter.shot))!;
  const event = eventById[scene.eventId];
  const unknown = chapter.kind === 'unknown';
  const openHotspot = scene.hotspots.find((h) => h.id === hotspot);
  const finished = !playing && chapterIndex === last && elapsed >= CHAPTER_SECONDS;
  const paused = !playing && !finished && elapsed > 0;

  useEffect(() => {
    logActivity({ id: `living-${scene.id}`, url: `/living/${scene.id}`, kind: 'living-history', title: `Living History · ${scene.title}`, sub: `Chapter ${chapterIndex + 1} of ${scene.chapters.length} · ${chapter.title}` });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.id, chapterIndex]);
  const goChapter = (i: number) => {
    setChapterIndex(i);
    setShotId(null);
    setElapsed(0);
    setHotspot(null);
  };

  return (
    <Page status={`Reconstruction · date-level precision · ${scene.dateLabel}`}>
      <div className="subbar">
        <div className="options">
          {MODES.map((m) => (
            <button key={m} type="button" className={`option${m === mode ? ' is-on' : ''}`} onClick={() => setMode(m)}>{m}</button>
          ))}
          <Link className="option" to={`/?event=${scene.eventId}`}>Map context</Link>
        </div>
        <div className="options">
          {SHOTS.map((s) => (
            <button key={s.id} type="button" className={`option${s.id === shot.id ? ' is-on' : ''}`} disabled={unknown} onClick={() => setShotId(s.id)}>{s.label}</button>
          ))}
        </div>
      </div>

      <div className="workspace">
        <section className={`scene${unknown ? ' is-unknown' : ''}`}>
          <img
            className="scene__image"
            src={scene.image}
            alt={scene.imageAlt}
            style={{ transform: `scale(${shot.scale})`, transformOrigin: `${shot.x}% ${shot.y}%` }}
          />
          <div className="scene__wash" />

          {unknown ? (
            <div className="scene__bridge">
              <p className="eyebrow">Narrator bridge · unknown interval</p>
              <p className="scene__bridgeText">{chapter.narrator}</p>
              <p className="dim">{chapter.interpretiveNote}</p>
            </div>
          ) : (
            <>
              <div className="scene__slate">
                <strong className="gold">SHOT {String(SHOTS.indexOf(shot) + 1).padStart(2, '0')} · {shot.label}</strong>
                <span>{chapter.setting}</span>
              </div>
              {shot.id === 'wide' && mode !== 'Narrator context' && scene.hotspots.map((h) => (
                <button key={h.id} type="button" className={`hotspot${h.id === hotspot ? ' is-on' : ''}`} style={{ left: `${h.x}%`, top: `${h.y}%` }} onClick={() => setHotspot(h.id === hotspot ? null : h.id)}>
                  <i>+</i><span>{h.label}</span>
                </button>
              ))}
              {mode === 'Narrator context' && <p className="scene__caption">{chapter.narrator}</p>}
              {mode === 'Evidence overlay' && <p className="scene__caption">{scene.reconstructionNote}</p>}
              {openHotspot && (
                <div className="scene__note" role="status">
                  <strong className="gold">{openHotspot.label}</strong>
                  <p>{openHotspot.note}</p>
                </div>
              )}
            </>
          )}
          {paused && (
            <div className="scene__end scene__end--light">
              <p className="eyebrow">Paused · chapter {chapterIndex + 1} of {scene.chapters.length}</p>
              <p className="scene__bridgeText">{chapter.title}</p>
              <div className="options">
                <button type="button" className="option is-on" onClick={() => setPlaying(true)}>▶ Resume</button>
                <button type="button" className="option" onClick={() => goChapter(0)}>Restart the scene</button>
              </div>
            </div>
          )}
          {finished && (
            <div className="scene__end">
              <p className="eyebrow">Scene complete</p>
              <p className="scene__bridgeText">{scene.chapters.length} chapters · {scene.chapters.filter((c) => c.kind === 'known').length} from the record, {scene.chapters.filter((c) => c.kind === 'unknown').length} marked as unknown</p>
              <div className="options">
                <button type="button" className="option is-on" onClick={() => goChapter(0)}>Watch again</button>
                <Link className="option" to={`/?event=${scene.eventId}`}>Back to the map at this moment</Link>
                <Link className="option" to="/people/shivaji">Follow the journey</Link>
              </div>
            </div>
          )}
          <p className="scene__observer">Observer view · history cannot be changed</p>
        </section>

        <aside className="side side--scene">
          <p className="eyebrow">Reconstructed scene · exact room unverified</p>
          <h2>Living History · {scene.title}</h2>
          <div className="card card--light">
            <strong className="accent">{scene.dateLabel} · {scene.place}</strong>
            <span>{scene.setting}</span>
            <span>{scene.participants}</span>
            <span className="muted">{scene.relationship}</span>
          </div>
          {!unknown && (
            <div className="card card--light card--accent">
              <p className="eyebrow eyebrow--bold">Paraphrased context · not recorded speech</p>
              <p className="quote">{chapter.paraphrase}</p>
              <p className="rust">{chapter.interpretiveNote}</p>
            </div>
          )}
          <div className="card card--light">
            <p className="eyebrow eyebrow--bold">Narrator caption</p>
            <p>{chapter.narrator}</p>
          </div>
          <p className="eyebrow eyebrow--bold">Evidence · surroundings · references</p>
          <p>{scene.reconstructionNote}</p>
          <SourceList ids={scene.sourceIds} />
          <Link className="link" to={`/?event=${event.id}`}>‹ {event.title} on the map</Link>
        </aside>
      </div>

      <footer className="chapters">
        <div className="chapters__strip">
          {scene.chapters.map((c, i) => (
            <button key={c.id} type="button" className={`chapter${i === chapterIndex ? ' is-on' : ''}`} onClick={() => goChapter(i)}>
              <span>{c.title}</span>
              <i><b style={{ width: `${i < chapterIndex ? 100 : i === chapterIndex ? (elapsed / CHAPTER_SECONDS) * 100 : 0}%` }} /></i>
            </button>
          ))}
        </div>
        <div className="chapters__play">
          <button type="button" className="option" disabled={chapterIndex === 0} onClick={() => goChapter(chapterIndex - 1)}>← Previous known moment</button>
          <button type="button" className="playbtn" onClick={() => { if (!playing && chapterIndex === last && elapsed >= CHAPTER_SECONDS) goChapter(0); setPlaying(!playing); }}>
            {playing ? '❚❚ Pause' : '▶ Play this scene'}
          </button>
          <button type="button" className="option" disabled={chapterIndex === last} onClick={() => goChapter(chapterIndex + 1)}>Next known moment →</button>
        </div>
      </footer>
    </Page>
  );
}
