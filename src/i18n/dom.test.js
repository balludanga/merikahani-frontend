import { applyCatalog, startTranslating, translateLoose } from './dom';

const catalog = {
  'सहेजें': 'Save',
  'कहानी': 'Story',
  '{0} रचनाएँ': '{0} stories',
  'शीर्षक लिखें…': 'Write a title…',
  'बंद करें': 'Close',
  'हटाएँ': 'Remove',
  '{*1} को जवाब लिखें…': 'Write a reply to {*1}…',
};

const later = () => new Promise((resolve) => setTimeout(resolve, 0));
const el = (html) => {
  const host = document.createElement('div');
  host.innerHTML = html;
  document.body.appendChild(host);
  return host;
};

beforeAll(() => startTranslating());
afterEach(() => {
  applyCatalog(null);
  document.body.innerHTML = '';
});

describe('putting a translation on the page', () => {
  test('swaps interface text, numbers included, and the text of fields and buttons', () => {
    const host = el('<button title="बंद करें" aria-label="बंद करें">सहेजें</button><p>6 रचनाएँ</p><textarea placeholder="शीर्षक लिखें…"></textarea>');
    applyCatalog(catalog);
    expect(host.querySelector('button').textContent).toBe('Save');
    expect(host.querySelector('button').getAttribute('title')).toBe('Close');
    expect(host.querySelector('button').getAttribute('aria-label')).toBe('Close');
    expect(host.querySelector('p').textContent).toBe('6 stories');
    expect(host.querySelector('textarea').getAttribute('placeholder')).toBe('Write a title…');
  });

  test('goes back to Hindi, and on to another language, from what it remembers', () => {
    const host = el('<p>सहेजें</p>');
    applyCatalog(catalog);
    expect(host.textContent).toBe('Save');
    applyCatalog({ 'सहेजें': 'Guardar' });
    expect(host.textContent).toBe('Guardar');
    applyCatalog(null);
    expect(host.textContent).toBe('सहेजें');
  });

  test('never touches what people wrote: elements with a lang, translate="no", editors and text boxes', () => {
    const host = el(
      '<h2 lang="hi">कहानी</h2><span translate="no">कहानी</span><div contenteditable="true">कहानी</div><textarea>कहानी</textarea><div translate="no"><b>कहानी</b></div><p>कहानी</p>'
    );
    applyCatalog(catalog);
    expect(host.querySelector('h2').textContent).toBe('कहानी');
    expect(host.querySelector('span').textContent).toBe('कहानी');
    expect(host.querySelector('[contenteditable]').textContent).toBe('कहानी');
    expect(host.querySelector('textarea').textContent).toBe('कहानी');
    expect(host.querySelector('b').textContent).toBe('कहानी');
    expect(host.querySelector('p').textContent).toBe('Story'); // plain interface text is translated
  });

  test('text it has no entry for is left as it is, and so is text that is not Hindi', () => {
    const host = el('<p>कोई और वाक्य</p><p>Plain English</p><p>12 : 30</p>');
    applyCatalog(catalog);
    expect(Array.from(host.querySelectorAll('p')).map((p) => p.textContent)).toEqual(['कोई और वाक्य', 'Plain English', '12 : 30']);
  });

  test('keeps translating what the page draws later, and what it rewrites', async () => {
    const host = el('<p id="a">सहेजें</p>');
    applyCatalog(catalog);
    const added = document.createElement('p');
    added.textContent = 'हटाएँ';
    host.appendChild(added);
    await later();
    expect(added.textContent).toBe('Remove');
    // the page changes a text it already drew (React updating a node): the new text is translated too
    host.querySelector('#a').firstChild.nodeValue = 'बंद करें';
    await later();
    expect(host.querySelector('#a').textContent).toBe('Close');
    // and a new placeholder
    const field = document.createElement('input');
    host.appendChild(field);
    field.setAttribute('placeholder', 'राम को जवाब लिखें…');
    await later();
    expect(field.getAttribute('placeholder')).toBe('Write a reply to राम…');
  });

  test('a language switch after the page changed still finds the right Hindi', async () => {
    const host = el('<p>सहेजें</p>');
    applyCatalog(catalog);
    host.querySelector('p').firstChild.nodeValue = 'हटाएँ';
    await later();
    applyCatalog({ 'हटाएँ': 'Quitar' });
    expect(host.textContent).toBe('Quitar');
    applyCatalog(null);
    expect(host.textContent).toBe('हटाएँ');
  });

  test('text built outside the page (a title) goes through the same catalog', () => {
    applyCatalog(catalog);
    expect(translateLoose('सहेजें')).toBe('Save');
    expect(translateLoose('कुछ और')).toBe('कुछ और');
    applyCatalog(null);
    expect(translateLoose('सहेजें')).toBe('सहेजें');
  });
});

describe('the brand name', () => {
  test('is written in the reader\'s script, inside a translation and on its own, and goes back to Hindi', () => {
    document.body.innerHTML = '<a id="logo">लेखनी</a><p id="p">सहेजें</p><span id="s" title="लेखनी होम">लेखनी सदस्य</span>';
    const catalog = { 'सहेजें': 'सहेजें लेखनी', 'लेखनी सदस्य': 'लेखनी member' };
    applyCatalog(catalog, 'லேகனீ');
    expect(document.getElementById('logo').textContent).toBe('லேகனீ');
    expect(document.getElementById('p').textContent).toBe('सहेजें லேகனீ');
    expect(document.getElementById('s').textContent).toBe('லேகனீ member');
    expect(document.getElementById('s').getAttribute('title')).toBe('லேகனீ होम');
    expect(translateLoose('लेखनी')).toBe('லேகனீ');
    // another script: the page is redone from the Hindi it came from, not from the first spelling
    applyCatalog(catalog, 'লেখনী');
    expect(document.getElementById('logo').textContent).toBe('লেখনী');
    applyCatalog(null);
    expect(document.getElementById('logo').textContent).toBe('लेखनी');
    expect(document.getElementById('s').textContent).toBe('लेखनी सदस्य');
  });

  test('is left alone inside what people wrote', () => {
    document.body.innerHTML = '<p id="story" lang="hi">मैंने लेखनी पर लिखा</p><b translate="no">लेखनी</b>';
    applyCatalog({}, 'ᱞᱮᱠᱷᱟᱱᱤ');
    expect(document.getElementById('story').textContent).toBe('मैंने लेखनी पर लिखा');
    expect(document.querySelector('b').textContent).toBe('लेखनी');
    applyCatalog(null);
  });
});
