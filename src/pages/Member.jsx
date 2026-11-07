import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { membershipAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import CheckoutDialog from '../components/CheckoutDialog';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import { formatDate } from '../utils/format';
import { apiMessage, formatRupees } from '../utils/partner';
import { PLAN_NAMES, planLength, usePaymentsConfig } from '../utils/payments';
import './Earn.css';
import './Member.css';

const Perks = ({ rules }) => (
  <section className="earn-card" aria-labelledby="member-perks">
    <h2 id="member-perks">सदस्य बनने पर</h2>
    <ul className="member-perks">
      <li>
        <strong>लेखनी को सहारा।</strong> आपकी सदस्यता साइट को चलाए रखती है और हिंदी में लिखने वालों के लिए जगह बनाए रखती है।
      </li>
      <li>
        <strong>आपकी प्रोफ़ाइल पर “लेखनी सदस्य” का चिह्न।</strong> चाहें तो उसे छिपा सकते हैं।
      </li>
      {rules.weighted_points && (
        <li>
          <strong>आपकी प्रतिक्रियाएँ ज़्यादा गिनी जाती हैं।</strong> सदस्य की ताली, हाइलाइट और प्रतिक्रिया साझेदार लेखकों के मासिक हिस्से में
          ज़्यादा अंक देती है — यानी जिन्हें आप पढ़ते हैं, उन्हें सीधा सहारा मिलता है।
        </li>
      )}
      <li>
        <strong>कुछ भी बंद नहीं होता।</strong> सदस्यता सहयोग है; कोई रचना पैसे के पीछे छिपाई नहीं गई है।
      </li>
    </ul>
  </section>
);

const Plan = ({ plan, onChoose, busy, renewing }) => (
  <li className="member-plan">
    <h3>{PLAN_NAMES[plan.code] || plan.code}</h3>
    <p className="member-price">{formatRupees(plan.price_paise)}</p>
    <p className="member-length">{planLength(plan.months)} के लिए</p>
    <button type="button" className="earn-btn primary" onClick={() => onChoose(plan.code)} disabled={busy}>
      {renewing ? 'अवधि बढ़ाएँ' : 'सदस्य बनें'}
    </button>
  </li>
);

const Member = () => {
  const { isAuthenticated, loading: authLoading } = useAuth();
  const config = usePaymentsConfig();
  const [state, setState] = useState(null);
  const [failed, setFailed] = useState(false);
  const [autoRenew, setAutoRenew] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState('');
  const [notice, setNotice] = useState('');
  const [started, setStarted] = useState(null);
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    updateMetaTags({ title: 'सदस्यता', description: 'लेखनी की सदस्यता लें और हिंदी के लेखकों को सहारा दें।', type: 'website', noindex: true });
    return () => resetMetaTags();
  }, []);

  const load = useCallback(async () => {
    if (!isAuthenticated) return;
    setFailed(false);
    try {
      setState((await membershipAPI.me()).data);
    } catch (error) {
      setFailed(true);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!authLoading) load();
  }, [authLoading, load]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(''), 4000);
    return () => clearTimeout(timer);
  }, [notice]);

  const choose = async (plan) => {
    setBusy(true);
    setProblem('');
    try {
      setStarted({ ...(await membershipAPI.checkout(plan, autoRenew && !alreadyRenews)).data, plan });
    } catch (error) {
      setProblem(apiMessage(error, 'सदस्यता शुरू नहीं हो सकी। थोड़ी देर में फिर कोशिश करें।'));
    } finally {
      setBusy(false);
    }
  };

  const run = async (action, done, fallback) => {
    setBusy(true);
    setProblem('');
    try {
      setState((await action()).data);
      setConfirmCancel(false);
      if (done) setNotice(done);
    } catch (error) {
      setProblem(apiMessage(error, fallback));
    } finally {
      setBusy(false);
    }
  };

  const hero = (
    <header className="earn-hero">
      <span className="earn-kicker">सदस्यता</span>
      <h1>लेखनी के साथ खड़े हों</h1>
      <p>
        लेखनी हिंदी के लेखकों और पाठकों का अपना मंच है। सदस्यता इसे बिना विज्ञापनों के चलाए रखने का तरीका है — और आपकी पढ़ाई सीधे
        लेखकों तक पहुँचती है।
      </p>
    </header>
  );

  if (authLoading || config === null) return <div className="page-loading" role="status">लोड हो रहा है…</div>;

  if (!config.enabled || !config.membership) {
    return (
      <div className="earn-page">
        {hero}
        <section className="earn-card">
          <h2>सदस्यता अभी शुरू नहीं हुई है</h2>
          <p className="earn-lead">जैसे ही यह शुरू होगी, यहीं बता दिया जाएगा।</p>
        </section>
      </div>
    );
  }

  const rules = config.membership;
  const isMember = !!(state && state.is_member);
  // Already renewing on its own: more time can still be bought, but not a second subscription.
  const alreadyRenews = !!(state && state.auto_renew);

  return (
    <div className="earn-page">
      {hero}
      <div className="earn-live-region" aria-live="polite">{notice && <p className="earn-ok">{notice}</p>}</div>
      {problem && <p className="earn-problem" role="alert">{problem}</p>}
      {config.test_mode && (
        <p className="earn-note">यह जाँच का रूप है: कोई असली पैसा नहीं कटता।</p>
      )}

      {isAuthenticated && failed && (
        <p className="empty-state">
          आपकी सदस्यता का ब्योरा लोड नहीं हो सका। <button type="button" onClick={load}>फिर कोशिश करें</button>
        </p>
      )}

      {isMember && (
        <section className="earn-card earn-welcome" aria-labelledby="member-now">
          <h2 id="member-now">आप लेखनी के सदस्य हैं ✓</h2>
          <p className="earn-lead">
            {state.paid_until ? `${formatDate(state.paid_until)} तक की अवधि चुकाई जा चुकी है।` : ''}{' '}
            {state.auto_renew
              ? 'यह अपने-आप आगे बढ़ती रहेगी; आप कभी भी इसे रोक सकते हैं।'
              : 'यह अपने-आप आगे नहीं बढ़ेगी — अवधि पूरी होने पर सदस्यता रुक जाएगी।'}
          </p>
          <label className="earn-check">
            <input
              type="checkbox"
              checked={state.show_badge}
              disabled={busy}
              onChange={(e) => run(() => membershipAPI.setBadge(e.target.checked), null, 'चिह्न बदला नहीं जा सका। फिर कोशिश करें।')}
            />
            <span>मेरी प्रोफ़ाइल पर “लेखनी सदस्य” का चिह्न दिखाएँ</span>
          </label>
          {state.auto_renew &&
            (confirmCancel ? (
              <div className="earn-actions">
                <span>नवीनीकरण रोकें? चुकाई हुई अवधि पूरी चलेगी।</span>
                <button type="button" className="earn-btn danger" disabled={busy} onClick={() => run(() => membershipAPI.cancel(), 'नवीनीकरण रोक दिया गया', 'रद्द नहीं हो सका। फिर कोशिश करें।')}>
                  हाँ, रोकें
                </button>
                <button type="button" className="earn-btn" onClick={() => setConfirmCancel(false)}>रहने दें</button>
              </div>
            ) : (
              <button type="button" className="earn-btn" onClick={() => setConfirmCancel(true)}>नवीनीकरण रोकें</button>
            ))}
        </section>
      )}

      <section className="earn-card" aria-labelledby="member-plans">
        <h2 id="member-plans">{isMember ? 'अवधि बढ़ाएँ' : 'योजनाएँ'}</h2>
        {isAuthenticated ? (
          <>
            <ul className="member-plans">
              {rules.plans.map((plan) => (
                <Plan key={plan.code} plan={plan} onChoose={choose} busy={busy} renewing={isMember} />
              ))}
            </ul>
            <label className="earn-check">
              <input
                type="checkbox"
                checked={autoRenew && !alreadyRenews}
                disabled={alreadyRenews}
                onChange={(e) => setAutoRenew(e.target.checked)}
              />
              <span>
                {alreadyRenews
                  ? 'आपकी सदस्यता पहले से अपने-आप आगे बढ़ रही है — यहाँ से बस अतिरिक्त अवधि जुड़ेगी'
                  : 'अवधि पूरी होने पर अपने-आप आगे बढ़ाएँ (कभी भी रोका जा सकता है)'}
              </span>
            </label>
          </>
        ) : (
          <>
            <ul className="member-plans">
              {rules.plans.map((plan) => (
                <li key={plan.code} className="member-plan">
                  <h3>{PLAN_NAMES[plan.code] || plan.code}</h3>
                  <p className="member-price">{formatRupees(plan.price_paise)}</p>
                  <p className="member-length">{planLength(plan.months)} के लिए</p>
                </li>
              ))}
            </ul>
            <Link to="/login?redirect=%2Fmember" className="earn-btn primary">साइन इन करके सदस्य बनें</Link>
          </>
        )}
        {rules.gst_included && <p className="earn-note">कीमत में जीएसटी (GST) शामिल है।</p>}
      </section>

      <Perks rules={rules} />

      {started && (
        <CheckoutDialog
          started={started}
          title="लेखनी की सदस्यता"
          summary={PLAN_NAMES[started.plan] ? `${PLAN_NAMES[started.plan]} योजना` : undefined}
          onSettled={load}
          onClose={() => {
            setStarted(null);
            load();
          }}
        />
      )}
    </div>
  );
};

export default Member;
