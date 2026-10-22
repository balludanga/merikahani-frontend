import React, { useEffect, useState } from 'react';
import './SlowServerNotice.css';

// Shown while the free-tier server is waking up (requests pending > 6s).
const SlowServerNotice = () => {
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    const onSlow = () => setSlow(true);
    const onReady = () => setSlow(false);
    window.addEventListener('lekhani:slow-server', onSlow);
    window.addEventListener('lekhani:server-ready', onReady);
    return () => {
      window.removeEventListener('lekhani:slow-server', onSlow);
      window.removeEventListener('lekhani:server-ready', onReady);
    };
  }, []);

  if (!slow) return null;
  return (
    <div className="slow-server-notice" role="status">
      सर्वर जाग रहा है, कृपया लगभग एक मिनट रुकें…
    </div>
  );
};

export default SlowServerNotice;
