import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { partnerAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import HindiTextarea, { useHinglish } from '../components/HindiTextarea';
import EarnPanel from '../components/EarnPanel';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import { formatDate, timeAgo } from '../utils/format';
import { apiMessage, daysUntil, formatRupees, progressPercent, weightsSentence } from '../utils/partner';
import { feePercent, usePaymentsConfig } from '../utils/payments';
import './Earn.css';

const Requirement = ({ label, have, need, met }) => (
  <li className={`earn-req ${met ? 'met' : ''}`}>
    <div className="earn-req-top">
      <span className="earn-req-mark" aria-hidden="true">{met ? '✓' : '○'}</span>
      <span className="earn-req-label">{label}</span>
      <span className="earn-req-count">{Math.min(have, need)} / {need}{met ? ' · पूरी' : ''}</span>
    </div>
    <div
      className="earn-bar"
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={need}
      aria-valuenow={Math.min(have, need)}
    >
      <span style={{ width: `${progressPercent(have, need)}%` }} />
    </div>
  </li>
);

const Requirements = ({ status }) => (
  <section className="earn-card" aria-labelledby="earn-req">
    <h2 id="earn-req">आवेदन की शर्तें</h2>
    <ul className="earn-reqs">
      <Requirement label={`${status.followers.need} फ़ॉलोअर्स`} {...status.followers} />
      <Requirement label={`कम से कम ${status.stories.need} प्रकाशित रचना`} {...status.stories} />
    </ul>
    <p className="earn-note">
      शर्तें पूरी होने पर आवेदन खुल जाता है। फिर समीक्षा टीम आपकी प्रोफ़ाइल और रचनाएँ पढ़कर निर्णय लेती है —
      सिर्फ़ गिनती से स्वीकृति नहीं मिलती।
    </p>
  </section>
);

const HowItWorks = ({ rules, payments }) => {
  const weights = weightsSentence(rules);
  const tips = payments && payments.enabled ? payments.tips : null;
  return (
    <section className="earn-card" aria-labelledby="earn-how">
      <h2 id="earn-how">यह कैसे काम करता है</h2>
      <ol className="earn-how">
        <li>
          हर महीने लेखनी एक कोष तय करती है। उसे साझेदार लेखकों में उनके अंकों के अनुपात में बाँटा जाता है — जिसके अंक
          ज़्यादा, उसका हिस्सा ज़्यादा।
        </li>
        <li>
          अंक पाठकों के जुड़ाव से बनते हैं: किसी पाठक की किसी रचना पर पहली ताली {rules.clap_points} अंक; हर हाइलाइट{' '}
          {rules.highlight_points} अंक (एक पाठक से एक रचना पर महीने में अधिकतम {rules.max_highlights}); हर प्रतिक्रिया या
          जवाब {rules.response_points} अंक (अधिकतम {rules.max_responses})।
        </li>
        <li>
          केवल असली जुड़ाव गिना जाता है: आपकी अपनी ताली, हाइलाइट और जवाब नहीं, और उन पाठकों के नहीं जिनका खाता{' '}
          {rules.reader_min_age_days} दिन से कम पुराना हो। साझेदार बनने से पहले का और अप्रकाशित रचनाओं का जुड़ाव भी
          नहीं गिना जाता।
        </li>
        <li>
          महीना बीतने पर समीक्षा टीम हिसाब पक्का करती है। बकाया राशि {formatRupees(rules.min_payout_paise)} या उससे ज़्यादा
          हो तो यूपीआई (UPI) से भेजी जाती है; कम हो तो अगले महीने में जुड़ जाती है।
        </li>
        <li>
          कोष की राशि हर महीने अलग हो सकती है, और किसी महीने शून्य भी — इसलिए कमाई का कोई तय वादा नहीं है। नकली खातों से
          जुड़ाव मिलने पर साझेदारी रोकी जा सकती है।
        </li>
        {weights && <li>{weights}</li>}
        {tips && (
          <li>
            पाठक आपकी रचनाओं पर सीधे समर्थन भी भेज सकते हैं। लेखनी हर समर्थन का {feePercent(tips.site_fee_bps)} रखती है (भुगतान के
            खर्च और साइट चलाने के लिए); बाकी आपकी बकाया राशि में जुड़ जाता है। समर्थन लेना आप कभी भी बंद कर सकते हैं।
          </li>
        )}
        <li>फ़ॉलोअर्स की शर्त केवल आवेदन के समय देखी जाती है।</li>
      </ol>
    </section>
  );
};

const ApplyForm = ({ lead, busy, onSubmit }) => {
  const [note, setNote] = useState('');
  const [agree, setAgree] = useState(false);
  const [hinglish, toggleHinglish, finish] = useHinglish();

  return (
    <form
      className="earn-form"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit(finish(note).trim());
      }}
    >
      <p className="earn-lead">{lead}</p>
      <label htmlFor="earn-note">समीक्षा टीम के लिए दो पंक्तियाँ (वैकल्पिक)</label>
      <HindiTextarea
        id="earn-note"
        className="earn-note-box"
        value={note}
        onChange={setNote}
        hinglish={hinglish}
        onToggle={toggleHinglish}
        maxLength={1000}
        rows={4}
        placeholder="आप क्या लिखते हैं, और आपकी कौन-सी रचनाएँ हमें ज़रूर पढ़नी चाहिए?"
      />
      <label className="earn-check">
        <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
        <span>
          मैं सहमत हूँ कि मेरी रचनाएँ मेरी अपनी हैं, और ऊपर बताए गए नियम मुझे मान्य हैं। मैं जानता/जानती हूँ कि कमाई
          का कोई तय वादा नहीं है।
        </span>
      </label>
      <button type="submit" className="earn-btn primary" disabled={!agree || busy}>
        {busy ? 'भेज रहे हैं…' : 'आवेदन भेजें'}
      </button>
    </form>
  );
};

