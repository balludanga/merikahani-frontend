import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  SKIP_BACK, SKIP_FORWARD, SLEEP_MINUTES, isActive, useStoryPlayer,
} from '../utils/storyPlayer';
import { mediaUrl } from '../utils/media';
import './StoryPlayer.css';

/** 83 -> "1:23", 3725 -> "1:02:05" */
export function formatTime(seconds) {
  const total = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = String(total % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

const Icon = ({ name }) => {
  const paths = {
    play: <path d="M8 5.2v13.6a1 1 0 0 0 1.5.86l11-6.8a1 1 0 0 0 0-1.72l-11-6.8A1 1 0 0 0 8 5.2z" />,
    pause: <path d="M7 4.5h3.4v15H7zM13.6 4.5H17v15h-3.4z" />,
    previous: <path d="M6 5h2.2v14H6zM20 5.4v13.2a.8.8 0 0 1-1.25.66L9.6 12.66a.8.8 0 0 1 0-1.32l9.15-6.6A.8.8 0 0 1 20 5.4z" />,
    next: <path d="M15.8 5H18v14h-2.2zM4 5.4v13.2a.8.8 0 0 0 1.25.66l9.15-6.6a.8.8 0 0 0 0-1.32L5.25 4.74A.8.8 0 0 0 4 5.4z" />,
    queue: <path d="M4 6h12v2H4zM4 11h12v2H4zM4 16h8v2H4zM18 11.5v6.2a2.3 2.3 0 1 0 1.6 2.2V14h2.4v-2.5z" />,
    moon: <path d="M20.5 14.6A8.5 8.5 0 0 1 9.4 3.5a8.5 8.5 0 1 0 11.1 11.1z" />,
    replay: <path d="M12 5V2L7.5 6.5 12 11V8a5 5 0 1 1-5 5H5a7 7 0 1 0 7-8z" />,
  };
  return (
    <svg viewBox="0 0 24 24" width="1em" height="1em" fill="currentColor" aria-hidden="true" focusable="false">
      {paths[name]}
    </svg>
  );
};

const Skip = ({ forward, seconds }) => (
  <svg viewBox="0 0 28 28" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
    {forward
      ? <path d="M21.5 14a7.5 7.5 0 1 1-2.2-5.3M21.8 4.6v4.6h-4.6" />
      : <path d="M6.5 14a7.5 7.5 0 1 0 2.2-5.3M6.2 4.6v4.6h4.6" />}
    <text x="14" y="17.6" textAnchor="middle" fontSize="8.5" fontWeight="700" fill="currentColor" stroke="none">{seconds}</text>
  </svg>
);

const SPEED_LABEL = (speed) => `${speed}×`;

function cover(story) {
  if (story.cover_image && !story.cover_image.startsWith('data:')) return mediaUrl(story.cover_image);
  return null;
}

const initial = (text) => Array.from(text || '')[0] || 'ल';

const StoryPlayer = ({ stories }) => {
  const [state, player] = useStoryPlayer(stories);
  const [queueOpen, setQueueOpen] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const [scrub, setScrub] = useState(null); // seconds while the listener drags the slider
  const rootRef = useRef(null);
  const story = stories[state.index] || stories[0];

  // Close the sheet and the menu on Escape or a click elsewhere.
  useEffect(() => {
    if (!queueOpen && !sleepOpen) return undefined;
    const onDown = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setQueueOpen(false);
        setSleepOpen(false);
      }
    };
    const onKey = (event) => {
      if (event.key === 'Escape') {
        setQueueOpen(false);
        setSleepOpen(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [queueOpen, sleepOpen]);

  if (!story) {
    return (
      <section className="player player-empty" aria-label="लेखनी ऑडियो">
        <h3 className="player-title">लेखनी ऑडियो</h3>
        <p className="player-author">सुनने के लिए अभी कोई रचना उपलब्ध नहीं।</p>
      </section>
    );
  }

  const active = isActive(state);
  const canSeek = state.source === 'server' && state.duration > 0 && state.phase !== 'preparing';
  const shown = scrub !== null ? scrub : state.time;
  const progress = canSeek ? Math.min(1, shown / state.duration) : state.progress;
  const hasPrevious = state.index > 0;
  const hasNext = state.index + 1 < stories.length;
  const art = cover(story);
  const hue = (story.id * 47) % 360;
  const authorName = (story.author && (story.author.full_name || story.author.username)) || '';

  const playLabel = {
    idle: 'सुनें', preparing: 'रद्द करें', playing: 'रोकें', paused: 'चलाएँ', ended: 'फिर से सुनें',
  }[state.phase];

  const sleepLabel = () => {
    if (state.sleep.mode === 'minutes') return formatTime(state.sleep.remaining);
    if (state.sleep.mode === 'end') return 'रचना के अंत तक';
    return 'नींद टाइमर';
  };

  const onKeyDown = (event) => {
    const target = event.target;
    const tag = target.tagName;
    if (tag === 'INPUT' && target.type !== 'range' && target.type !== 'checkbox') return;
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    const onControl = tag === 'BUTTON' || tag === 'A' || target.getAttribute('role') === 'switch';
    const key = event.key.toLowerCase();
    const handled = () => event.preventDefault();
    if (key === 'k' || (key === ' ' && !onControl)) {
      handled();
      player.toggle();
    } else if (key === 'j') {
      handled();
      player.skip(-SKIP_BACK);
    } else if (key === 'l') {
      handled();
      player.skip(SKIP_FORWARD);
    } else if (key === 'n') {
      handled();
      player.next();
    } else if (key === 'p') {
      handled();
      player.previous();
    } else if (key === 'arrowleft' && !onControl) {
      handled();
      player.skip(-5);
    } else if (key === 'arrowright' && !onControl) {
      handled();
      player.skip(5);
    }
  };

  // The slider: arrows move 5 s, Page keys 30 s (a bare 1 s step is too fine to be useful).
  const onSliderKey = (event) => {
    const steps = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -30, PageUp: 30 };
    if (steps[event.key] !== undefined) {
      event.preventDefault();
      player.skip(steps[event.key]);
    }
  };

  const status = () => {
    if (state.phase === 'preparing') {
      return `आवाज़ तैयार हो रही है…${state.prepared ? ` ${state.prepared}%` : ''}`;
    }
    if (state.source === 'server') return 'प्राकृतिक आवाज़';
    if (state.source === 'browser') return 'डिवाइस की आवाज़';
    return state.ready[story.id] ? 'आवाज़ तैयार ✓' : '';
  };

  return (
    <section
      className={`player phase-${state.phase}`}
      ref={rootRef}
      onKeyDown={onKeyDown}
      aria-label="लेखनी ऑडियो प्लेयर"
      aria-keyshortcuts="k j l n p"
    >
      <div className="player-main">
        <div className="player-cover" style={art ? undefined : { background: `linear-gradient(145deg, hsl(${hue} 38% 30%), hsl(${(hue + 40) % 360} 42% 18%))` }} aria-hidden="true">
          {art ? <img src={art} alt="" loading="lazy" /> : <span>{initial(story.title)}</span>}
          <div className={`player-eq${state.phase === 'playing' ? ' on' : ''}`}>
            <span /><span /><span /><span />
          </div>
        </div>

        <div className="player-body">
          <div className="player-head">
            <span className="player-kicker">{active || state.phase === 'ended' ? 'अभी सुन रहे हैं' : 'लेखनी ऑडियो'}</span>
            {status() && <span className={`player-chip${state.source === 'browser' ? ' soft' : ''}`}>{status()}</span>}
            {state.resumedFrom > 0 && state.time < state.resumedFrom + 8 && (
              <span className="player-chip soft" role="status" title="पिछली बार की जगह से जारी">↻ {formatTime(state.resumedFrom)} से जारी</span>
            )}
            <span className="player-count">{state.index + 1} / {stories.length}</span>
          </div>

          <h3 className="player-title">
            <Link to={`/post/${story.slug}`} title="रचना पढ़ते हुए सुनें">{story.title}</Link>
          </h3>
          {authorName && <p className="player-author">{authorName}</p>}

          {state.phase === 'preparing' ? (
            <div className="player-making" role="status">
              <div className="player-making-bar"><span style={{ width: `${Math.max(6, state.prepared)}%` }} /></div>
              <p>पहली बार सुनने पर आवाज़ बनने में थोड़ा समय लगता है। इसके बाद यह तुरंत चलेगी।</p>
            </div>
          ) : (
            <div className="player-scrub">
              <span className="player-time">{canSeek ? formatTime(shown) : state.source === 'browser' ? `${Math.round(progress * 100)}%` : '0:00'}</span>
              <input
                type="range"
                className="player-slider"
                min="0"
                max={canSeek ? state.duration : 1}
                step="1"
                value={canSeek ? shown : 0}
                disabled={!canSeek}
                style={{ '--fill': `${progress * 100}%` }}
                aria-label="रचना में स्थिति"
                aria-valuetext={canSeek ? `${formatTime(shown)} में से ${formatTime(state.duration)}` : undefined}
                title={state.source === 'browser' ? 'डिवाइस की आवाज़ में आगे-पीछे नहीं किया जा सकता' : undefined}
                onChange={(event) => {
                  const to = Number(event.target.value);
                  setScrub(to);
                  player.seekTo(to);
                }}
                onPointerUp={() => setScrub(null)}
                onBlur={() => setScrub(null)}
                onKeyDown={onSliderKey}
              />
              <span className="player-time">{canSeek ? formatTime(state.duration) : '—'}</span>
            </div>
          )}

          <div className="player-controls">
            <button type="button" className="pc" onClick={() => player.previous()} disabled={!hasPrevious && !(canSeek && state.time > 1)} aria-label="पिछली रचना" title="पिछली रचना (शुरू से सुनने के लिए एक बार, पिछली के लिए दोबारा)">
              <Icon name="previous" />
            </button>
            <button type="button" className="pc pc-skip" onClick={() => player.skip(-SKIP_BACK)} disabled={!canSeek} aria-label={`${SKIP_BACK} सेकंड पीछे`} title={`${SKIP_BACK} सेकंड पीछे`}>
              <Skip seconds={SKIP_BACK} />
            </button>
            <button type="button" className={`pc pc-play${state.phase === 'preparing' ? ' busy' : ''}`} onClick={() => player.toggle()} aria-label={playLabel} title={playLabel}>
              {state.phase === 'preparing' ? <span className="spinner" aria-hidden="true" /> : <Icon name={state.phase === 'playing' ? 'pause' : state.phase === 'ended' ? 'replay' : 'play'} />}
            </button>
            <button type="button" className="pc pc-skip" onClick={() => player.skip(SKIP_FORWARD)} disabled={!canSeek} aria-label={`${SKIP_FORWARD} सेकंड आगे`} title={`${SKIP_FORWARD} सेकंड आगे`}>
              <Skip forward seconds={SKIP_FORWARD} />
            </button>
            <button type="button" className="pc" onClick={() => player.next()} disabled={!hasNext} aria-label="अगली रचना" title="अगली रचना">
              <Icon name="next" />
            </button>
          </div>
        </div>
      </div>

      {state.error && <p className="player-note error" role="alert">{state.error}</p>}

      <div className="player-tools">
        <button type="button" className="pt" onClick={() => player.cycleSpeed()} aria-label={`गति ${SPEED_LABEL(state.speed)}। बदलने के लिए दबाएँ`} title="सुनने की गति बदलें">
          <b>{SPEED_LABEL(state.speed)}</b><span>गति</span>
        </button>

        <div className="pt-wrap">
          <button type="button" className={`pt${state.sleep.mode !== 'off' ? ' on' : ''}`} onClick={() => { setSleepOpen((v) => !v); setQueueOpen(false); }} aria-haspopup="menu" aria-expanded={sleepOpen} title="नींद टाइमर">
            <Icon name="moon" /><span>{sleepLabel()}</span>
          </button>
          {sleepOpen && (
            <div className="player-menu" role="menu" aria-label="नींद टाइमर">
              {[{ key: 'off', label: 'बंद' }, ...SLEEP_MINUTES.map((m) => ({ key: m, label: `${m} मिनट बाद` })), { key: 'end', label: 'रचना के अंत तक' }].map((item) => {
                const selected = item.key === 'off' ? state.sleep.mode === 'off' : item.key === 'end' ? state.sleep.mode === 'end' : false;
                return (
                  <button
                    key={item.key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={selected}
                    className={selected ? 'selected' : ''}
                    onClick={() => {
                      if (item.key === 'off') player.setSleep('off');
                      else if (item.key === 'end') player.setSleep('end');
                      else player.setSleep('minutes', item.key);
                      setSleepOpen(false);
                    }}
                  >
                    {item.label}{selected ? ' ✓' : ''}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <button
          type="button"
          role="switch"
          aria-checked={state.autoNext}
          className={`pt pt-switch${state.autoNext ? ' on' : ''}`}
          onClick={() => player.setAutoNext(!state.autoNext)}
          title="एक रचना ख़त्म होने पर अगली अपने-आप चले। (हर नई रचना की आवाज़ बनाने में रोज़ की मुफ़्त सीमा लगती है।)"
        >
          <i aria-hidden="true" /><span>अपने-आप अगली</span>
        </button>

        <button type="button" className={`pt pt-queue${queueOpen ? ' on' : ''}`} onClick={() => { setQueueOpen((v) => !v); setSleepOpen(false); }} aria-expanded={queueOpen} aria-controls="player-queue" title="कतार">
          <Icon name="queue" /><span>कतार ({stories.length})</span>
        </button>
      </div>

      {queueOpen && (
        <div className="player-queue" id="player-queue" role="region" aria-label="कतार">
          <div className="player-queue-head">
            <strong>कतार</strong>
            <button type="button" className="player-queue-close" onClick={() => setQueueOpen(false)} aria-label="कतार बंद करें">×</button>
          </div>
          <ol>
            {stories.map((item, i) => {
              const current = i === state.index;
              return (
                <li key={item.id} className={current ? 'current' : ''}>
                  <button type="button" onClick={() => { player.play(i); setQueueOpen(false); }} aria-current={current ? 'true' : undefined}>
                    <span className="q-index">{current && state.phase === 'playing' ? <span className="q-eq" aria-hidden="true"><i /><i /><i /></span> : i + 1}</span>
                    <span className="q-text">
                      <b>{item.title}</b>
                      <small>{(item.author && (item.author.full_name || item.author.username)) || ''}</small>
                    </span>
                    {state.ready[item.id]
                      ? <span className="q-badge ready" title="इसकी आवाज़ पहले से तैयार है">तैयार</span>
                      : <span className="q-badge" title="पहली बार सुनने पर आवाज़ बनेगी">नई</span>}
                  </button>
                </li>
              );
            })}
          </ol>
          <p className="player-queue-hint">“तैयार” रचनाएँ तुरंत चलती हैं। “नई” रचना की आवाज़ पहली बार बनने में एक मिनट तक लग सकता है।</p>
        </div>
      )}
    </section>
  );
};

export default StoryPlayer;
