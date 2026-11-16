import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { MemoryRouter } from 'react-router-dom';
import SessionNotice from './SessionNotice';
import { ACCOUNT_DELETED_FLAG } from '../utils/session';

let host;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  sessionStorage.clear();
});

afterEach(() => {
  ReactDOM.unmountComponentAtNode(host);
  host.remove();
});

const render = () =>
  act(() => {
    ReactDOM.render(
      <MemoryRouter>
        <SessionNotice />
      </MemoryRouter>,
      host
    );
  });

describe('the notice bar', () => {
  it('says nothing on an ordinary visit', () => {
    render();
    expect(host.textContent).toBe('');
  });

  it('tells a person their account is gone after deleting it, once', () => {
    sessionStorage.setItem(ACCOUNT_DELETED_FLAG, '1');
    render();
    expect(host.textContent).toContain('आपका खाता हटा दिया गया है');
    expect(sessionStorage.getItem(ACCOUNT_DELETED_FLAG)).toBeNull();
  });

  it('still announces a sign-in that ran out', () => {
    render();
    act(() => {
      window.dispatchEvent(new CustomEvent('lekhani:signed-out'));
    });
    expect(host.textContent).toContain('साइन-इन अवधि समाप्त');
  });
});
