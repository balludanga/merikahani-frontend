import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { paymentsAPI } from '../services/api';
import { usePaymentsConfig } from '../utils/payments';
import TipDialog from './TipDialog';
import './Pay.css';

/**
 * "Send support" beside a writer's name. It draws nothing at all unless payments are switched on, the writer is
 * a partner who accepts tips, and the viewer is not that writer: so with no provider connected it is invisible.
 */
const TipButton = ({ writerId, writerName, post, className = 'tip-btn' }) => {
  const config = usePaymentsConfig();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [available, setAvailable] = useState(false);
  const [open, setOpen] = useState(false);
  const isSelf = !!(user && user.id === writerId);
  const on = !!(config && config.enabled && config.tips);

  useEffect(() => {
    if (!on || isSelf || !writerId) {
      setAvailable(false);
      return undefined;
    }
    let live = true;
    paymentsAPI
      .tipTarget(writerId)
      .then((response) => live && setAvailable(!!response.data.available))
      .catch(() => live && setAvailable(false));
    return () => {
      live = false;
    };
  }, [on, isSelf, writerId]);

  if (!on || !available) return null;

  const press = () => {
    if (!isAuthenticated) {
      navigate(`/login?redirect=${encodeURIComponent(location.pathname)}`);
      return;
    }
    setOpen(true);
  };

  return (
    <>
      <button type="button" className={className} onClick={press} aria-haspopup="dialog">
        ♡ समर्थन करें
      </button>
      {open && (
        <TipDialog
          writerId={writerId}
          writerName={writerName}
          post={post}
          tips={config.tips}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
};

export default TipButton;
