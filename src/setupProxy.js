const { createProxyMiddleware } = require('http-proxy-middleware');

// The app itself talks to the absolute REACT_APP_API_URL, so this proxy only matters when
// that variable is unset (relative /api calls). Point it at the same place either way:
// reading it here means one setting in .env.local moves both, instead of the proxy quietly
// still aiming at :8000 while the app is told to use another port.
const configured = process.env.REACT_APP_API_URL || '';
const local = configured.match(/^https?:\/\/(?:127\.0\.0\.1|localhost):(\d+)/);
const target = local ? `http://127.0.0.1:${local[1]}` : 'http://127.0.0.1:8000';

module.exports = function(app) {
  app.use(
    '/api',
    createProxyMiddleware({
      target,
      changeOrigin: true,
      secure: false,
    })
  );
};
