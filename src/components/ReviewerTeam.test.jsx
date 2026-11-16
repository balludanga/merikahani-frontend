import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import ReviewerTeam from './ReviewerTeam';
import { teamAPI } from '../services/api';

jest.mock('../services/api', () => ({ teamAPI: { list: jest.fn(), add: jest.fn(), remove: jest.fn() } }));

const OWNER = { id: null, email: 'malik@example.com', role: 'owner', source: 'settings', name: 'मालिक जी', signed_in: true, added_at: null };
const FIXED = { id: null, email: 'tay@example.com', role: 'reviewer', source: 'settings', name: null, signed_in: false, added_at: null };
const ADDED = { id: 5, email: 'naya@example.com', role: 'reviewer', source: 'added', name: null, signed_in: false, added_at: '2026-11-16T10:00:00' };

let host;

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  teamAPI.list.mockReset().mockResolvedValue({ data: { members: [OWNER, FIXED, ADDED] } });
  teamAPI.add.mockReset();
  teamAPI.remove.mockReset().mockResolvedValue({});
});

afterEach(() => {
  ReactDOM.unmountComponentAtNode(host);
  host.remove();
});

const mount = async () => {
  await act(async () => {
    ReactDOM.render(<ReviewerTeam />, host);
  });
};
const button = (label) => Array.from(host.querySelectorAll('button')).find((b) => b.textContent.includes(label));
const click = async (label) => {
  await act(async () => {
    button(label).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
const typeEmail = (value) => {
  const input = host.querySelector('input[type="email"]');
  const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
  act(() => {
    setter.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};
const submit = async () => {
  await act(async () => {
    host.querySelector('form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  });
};

describe('the review team tab', () => {
  it('lists the owner, the reviewers fixed in the settings and the ones added here, with where each stands', async () => {
    await mount();
    const text = host.textContent;
    expect(text).toContain('malik@example.com');
    expect(text).toContain('मालिक जी');
    expect(text).toContain('tay@example.com');
    expect(text).toContain('सेटिंग में तय (यहाँ से नहीं हटता)');
    expect(text).toContain('naya@example.com');
    expect(text).toContain('अभी साइन इन नहीं किया');
  });

  it('offers "remove" only for a reviewer added here', async () => {
    await mount();
    expect(host.querySelectorAll('button').length).toBeGreaterThan(0);
    expect(Array.from(host.querySelectorAll('button')).filter((b) => b.textContent.includes('हटाएँ…'))).toHaveLength(1);
  });

  it('adds an address, shows the new list and reminds the owner to tell the person', async () => {
    teamAPI.add.mockResolvedValue({ data: { members: [OWNER, FIXED, ADDED, { ...ADDED, id: 6, email: 'doosra@example.com' }] } });
    await mount();
    expect(button('समीक्षक जोड़ें').disabled).toBe(true);
    typeEmail(' doosra@example.com ');
    await submit();
    expect(teamAPI.add).toHaveBeenCalledWith('doosra@example.com');
    expect(host.textContent).toContain('doosra@example.com');
    expect(host.textContent).toContain('उन्हें खुद बता दीजिए');
    expect(host.querySelector('input[type="email"]').value).toBe('');
  });

  it('shows the server\'s reason when an address cannot be added', async () => {
    teamAPI.add.mockRejectedValue({ response: { status: 409, data: { detail: 'यह पता पहले से टीम में है' } } });
    await mount();
    typeEmail('naya@example.com');
    await submit();
    expect(host.querySelector('[role="alert"]').textContent).toContain('पहले से टीम में है');
  });

  it('asks before removing, and removes only after the second tap', async () => {
    await mount();
    await click('हटाएँ…');
    expect(teamAPI.remove).not.toHaveBeenCalled();
    await click('रहने दें');
    expect(button('हाँ, हटाएँ')).toBeUndefined();
    await click('हटाएँ…');
    await click('हाँ, हटाएँ');
    expect(teamAPI.remove).toHaveBeenCalledWith(5);
    expect(teamAPI.list).toHaveBeenCalledTimes(2); // loaded again after the removal
    expect(host.textContent).toContain('हटा दिया गया');
  });
});
