import React, { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PartnerApplications from '../components/PartnerApplications';
import PartnerMonths from '../components/PartnerMonths';
import PartnerPayouts from '../components/PartnerPayouts';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import '../components/Review.css';
import './Earn.css';
import './PartnerDesk.css';

const TABS = [
  ['applications', 'आवेदन'],
  ['months', 'मासिक कोष'],
  ['payouts', 'भुगतान'],
];

/** The review team's desk for write and earn: who applied, each month's pool, who is owed what. */
const PartnerDesk = () => {
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab = TABS.some(([key]) => key === requested) ? requested : 'applications';
  const isReviewer = !!(user && user.is_admin);

  useEffect(() => {
    updateMetaTags({ title: 'साझेदार लेखक', type: 'website', noindex: true });
    return () => resetMetaTags();
  }, []);

  if (authLoading) return <div className="page-loading">लोड हो रहा है…</div>;
  if (!isReviewer) return <Navigate to="/" replace />;

  return (
    <div className="review-page">
      <h1>साझेदार लेखक</h1>
      <p className="review-hint">
        “लिखें और कमाएँ” के आवेदन पढ़कर निर्णय लें, हर महीने का कोष तय करके हिसाब पक्का करें, और जो भुगतान आपने भेज
        दिया है उसे दर्ज करें।
      </p>

      <div className="review-tabs" role="tablist" aria-label="साझेदार लेखकों का काम">
        {TABS.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            className={`review-tab ${tab === key ? 'on' : ''}`}
            onClick={() => setParams(key === 'applications' ? {} : { tab: key }, { replace: true })}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'applications' && <PartnerApplications />}
      {tab === 'months' && <PartnerMonths />}
      {tab === 'payouts' && <PartnerPayouts />}
    </div>
  );
};

export default PartnerDesk;
