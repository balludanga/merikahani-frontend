import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { pageview } from './analytics';

export const usePageTracking = () => {
  const location = useLocation();

  useEffect(() => {
    // Track page view on route change
    pageview(location.pathname + location.search);
  }, [location]);
};