import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { paymentsAPI } from '../services/api';
import { launchers } from '../utils/checkoutProviders';
import CheckoutDialog from './CheckoutDialog';

jest.mock('../services/api', () => ({ paymentsAPI: { order: jest.fn(), sandbox: jest.fn() } }));

let host;

const started = (provider = 'sandbox') => ({
  payment: { public_id: 'abc123', amount_paise: 5000, status: 'created' },
  checkout: { provider, order_id: 'order_1', subscription_id: null, client: {} },
});

const mount = (props = {}) => {
  act(() => {
    ReactDOM.render(<CheckoutDialog started={started()} title="समर्थन भेजें" onClose={() => {}} {...props} />, host);
  });
};

const text = () => document.body.textContent;
const button = (label) => Array.from(document.querySelectorAll('button')).find((b) => b.textContent.includes(label));
const click = async (label) => {
  await act(async () => {
    button(label).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
};
const tick = async (ms) => {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
};

beforeEach(() => {
  jest.useFakeTimers('modern');
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(host);
  });
  host.remove();
  jest.useRealTimers();
  delete launchers.fakepay;
});

describe('CheckoutDialog with the offline test provider', () => {
  test('says plainly that it is a test, and shows the amount', () => {
    mount();
    expect(text()).toContain('यह असली भुगतान नहीं है');
    expect(text()).toContain('₹50');
    expect(button('भुगतान सफल करें (टेस्ट)')).toBeTruthy();
  });

  test('pressing pay only starts the wait; "paid" is shown only when the server says so', async () => {
    paymentsAPI.sandbox.mockResolvedValue({ data: {} });
    paymentsAPI.order.mockResolvedValue({ data: { status: 'created' } });
    const onSettled = jest.fn();
    mount({ onSettled });

    await click('भुगतान सफल करें (टेस्ट)');
    expect(paymentsAPI.sandbox).toHaveBeenCalledWith('abc123', 'pay');
    expect(text()).toContain('भुगतान की पुष्टि हो रही है');
    expect(text()).not.toContain('भुगतान हो गया');
    expect(onSettled).not.toHaveBeenCalled();

    paymentsAPI.order.mockResolvedValue({ data: { status: 'captured' } });
    await tick(2100);
    expect(text()).toContain('भुगतान हो गया');
    expect(onSettled).toHaveBeenCalledWith('captured');
  });

  test('a failed payment says so, and the person can try again', async () => {
    paymentsAPI.sandbox.mockResolvedValue({ data: {} });
    paymentsAPI.order.mockResolvedValue({ data: { status: 'failed' } });
    mount();
    await click('भुगतान विफल करें (टेस्ट)');
    await tick(10);
    expect(text()).toContain('भुगतान पूरा नहीं हुआ');
    await click('फिर कोशिश करें');
    expect(button('भुगतान सफल करें (टेस्ट)')).toBeTruthy();
  });

  test('keeps asking through a network hiccup', async () => {
    paymentsAPI.sandbox.mockResolvedValue({ data: {} });
    paymentsAPI.order.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ data: { status: 'captured' } });
    mount();
    await click('भुगतान सफल करें (टेस्ट)');
    await tick(2100);
    expect(text()).toContain('भुगतान हो गया');
  });

  test('stops waiting after a while and reassures instead of spinning forever', async () => {
    paymentsAPI.sandbox.mockResolvedValue({ data: {} });
    paymentsAPI.order.mockResolvedValue({ data: { status: 'created' } });
    mount();
    await click('भुगतान सफल करें (टेस्ट)');
    await tick(95000);
    expect(text()).toContain('पुष्टि में देर हो रही है');
    const calls = paymentsAPI.order.mock.calls.length;
    await tick(10000);
    expect(paymentsAPI.order.mock.calls.length).toBe(calls); // and no longer asks
  });

  test('a refused test button shows the server\'s sentence, not a crash', async () => {
    paymentsAPI.sandbox.mockRejectedValue({ response: { data: { detail: 'भुगतान नहीं मिला' } } });
    mount();
    await click('भुगतान सफल करें (टेस्ट)');
    expect(text()).toContain('भुगतान नहीं मिला');
    expect(text()).not.toContain('भुगतान की पुष्टि हो रही है');
  });
});

describe('CheckoutDialog with other providers', () => {
  test('a provider with no browser side written yet is not pretended to work', () => {
    mount({ started: started('someprovider') });
    expect(text()).toContain('अभी पूरी तरह जुड़ी नहीं');
    expect(button('(टेस्ट)')).toBeUndefined();
  });

  test('a connected provider opens its own window, and "finished" starts the wait', async () => {
    let handlers;
    launchers.fakepay = jest.fn((args) => {
      handlers = args;
    });
    paymentsAPI.order.mockResolvedValue({ data: { status: 'created' } });
    mount({ started: started('fakepay') });
    expect(launchers.fakepay).toHaveBeenCalledTimes(1);
    expect(handlers.payment.public_id).toBe('abc123');
    expect(handlers.checkout.order_id).toBe('order_1');

    await act(async () => handlers.finished());
    expect(text()).toContain('भुगतान की पुष्टि हो रही है');

    await act(async () => handlers.dismissed());
    expect(text()).toContain('भुगतान की खिड़की खोलें'); // closed the window early: they can open it again
  });
});

describe('the frame', () => {
  test('Escape and a click on the backdrop both close it', () => {
    const onClose = jest.fn();
    mount({ onClose });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    act(() => {
      document.querySelector('.pay-overlay').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  test('is a labelled modal dialog, and locks the page behind it until closed', () => {
    mount();
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-label')).toBe('समर्थन भेजें');
    expect(document.body.style.overflow).toBe('hidden');
    act(() => {
      ReactDOM.unmountComponentAtNode(host);
    });
    expect(document.body.style.overflow).not.toBe('hidden');
  });
});
