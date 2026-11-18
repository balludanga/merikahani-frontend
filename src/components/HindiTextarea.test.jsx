import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import HindiTextarea from './HindiTextarea';

let host;
beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
});
afterEach(() => {
  act(() => {
    ReactDOM.unmountComponentAtNode(host);
  });
  host.remove();
});

const mount = (props) =>
  act(() => {
    ReactDOM.render(<HindiTextarea value="" onChange={() => {}} hinglish onToggle={() => {}} {...props} />, host);
  });

describe('the shared text box and its language', () => {
  test('is Hindi unless a page says otherwise', () => {
    mount({});
    const box = host.querySelector('textarea');
    expect(box.getAttribute('lang')).toBe('hi');
    expect(host.querySelector('.hindi-hint').textContent).toContain('हिंदी टाइपिंग चालू');
  });

  test('takes another language for the text and the hint', () => {
    mount({ language: 'ta' });
    expect(host.querySelector('textarea').getAttribute('lang')).toBe('ta');
    expect(host.querySelector('textarea').getAttribute('dir')).toBe('auto');
    expect(host.querySelector('.hindi-hint').textContent).toContain('तमिल टाइपिंग चालू');
  });

  test('says plainly that English needs no typing help, and the switch shows it is not on', () => {
    mount({ language: 'en' });
    expect(host.querySelector('.hindi-hint').textContent).toBe('अंग्रेज़ी में सीधे लिखें');
    expect(host.querySelector('.hindi-toggle').getAttribute('aria-pressed')).toBe('false');
  });

  test('a switch that is off says so in the language\'s name', () => {
    mount({ language: 'bn', hinglish: false });
    expect(host.querySelector('.hindi-hint').textContent).toBe('बांग्ला टाइपिंग बंद');
  });
});
