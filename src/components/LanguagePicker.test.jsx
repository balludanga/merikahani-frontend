import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import LanguagePicker from './LanguagePicker';

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
  document.head.querySelectorAll('link[data-fonts]').forEach((link) => link.remove());
});

const mount = (props) =>
  act(() => {
    ReactDOM.render(<LanguagePicker title="भाषा चुनें" onChange={() => {}} onClose={() => {}} {...props} />, host);
  });
const rows = () => Array.from(host.querySelectorAll('.lang-row'));
const click = (el) =>
  act(() => {
    el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
const type = (el, value) =>
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    setter.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });

describe('the language picker', () => {
  test('lists all 22 scheduled languages and English, each named as the site names them', () => {
    mount({ multiple: true, value: [] });
    expect(rows()).toHaveLength(23);
    const names = rows().map((r) => r.textContent.replace('✓', ''));
    expect(names).toContain('हिंदी');
    expect(names).toContain('तमिल (தமிழ்)');
    expect(names).toContain('अंग्रेज़ी (English)');
    expect(names).toContain('मराठी');
  });

  test('loads the fonts of every script, so each native name can be drawn', () => {
    mount({ multiple: true, value: [] });
    const link = document.head.querySelector('link[data-fonts="all"]');
    expect(link).not.toBeNull();
    expect(link.href).toContain('Noto+Serif+Tamil');
    expect(link.href).toContain('Noto+Sans+Ol+Chiki');
  });

  test('can be searched in Devanagari, in the language\'s own script or in English letters', () => {
    mount({ multiple: true, value: [] });
    const search = host.querySelector('.lang-search');
    type(search, 'tamil');
    expect(rows().map((r) => r.textContent)).toEqual(['तमिल (தமிழ்)']);
    type(search, 'বাংলা');
    expect(rows()).toHaveLength(1);
    type(search, 'zzzz');
    expect(rows()).toHaveLength(0);
    expect(host.textContent).toContain('इस नाम की कोई भाषा नहीं मिली');
  });

  test('several can be ticked, and only "हो गया" hands the choice back', () => {
    const onChange = jest.fn();
    const onClose = jest.fn();
    mount({ multiple: true, value: ['hi'], onChange, onClose });
    expect(rows()[0].getAttribute('aria-checked')).toBe('true');
    click(rows()[2]); // Assamese
    click(rows()[0]); // untick Hindi
    expect(onChange).not.toHaveBeenCalled();
    click(host.querySelector('.lang-done'));
    expect(onChange).toHaveBeenCalledWith(['as']);
    expect(onClose).toHaveBeenCalled();
  });

  test('"सभी भाषाएँ दिखाएँ" empties the choice, only where an empty choice makes sense', () => {
    const onChange = jest.fn();
    mount({ multiple: true, allowNone: true, value: ['hi', 'ta'], onChange });
    click(host.querySelector('.lang-link'));
    click(host.querySelector('.lang-done'));
    expect(onChange).toHaveBeenCalledWith([]);
    act(() => {
      ReactDOM.unmountComponentAtNode(host);
    });
    mount({ multiple: true, value: ['hi'] });
    expect(host.querySelector('.lang-link')).toBeNull();
  });

  test('a single choice is made by one press and closes the sheet', () => {
    const onChange = jest.fn();
    const onClose = jest.fn();
    mount({ value: ['hi'], onChange, onClose });
    expect(host.querySelector('.lang-done')).toBeNull();
    click(rows()[1]); // English
    expect(onChange).toHaveBeenCalledWith(['en']);
    expect(onClose).toHaveBeenCalled();
  });

  test('Escape closes it', () => {
    const onClose = jest.fn();
    mount({ multiple: true, value: [], onClose });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    });
    expect(onClose).toHaveBeenCalled();
  });
});

describe('choosing a main language among several', () => {
  const stars = () => Array.from(host.querySelectorAll('.lang-star'));

  test('only ticked languages can be starred, and the first ticked is the main one', () => {
    const onChange = jest.fn();
    mount({ multiple: true, primary: null, value: [], onChange });
    expect(stars()).toHaveLength(0);
    click(rows()[2]); // Assamese
    click(rows()[3]); // Bengali
    expect(stars()).toHaveLength(2);
    expect(stars()[0].getAttribute('aria-pressed')).toBe('true');
    click(host.querySelector('.lang-done'));
    expect(onChange).toHaveBeenCalledWith(['as', 'bn'], 'as');
  });

  test('a star makes another the main one, and ticks it if it was not', () => {
    const onChange = jest.fn();
    mount({ multiple: true, primary: 'hi', value: ['hi', 'ta'], onChange });
    click(stars()[1]);
    click(host.querySelector('.lang-done'));
    expect(onChange).toHaveBeenCalledWith(['hi', 'ta'], 'ta');
  });

  test('taking the main one off passes the star to the next', () => {
    const onChange = jest.fn();
    mount({ multiple: true, primary: 'hi', value: ['hi', 'ta'], onChange });
    click(rows()[0]); // untick Hindi
    click(host.querySelector('.lang-done'));
    expect(onChange).toHaveBeenCalledWith(['ta'], 'ta');
  });

  test('a picker that does not ask for a main language hands back just the list', () => {
    const onChange = jest.fn();
    mount({ multiple: true, value: ['hi'], onChange });
    expect(stars()).toHaveLength(0);
    click(host.querySelector('.lang-done'));
    expect(onChange).toHaveBeenCalledWith(['hi']);
  });
});
