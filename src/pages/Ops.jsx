import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { opsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { updateMetaTags } from '../utils/seo';
import NotFound from '../components/NotFound';
import './Ops.css';

// The server sends UTC times without a zone mark.
const asDate = (stamp) => new Date(/Z|[+-]\d\d:?\d\d$/.test(stamp) ? stamp : `${stamp}Z`);
const when = (stamp) => (stamp
  ? asDate(stamp).toLocaleString('hi-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false })
  : '—');
const dayLabel = (iso) => new Date(`${iso}T00:00:00`).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' });
const megabytes = (bytes) => `${(bytes / (1024 * 1024)).toFixed(bytes < 10 * 1024 * 1024 ? 1 : 0)} एमबी`;

// Database names, in Hindi (an unknown one is shown as it is).
const TABLE_NAMES = {
  users: 'खाते', posts: 'रचनाएँ', comments: 'प्रतिक्रियाएँ', highlights: 'हाइलाइट', claps: 'तालियाँ',
  bookmarks: 'सहेजी गई रचनाएँ', follows: 'फ़ॉलो', notifications: 'सूचनाएँ', user_media: 'तस्वीरें (प्रोफ़ाइल)',
  tags: 'टैग', post_tags: 'रचना–टैग जोड़', server_errors: 'गड़बड़ी का लेखा', alembic_version: 'संस्करण-सूची',
};
const DATABASE_KINDS = { postgresql: 'पोस्टग्रेस (Postgres)', sqlite: 'एसक्यूलाइट (SQLite)' };
const number = (n) => Number(n || 0).toLocaleString('en-IN');

const uptime = (seconds) => {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  if (days) return `${days} दिन ${hours} घंटे`;
  if (hours) return `${hours} घंटे ${minutes} मिनट`;
  return `${minutes} मिनट`;
};

const SERIES = [
  { key: 'signups', label: 'नए खाते' },
  { key: 'stories', label: 'नई रचनाएँ' },
  { key: 'responses', label: 'प्रतिक्रियाएँ' },
];

// How full the database is, in words as well as colour.
const fullness = (share) => {
  if (share >= 0.9) return { cls: 'serious', text: 'लगभग भर चुका है — अभी कदम उठाएँ' };
  if (share >= 0.7) return { cls: 'warn', text: 'ध्यान दें — जगह कम हो रही है' };
  return { cls: 'ok', text: 'ठीक है' };
};

const Tile = ({ label, value, note }) => (
  <div className="ops-tile">
    <span className="ops-tile-label">{label}</span>
    <strong className="ops-tile-value">{value}</strong>
    {note && <span className="ops-tile-note">{note}</span>}
  </div>
);

const DailyChart = ({ daily }) => {
  const [series, setSeries] = useState('signups');
  const [hover, setHover] = useState(null);
  const label = SERIES.find((s) => s.key === series).label;
  const values = daily.map((d) => d[series]);
  const max = Math.max(1, ...values);
  const total = values.reduce((a, b) => a + b, 0);
  const shown = hover !== null ? daily[hover] : null;

  return (
    <section className="ops-card">
      <div className="ops-card-head">
        <h2>पिछले 30 दिन</h2>
        <div className="ops-switch" role="tablist" aria-label="क्या देखें">
          {SERIES.map((s) => (
            <button
              key={s.key}
              type="button"
              role="tab"
              aria-selected={series === s.key}
              className={series === s.key ? 'on' : ''}
              onClick={() => setSeries(s.key)}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <p className="ops-readout" aria-live="polite">
        {shown ? `${dayLabel(shown.date)}: ${shown[series]} ${label}` : `कुल ${total} ${label} (30 दिन)`}
      </p>
      <div
        className="ops-bars"
        role="img"
        aria-label={`${label}, पिछले 30 दिन, कुल ${total}`}
        onMouseLeave={() => setHover(null)}
      >
        {daily.map((d, i) => (
          <div
            key={d.date}
            className="ops-bar-slot"
            onMouseEnter={() => setHover(i)}
            onFocus={() => setHover(i)}
            onBlur={() => setHover(null)}
            tabIndex={0}
            title={`${dayLabel(d.date)}: ${d[series]}`}
          >
            <span className="ops-bar" style={{ height: `${(d[series] / max) * 100}%` }} data-zero={d[series] === 0} />
          </div>
        ))}
      </div>
      <div className="ops-axis"><span>{dayLabel(daily[0].date)}</span><span>सबसे ऊँचा: {max}</span><span>{dayLabel(daily[daily.length - 1].date)}</span></div>
      <details className="ops-table-view">
        <summary>तालिका के रूप में देखें</summary>
        <table>
          <thead><tr><th>दिन</th>{SERIES.map((s) => <th key={s.key}>{s.label}</th>)}</tr></thead>
          <tbody>
            {[...daily].reverse().map((d) => (
              <tr key={d.date}><td>{dayLabel(d.date)}</td>{SERIES.map((s) => <td key={s.key}>{d[s.key]}</td>)}</tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
};

const Ops = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [data, setData] = useState(null);
  const [state, setState] = useState('loading'); // loading | ready | closed | error
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const response = await opsAPI.overview();
      setData(response.data);
      setState('ready');
    } catch (error) {
      // A 404 (not the admin) and a missing sign-in look identical on purpose.
      const status = error.response && error.response.status;
      setState(status === 404 || status === 401 ? 'closed' : 'error');
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    updateMetaTags({ title: 'स्थिति', type: 'website', noindex: true });
  }, []);

  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      setState('closed');
      return;
    }
    load();
  }, [authLoading, isAuthenticated, load]);

  if (state === 'closed') return <NotFound />;
  if (state === 'loading' || authLoading) return <div className="page-loading">लोड हो रहा है…</div>;
  if (state === 'error') {
    return (
      <div className="ops-page">
        <p className="empty-state">
          आँकड़े लोड नहीं हो सके। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      </div>
    );
  }

  const { database, totals, recent, daily, recent_users: users, top_stories: top, errors, server } = data;
  const share = database.limit_bytes ? database.size_bytes / database.limit_bytes : null;
  const gauge = share === null ? null : fullness(share);

  return (
    <div className="ops-page">
      <div className="ops-head">
        <h1>स्थिति</h1>
        <div className="ops-head-meta">
          <span>अपडेट: {when(data.generated_at)}</span>
          <button type="button" className="follow-btn" onClick={load} disabled={refreshing}>
            {refreshing ? 'ताज़ा हो रहा है…' : 'ताज़ा करें'}
          </button>
        </div>
      </div>

      <section className="ops-card">
        <h2>डेटाबेस की जगह</h2>
        {share === null ? (
          <p className="ops-note">यह कंप्यूटर पर चल रहा है ({DATABASE_KINDS[database.kind] || database.kind}); आकार {megabytes(database.size_bytes)}। भरने की सीमा यहाँ लागू नहीं।</p>
        ) : (
          <>
            <div className="ops-gauge-line">
              <strong>{megabytes(database.size_bytes)}</strong>
              <span> / {megabytes(database.limit_bytes)} · {(share * 100).toFixed(1)}%</span>
              <span className={`ops-badge ${gauge.cls}`}>{gauge.text}</span>
            </div>
            <div
              className={`ops-gauge ${gauge.cls}`}
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={Math.round(share * 100)}
              aria-label="डेटाबेस कितना भरा है"
            >
              <span style={{ width: `${Math.min(100, share * 100)}%` }} />
            </div>
            <p className="ops-note">सुपाबेस (Supabase) की मुफ़्त सीमा लगभग 500 एमबी है; तस्वीरें भी इसी में जाती हैं।</p>
            {database.tables.length > 0 && (
              <ul className="ops-tables">
                {database.tables.map((t) => (
                  <li key={t.name}><span>{TABLE_NAMES[t.name] || t.name}</span><span>{megabytes(t.size_bytes)}</span></li>
                ))}
              </ul>
            )}
          </>
        )}
      </section>

      <div className="ops-tiles">
        <Tile label="लेखक / पाठक" value={number(totals.users)} note={`${number(totals.google_users)} गूगल से · इस सप्ताह +${recent.signups_7d}`} />
        <Tile label="प्रकाशित रचनाएँ" value={number(totals.stories)} note={`${number(totals.drafts)} अधूरी · इस सप्ताह +${recent.stories_7d}`} />
        <Tile label="प्रतिक्रियाएँ" value={number(totals.responses)} note={`इस सप्ताह +${recent.responses_7d}`} />
        <Tile label="तालियाँ" value={number(totals.claps)} />
        <Tile label="हाइलाइट" value={number(totals.highlights)} />
        <Tile label="सहेजी गई रचनाएँ" value={number(totals.bookmarks)} note={`${number(totals.follows)} फ़ॉलो`} />
      </div>

      <DailyChart daily={daily} />

      <section className="ops-card">
        <div className="ops-card-head">
          <h2>गड़बड़ियाँ (सर्वर त्रुटि)</h2>
          <span className={`ops-badge ${errors.last_24h ? 'serious' : 'ok'}`}>
            {errors.last_24h ? `24 घंटे में ${errors.last_24h}` : 'पिछले 24 घंटे में कोई नहीं ✓'}
          </span>
        </div>
        <p className="ops-note">7 दिन में कुल: {errors.last_7d}। केवल पता, स्थिति और त्रुटि की पहली पंक्ति रखी जाती है — कोई निजी जानकारी नहीं।</p>
        {errors.latest.length > 0 && (
          <div className="ops-scroll">
            <table>
              <thead><tr><th>कब</th><th>पता</th><th>स्थिति</th><th>त्रुटि</th></tr></thead>
              <tbody>
                {errors.latest.map((row) => (
                  <tr key={row.id}>
                    <td>{when(row.created_at)}</td>
                    <td><code>{row.method} {row.path}</code></td>
                    <td>{row.status}</td>
                    <td>{row.error || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="ops-two">
        <section className="ops-card">
          <h2>नए सदस्य</h2>
          <ul className="ops-list">
            {users.map((u) => (
              <li key={u.id}>
                <Link to={`/user/${u.id}`}>{u.username}</Link>
                <span>{u.provider === 'google' ? 'गूगल' : 'पासवर्ड'} · {u.stories} रचनाएँ · {when(u.created_at)}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="ops-card">
          <h2>सबसे ज़्यादा ताली पाई रचनाएँ</h2>
          {top.length === 0 ? <p className="ops-note">अभी कोई रचना नहीं।</p> : (
            <ul className="ops-list">
              {top.map((post) => (
                <li key={post.id}>
                  <Link to={`/post/${encodeURIComponent(post.slug)}`}>{post.title}</Link>
                  <span>👏 {post.claps}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="ops-card">
        <h2>सर्वर</h2>
        <ul className="ops-list plain">
          <li><span>सर्वर शुरू हुआ</span><span>{when(server.started_at)}</span></li>
          <li><span>तब से चल रहा है</span><span>{uptime(server.uptime_seconds)}</span></li>
          <li><span>संस्करण (commit)</span><span>{server.commit || '—'}</span></li>
          <li><span>डेटाबेस</span><span>{DATABASE_KINDS[database.kind] || database.kind}</span></li>
        </ul>
      </section>
    </div>
  );
};

export default Ops;
