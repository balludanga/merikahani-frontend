import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import Login from './Login';

// Sign-in is by Google only on the live site. The page is rendered the way the production build
// sees it (NODE_ENV "production") and the way local development sees it.

jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: false,
    handleGoogleAccessToken: jest.fn(),
    login: jest.fn(),
    register: jest.fn(),
  }),
}));
jest.mock('../utils/seo', () => ({ updateMetaTags: jest.fn(), resetMetaTags: jest.fn() }));

let host;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  ReactDOM.unmountComponentAtNode(host);
  host.remove();
});

const renderLogin = (nodeEnv, path = '/login') => {
  const previous = process.env.NODE_ENV;
  process.env.NODE_ENV = nodeEnv;
  try {
    act(() => {
      ReactDOM.render(
        <MemoryRouter initialEntries={[path]}>
          <Login />
        </MemoryRouter>,
        host
      );
    });
  } finally {
    process.env.NODE_ENV = previous;
  }
};

describe('the sign-in page on the live site', () => {
  it('offers Google and nothing that takes a password', () => {
    renderLogin('production');
    expect(host.textContent).toContain('गूगल (Google) से जारी रखें');
    expect(host.querySelector('input[type="password"]')).toBeNull();
    expect(host.querySelector('input[type="email"]')).toBeNull();
    expect(host.querySelector('form')).toBeNull();
  });

  it('tells someone with an older email-and-password account how to get back in', () => {
    renderLogin('production', '/register');
    expect(host.textContent).toContain('पहले ईमेल और पासवर्ड से खाता बनाया था');
    expect(host.textContent).toContain('उसी ईमेल वाले गूगल (Google) खाते से साइन इन कीजिए');
  });

  it('is the same one page for "start" and "sign in"', () => {
    renderLogin('production', '/register');
    expect(host.querySelector('button.auth-google')).not.toBeNull();
    expect(host.querySelector('form')).toBeNull();
  });
});

describe('the sign-in page in local development', () => {
  it('keeps the email form so the app can be used without a Google setup', () => {
    renderLogin('development');
    expect(host.querySelector('input[type="password"]')).not.toBeNull();
    expect(host.textContent).toContain('केवल विकास के लिए');
  });
});
