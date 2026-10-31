import React from 'react';
import ReactDOM from 'react-dom';
import { act } from 'react-dom/test-utils';
import { ShareSheet, useShare } from './ShareSheet';

const url = 'https://lekhanii.vercel.app/api/share/post/chand';
let host;

const unmount = () => {
  act(() => {
    ReactDOM.unmountComponentAtNode(host);
  });
};

const mount = (element) => {
  act(() => {
    ReactDOM.render(element, host);
  });
};

const setMedia = (coarse) => {
  window.matchMedia = jest.fn().mockImplementation((query) => ({
    matches: coarse && query.includes('coarse'),
    media: query,
    addListener: jest.fn(),
    removeListener: jest.fn(),
  }));
};

const setNavigator = (share, canShare) => {
  Object.defineProperty(navigator, 'share', { value: share, configurable: true, writable: true });
  Object.defineProperty(navigator, 'canShare', { value: canShare, configurable: true, writable: true });
};

beforeEach(() => {
  host = document.createElement('div');
  document.body.appendChild(host);
  setMedia(false);
  setNavigator(undefined, undefined);
});

afterEach(() => {
  unmount();
  host.remove();
  jest.useRealTimers();
});

describe('ShareSheet', () => {
  test('offers real links for the common apps and the address to copy', () => {
    mount(<ShareSheet url={url} title="चाँद" text="चाँद पढ़ें" heading="साझा करें" onClose={() => {}} />);
    const whatsapp = host.querySelector('a.share-whatsapp');
    expect(whatsapp.href).toContain('https://wa.me/?text=');
    expect(whatsapp.getAttribute('target')).toBe('_blank');
    expect(whatsapp.getAttribute('rel')).toContain('noopener');
    expect(host.querySelector('a.share-email').getAttribute('target')).toBeNull();
    expect(host.querySelector('input').value).toBe(url);
    // SMS is a phone feature; hidden here (pointer: fine)
    expect(host.querySelector('.share-sms')).toBeNull();
    // no device sheet on this browser -> no "other apps" tile
    expect(host.querySelector('.share-more')).toBeNull();
  });

  test('shows the phone-only and device-sheet options where they exist', () => {
    setMedia(true);
    setNavigator(jest.fn(), undefined);
    mount(<ShareSheet url={url} title="चाँद" text="" heading="साझा करें" onClose={() => {}} />);
    expect(host.querySelector('.share-sms')).not.toBeNull();
    expect(host.querySelector('.share-more')).not.toBeNull();
  });

  test('Escape and the backdrop close it; focus goes in and returns', () => {
    const opener = document.createElement('button');
    document.body.appendChild(opener);
    opener.focus();
    const onClose = jest.fn();
    mount(<ShareSheet url={url} title="चाँद" text="" heading="साझा करें" onClose={onClose} />);
    expect(host.querySelector('.share-sheet').contains(document.activeElement)).toBe(true);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(1);

    act(() => {
      host.querySelector('.share-overlay').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    // a press inside the card must not close it
    act(() => {
      host.querySelector('.share-sheet').dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    });
    expect(onClose).toHaveBeenCalledTimes(2);

    unmount();
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  test('copy puts the address on the clipboard and says so', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    mount(<ShareSheet url={url} title="चाँद" text="" heading="साझा करें" onClose={() => {}} />);
    await act(async () => {
      host.querySelector('.share-copy').click();
    });
    expect(writeText).toHaveBeenCalledWith(url);
    expect(host.querySelector('.share-copy').textContent).toContain('कॉपी हुआ');
    expect(host.querySelector('.share-live').textContent).toContain('कॉपी हो गई');
  });

  test('page scrolling is locked while open and restored after', () => {
    document.body.style.overflow = 'auto';
    mount(<ShareSheet url={url} title="चाँद" text="" heading="साझा करें" onClose={() => {}} />);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('auto');
  });
});

describe('useShare', () => {
  const Probe = () => {
    const { share, sheet } = useShare({ url, title: 'चाँद', text: 'पढ़ें' });
    return (
      <div>
        <button type="button" id="go" onClick={share}>go</button>
        {sheet}
      </div>
    );
  };

  const tap = async () => {
    await act(async () => {
      host.querySelector('#go').click();
    });
  };

  test('desktop: opens the in-page sheet', async () => {
    const share = jest.fn();
    setNavigator(share, undefined);
    mount(<Probe />);
    await tap();
    expect(host.querySelector('.share-sheet')).not.toBeNull();
    expect(share).not.toHaveBeenCalled();
  });

  test('phone: goes straight to the device sheet and stays closed after sharing or cancelling', async () => {
    setMedia(true);
    const share = jest.fn().mockResolvedValue(undefined);
    setNavigator(share, undefined);
    mount(<Probe />);
    await tap();
    expect(share).toHaveBeenCalledWith({ title: 'चाँद', text: 'पढ़ें', url });
    expect(host.querySelector('.share-sheet')).toBeNull();

    share.mockRejectedValueOnce(Object.assign(new Error('x'), { name: 'AbortError' }));
    await tap();
    expect(host.querySelector('.share-sheet')).toBeNull();
  });

  test('phone: if the device sheet fails, the in-page sheet opens instead', async () => {
    setMedia(true);
    setNavigator(jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })), undefined);
    mount(<Probe />);
    await tap();
    expect(host.querySelector('.share-sheet')).not.toBeNull();
  });
});
