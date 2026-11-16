import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import DeleteAccount from './DeleteAccount';
import { usersAPI } from '../services/api';
import { ACCOUNT_DELETED_FLAG } from '../utils/session';

const mockLogout = jest.fn();

jest.mock('../services/api', () => ({ usersAPI: { deleteAccount: jest.fn() } }));
jest.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { id: 7, username: 'lekhak_7' }, logout: mockLogout }),
}));

let host;
const realLocation = window.location;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  delete window.location;
  window.location = { assign: jest.fn() };
  usersAPI.deleteAccount.mockReset();
  mockLogout.mockReset();
  sessionStorage.clear();
  act(() => {
    ReactDOM.render(<DeleteAccount />, host);
  });
});

afterEach(() => {
  ReactDOM.unmountComponentAtNode(host);
  host.remove();
  window.location = realLocation;
});

const button = (label) => Array.from(host.querySelectorAll('button')).find((b) => b.textContent.includes(label));
const click = async (label) => {
  await act(async () => {
    button(label).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
const type = (value) => {
  const input = host.querySelector('input');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

describe('deleting the account', () => {
  it('explains what goes before asking for anything', () => {
    expect(host.textContent).toContain('खाता हटाएँ');
    expect(host.textContent).toContain('यह वापस नहीं हो सकता');
    expect(host.querySelector('input')).toBeNull();
    expect(usersAPI.deleteAccount).not.toHaveBeenCalled();
  });

  it('keeps the final button off until the username is typed exactly', async () => {
    await click('प्रक्रिया शुरू करें');
    expect(host.textContent).toContain('lekhak_7');
    expect(button('हमेशा के लिए हटाएँ').disabled).toBe(true);
    type('lekhak_');
    expect(button('हमेशा के लिए हटाएँ').disabled).toBe(true);
    type('lekhak_7');
    expect(button('हमेशा के लिए हटाएँ').disabled).toBe(false);
  });

  it('"रहने दें" closes it again without deleting anything', async () => {
    await click('प्रक्रिया शुरू करें');
    type('lekhak_7');
    await click('रहने दें');
    expect(host.querySelector('input')).toBeNull();
    expect(usersAPI.deleteAccount).not.toHaveBeenCalled();
  });

  it('deletes, signs out here, leaves a note for the next page and reloads the site', async () => {
    usersAPI.deleteAccount.mockResolvedValue({});
    await click('प्रक्रिया शुरू करें');
    type('lekhak_7');
    await click('हमेशा के लिए हटाएँ');
    expect(usersAPI.deleteAccount).toHaveBeenCalledWith('lekhak_7');
    expect(mockLogout).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem(ACCOUNT_DELETED_FLAG)).toBe('1');
    expect(window.location.assign).toHaveBeenCalledWith('/');
  });

  it('shows the reason when the server refuses, and the person stays signed in', async () => {
    usersAPI.deleteAccount.mockRejectedValue({
      response: { status: 409, data: { detail: 'आपका कुछ पैसा बकाया है।' } },
    });
    await click('प्रक्रिया शुरू करें');
    type('lekhak_7');
    await click('हमेशा के लिए हटाएँ');
    expect(host.querySelector('[role="alert"]').textContent).toContain('बकाया');
    expect(mockLogout).not.toHaveBeenCalled();
    expect(window.location.assign).not.toHaveBeenCalled();
    expect(button('हमेशा के लिए हटाएँ').disabled).toBe(false); // can try again
  });
});
