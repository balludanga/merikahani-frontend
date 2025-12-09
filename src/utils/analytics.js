// Google Analytics removed — provide safe no-op API
// Keep exports so imports across the app do not break.

export const GA_TRACKING_ID = undefined;

export const initGA = () => {
  // intentionally no-op: analytics removed
};

export const pageview = () => {
  // no-op
};

export const event = () => {
  // no-op
};

export const trackEvent = () => {
  // no-op
};