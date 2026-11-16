import React, { useEffect } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PartnerApplications from '../components/PartnerApplications';
import PartnerMonths from '../components/PartnerMonths';
import PartnerPayouts from '../components/PartnerPayouts';
import ProfitSheet from '../components/ProfitSheet';
import OwnerPayments from '../components/OwnerPayments';
import ReviewerTeam from '../components/ReviewerTeam';
import { updateMetaTags, resetMetaTags } from '../utils/seo';
import '../components/Review.css';
import './Earn.css';
import './PartnerDesk.css';

// Every reviewer sees these. (The months tab is read-only for a reviewer: only the owner sets a pool
// or finalizes a month.)
const TABS = [
  ['applications', 'आवेदन'],
  ['months', 'मासिक कोष'],
];

// Only the owner sees these, and the server refuses everyone else too.
const OWNER_TABS = [
  ['payouts', 'भुगतान'],
  ['profit', 'लाभ-हानि'],
  ['online', 'ऑनलाइन भुगतान'],
  ['team', 'समीक्षक टीम'],
];

/** The review team's desk for write and earn: who applied, each month's pool, who is owed what. */
const PartnerDesk = () => {
  const { user, loading: authLoading } = useAuth();
  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const isReviewer = !!(user && user.is_admin);
  const tabs = user && user.is_owner ? [...TABS, ...OWNER_TABS] : TABS;
  const tab = tabs.some(([key]) => key === requested) ? requested : 'applications';

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
        {user.is_owner
          ? '“लिखें और कमाएँ” के आवेदन पढ़कर निर्णय लें, हर महीने का कोष तय करके हिसाब पक्का करें, और जो भुगतान आपने भेज दिया है उसे दर्ज करें।'
          : '“लिखें और कमाएँ” के आवेदन पढ़कर निर्णय लें और हर महीने का हिसाब देखें। कोष तय करना, हिसाब पक्का करना और भुगतान दर्ज करना केवल मालिक का काम है।'}
      </p>

      <div className="review-tabs" role="tablist" aria-label="साझेदार लेखकों का काम">
        {tabs.map(([key, label]) => (
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
      {tab === 'profit' && <ProfitSheet />}
      {tab === 'online' && <OwnerPayments />}
      {tab === 'team' && <ReviewerTeam />}
    </div>
  );
};

export default PartnerDesk;
