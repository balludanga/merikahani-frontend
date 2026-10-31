import { canNativeShare, copyText, nativeShare, shareTargets } from './share';

const data = { title: 'चाँद की कहानी', text: '“चाँद की कहानी” — राम की रचना', url: 'https://lekhanii.vercel.app/api/share/post/chand?a=1&b=2' };

const setNavigator = (props) => {
  Object.defineProperty(global.navigator, 'share', { value: props.share, configurable: true, writable: true });
  Object.defineProperty(global.navigator, 'canShare', { value: props.canShare, configurable: true, writable: true });
};

afterEach(() => {
  setNavigator({ share: undefined, canShare: undefined });
});

describe('shareTargets', () => {
  const targets = shareTargets(data);
  const byId = (id) => targets.find((t) => t.id === id);

  test('every address is encoded so & ? # and Devanagari survive', () => {
    targets.forEach((t) => {
      const query = t.href.split('?')[1] || '';
      expect(query).not.toMatch(/[ \n]/);
      // the story's own "&b=2" must not leak out as a separate parameter
      expect(query).not.toContain('&b=2');
    });
  });

  test('whatsapp carries the text and the link in one message', () => {
    const text = decodeURIComponent(byId('whatsapp').href.split('text=')[1]);
    expect(text).toBe(`${data.text}\n${data.url}`);
  });

  test('telegram, x and facebook take the link as their own parameter', () => {
    expect(new URL(byId('telegram').href).searchParams.get('url')).toBe(data.url);
    expect(new URL(byId('x').href).searchParams.get('url')).toBe(data.url);
    expect(new URL(byId('facebook').href).searchParams.get('u')).toBe(data.url);
    expect(new URL(byId('linkedin').href).searchParams.get('url')).toBe(data.url);
  });

  test('email and sms are not opened in a new tab; web apps are', () => {
    expect(byId('email').href.startsWith('mailto:?subject=')).toBe(true);
    expect(byId('email').external).toBe(false);
    expect(byId('sms').touchOnly).toBe(true);
    expect(byId('whatsapp').external).toBe(true);
  });

  test('falls back to the title when there is no text', () => {
    const plain = shareTargets({ title: 'शीर्षक', url: 'https://x.test/a' });
    expect(decodeURIComponent(plain.find((t) => t.id === 'whatsapp').href)).toContain('शीर्षक\nhttps://x.test/a');
  });
});

describe('native sharing', () => {
  test('is unavailable without navigator.share', async () => {
    expect(canNativeShare(data)).toBe(false);
    expect(await nativeShare(data)).toBe('unavailable');
  });

  test('respects canShare', async () => {
    const share = jest.fn();
    setNavigator({ share, canShare: () => false });
    expect(await nativeShare(data)).toBe('unavailable');
    expect(share).not.toHaveBeenCalled();
  });

  test('reports shared, and a closed sheet as cancelled (not an error)', async () => {
    setNavigator({ share: jest.fn().mockResolvedValue(undefined), canShare: undefined });
    expect(await nativeShare(data)).toBe('shared');

    const abort = Object.assign(new Error('closed'), { name: 'AbortError' });
    setNavigator({ share: jest.fn().mockRejectedValue(abort), canShare: undefined });
    expect(await nativeShare(data)).toBe('cancelled');
  });

  test('any other failure asks for the in-page sheet', async () => {
    const denied = Object.assign(new Error('no'), { name: 'NotAllowedError' });
    setNavigator({ share: jest.fn().mockRejectedValue(denied), canShare: undefined });
    expect(await nativeShare(data)).toBe('unavailable');
  });
});

describe('copyText', () => {
  afterEach(() => {
    delete global.navigator.clipboard;
    delete document.execCommand;
  });

  test('uses the clipboard API when it is allowed', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, 'clipboard', { value: { writeText }, configurable: true });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    expect(await copyText('abc')).toBe(true);
    expect(writeText).toHaveBeenCalledWith('abc');
  });

  test('falls back to execCommand when the clipboard API refuses', async () => {
    Object.defineProperty(global.navigator, 'clipboard', {
      value: { writeText: jest.fn().mockRejectedValue(new Error('denied')) },
      configurable: true,
    });
    Object.defineProperty(window, 'isSecureContext', { value: true, configurable: true });
    document.execCommand = jest.fn().mockReturnValue(true);
    expect(await copyText('abc')).toBe(true);
    expect(document.execCommand).toHaveBeenCalledWith('copy');
    expect(document.querySelector('textarea')).toBeNull();
  });

  test('says so when nothing could copy', async () => {
    document.execCommand = jest.fn().mockReturnValue(false);
    Object.defineProperty(window, 'isSecureContext', { value: false, configurable: true });
    expect(await copyText('abc')).toBe(false);
  });
});