const Earn = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const [status, setStatus] = useState(null); // null = loading
  const [rules, setRules] = useState(null);
  const [earnings, setEarnings] = useState(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [confirmWithdraw, setConfirmWithdraw] = useState(false);
  const payments = usePaymentsConfig();

  useEffect(() => {
    updateMetaTags({
      title: 'लिखें और कमाएँ',
      description: 'लेखनी के साझेदार लेखक बनें और पाठकों के जुड़ाव से कमाएँ।',
      type: 'website',
      noindex: true,
    });
    return () => resetMetaTags();
  }, []);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      if (!isAuthenticated) {
        setRules((await partnerAPI.rules()).data);
        return;
      }
      const me = (await partnerAPI.me()).data;
      setStatus(me);
      setRules(me.rules);
      if (me.application && me.application.approved_at) {
        try {
          setEarnings((await partnerAPI.earnings()).data);
        } catch (error) {
          setEarnings(null);
        }
      } else {
        setEarnings(null);
      }
    } catch (error) {
      setFailed(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (authLoading) return;
    load();
  }, [authLoading, load]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const run = async (action, done, fallback) => {
    setBusy(true);
    setProblem('');
    try {
      const response = await action();
      setStatus(response.data);
      setConfirmWithdraw(false);
      if (done) setNotice(done);
    } catch (error) {
      setProblem(apiMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  };

  const submit = (note) =>
    run(() => partnerAPI.apply(note), 'आवेदन भेज दिया गया ✓', 'आवेदन नहीं भेजा जा सका। थोड़ी देर में फिर कोशिश करें।');
  const withdraw = () =>
    run(() => partnerAPI.withdraw(), 'आवेदन वापस ले लिया गया', 'आवेदन वापस नहीं लिया जा सका। थोड़ी देर में फिर कोशिश करें।');

  const hero = (
    <header className="earn-hero">
      <span className="earn-kicker">साझेदार कार्यक्रम</span>
      <h1>लिखें और कमाएँ</h1>
      <p>
        जब पाठक आपकी रचनाओं से जुड़ते हैं — ताली देते हैं, अंश हाइलाइट करते हैं, प्रतिक्रिया लिखते हैं — तो हर महीने के
        कोष में से आपको हिस्सा मिलता है।
      </p>
    </header>
  );

  if (authLoading) return <div className="page-loading" role="status">लोड हो रहा है…</div>;

  if (!isAuthenticated) {
    return (
      <div className="earn-page">
        {hero}
        {rules && (
          <section className="earn-card" aria-labelledby="earn-who">
            <h2 id="earn-who">कौन आवेदन कर सकता है</h2>
            <p className="earn-lead">
              जिनके कम से कम {rules.min_followers} फ़ॉलोअर्स हों और जिन्होंने कम से कम {rules.min_stories} रचना प्रकाशित की
              हो। आवेदन देखने और भेजने के लिए साइन इन करें।
            </p>
            <Link to="/login?redirect=%2Fearn" className="earn-btn primary">साइन इन करें</Link>
          </section>
        )}
        {rules && <HowItWorks rules={rules} payments={payments} />}
      </div>
    );
  }

  if (failed) {
    return (
      <div className="earn-page">
        {hero}
        <p className="empty-state">
          जानकारी लोड नहीं हो सकी। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      </div>
    );
  }

  if (!status) return <div className="page-loading" role="status">लोड हो रहा है…</div>;

  const { application } = status;
  const state = status.status;
  const wasPartner = !!(application && application.approved_at);
  const waitDays = status.reapply_on ? daysUntil(status.reapply_on) : 0;
  // The checklist is for a writer who has not applied, or whose wait after a decline is over.
  const showRequirements = state === 'none' || state === 'withdrawn' || (state === 'declined' && waitDays === 0);

  return (
    <div className="earn-page">
      {hero}
      <div className="earn-live-region" aria-live="polite">
        {notice && <p className="earn-ok">{notice}</p>}
      </div>
      {problem && <p className="earn-problem" role="alert">{problem}</p>}

      {state === 'approved' && (
        <section className="earn-card earn-welcome">
          <h2>आप साझेदार लेखक हैं ✓</h2>
          <p className="earn-lead">
            {application.approved_at ? `${formatDate(application.approved_at)} से` : ''} आपकी प्रकाशित रचनाओं पर मिला
            पाठकों का जुड़ाव हर महीने के कोष में गिना जा रहा है।
          </p>
        </section>
      )}

      {state === 'pending' && (
        <section className="earn-card" aria-labelledby="earn-pending">
          <h2 id="earn-pending">आपका आवेदन समीक्षा में है</h2>
          <p className="earn-lead">
            भेजा गया: {formatDate(application.applied_at)} ({timeAgo(application.applied_at)})। समीक्षा टीम आपकी प्रोफ़ाइल और
            रचनाएँ पढ़ रही है; निर्णय आते ही घंटी (सूचनाएँ) में बता दिया जाएगा।
          </p>
          {application.note && <blockquote className="earn-quote">{application.note}</blockquote>}
          {confirmWithdraw ? (
            <div className="earn-actions">
              <span>आवेदन वापस लें?</span>
              <button type="button" className="earn-btn danger" onClick={withdraw} disabled={busy}>हाँ, वापस लें</button>
              <button type="button" className="earn-btn" onClick={() => setConfirmWithdraw(false)}>रहने दें</button>
            </div>
          ) : (
            <button type="button" className="earn-btn" onClick={() => setConfirmWithdraw(true)}>आवेदन वापस लें</button>
          )}
        </section>
      )}

      {state === 'declined' && (
        <section className="earn-card" aria-labelledby="earn-declined">
          <h2 id="earn-declined">इस बार आवेदन स्वीकृत नहीं हो सका</h2>
          {application.decision_note && (
            <>
              <p className="earn-lead">समीक्षा टीम ने लिखा:</p>
              <blockquote className="earn-quote">{application.decision_note}</blockquote>
            </>
          )}
          {!status.can_apply && waitDays > 0 && (
            <p className="earn-note">आप {waitDays} दिन बाद फिर आवेदन कर सकते हैं। तब तक लिखते रहें — अच्छी रचनाएँ ही सबसे अच्छा आवेदन हैं।</p>
          )}
        </section>
      )}

      {state === 'revoked' && (
        <section className="earn-card" aria-labelledby="earn-revoked">
          <h2 id="earn-revoked">आपकी साझेदारी फ़िलहाल रोकी गई है</h2>
          {application.decision_note && (
            <>
              <p className="earn-lead">समीक्षा टीम ने लिखा:</p>
              <blockquote className="earn-quote">{application.decision_note}</blockquote>
            </>
          )}
          <p className="earn-note">अब तक पक्की हो चुकी कमाई और भुगतान का हिसाब नीचे देखा जा सकता है।</p>
        </section>
      )}

      {showRequirements && <Requirements status={status} />}

      {status.can_apply && (
        <section className="earn-card" aria-labelledby="earn-apply">
          <h2 id="earn-apply">आवेदन करें</h2>
          <ApplyForm
            busy={busy}
            onSubmit={submit}
            lead={
              state === 'declined'
                ? 'आप फिर से आवेदन कर सकते हैं। पिछली बार का कारण ऊपर है — उसे ध्यान में रखकर अपनी बात लिखें।'
                : 'आपकी सभी शर्तें पूरी हैं। आप आवेदन कर सकते हैं।'
            }
          />
        </section>
      )}

      {wasPartner && earnings && <EarnPanel status={status} earnings={earnings} onStatus={setStatus} payments={payments} />}
      {wasPartner && !earnings && (
        <p className="empty-state">
          कमाई का हिसाब लोड नहीं हो सका। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      )}

      {rules && <HowItWorks rules={rules} payments={payments} />}
    </div>
  );
};

export default Earn;
