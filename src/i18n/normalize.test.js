import { fill, normalize, translateWith } from './normalize';

const catalog = {
  'रचनाएँ': 'Stories',
  '{0} रचनाएँ': '{0} stories',
  'चालू ✓': 'On ✓',
  'तमिल': 'Tamil',
  '{*1} फ़ॉलोअर्स': '{*1} followers',
  '{*1} को जवाब लिखें…': 'Write a reply to {*1}…',
  'अ अंग्रेज़ी→{*1} {*2}': 'A English→{*1} {*2}',
  'तारीख {0} से {*1} के बीच होनी चाहिए': 'The date must be between {0} and {*1}',
  '{*1} रचना': 'Story: {*1}',
  '{*1} टैग की रचनाएँ': 'Stories tagged {*1}',
};

describe('catalog keys', () => {
  test('numbers become numbered slots and come back in order', () => {
    expect(normalize('6 रचनाएँ, 12 अंश')).toEqual({ key: '{0} रचनाएँ, {1} अंश', values: ['6', '12'] });
    expect(fill('{1} of {0}', ['3', '9'])).toBe('9 of 3');
    expect(fill('{2} missing', ['1'])).toBe('{2} missing');
    expect(normalize('कोई संख्या नहीं').key).toBe('कोई संख्या नहीं');
  });
});

describe('translating one piece of text', () => {
  test('an exact entry, with the spaces around it kept', () => {
    expect(translateWith(catalog, 'रचनाएँ')).toBe('Stories');
    expect(translateWith(catalog, '  रचनाएँ ')).toBe('  Stories ');
  });

  test('one entry serves every number', () => {
    expect(translateWith(catalog, '6 रचनाएँ')).toBe('6 stories');
    expect(translateWith(catalog, '1,204 रचनाएँ')).toBe('1,204 stories');
  });

  test('a pattern takes what stands in its slot, a name or a number', () => {
    expect(translateWith(catalog, 'राम शर्मा को जवाब लिखें…')).toBe('Write a reply to राम शर्मा…');
    expect(translateWith(catalog, '25 फ़ॉलोअर्स')).toBe('25 followers');
    expect(translateWith(catalog, 'तारीख 1 से 28 के बीच होनी चाहिए')).toBe('The date must be between 1 and 28');
  });

  test('what stood in a slot is translated too when the catalog knows it', () => {
    expect(translateWith(catalog, 'अ अंग्रेज़ी→तमिल चालू ✓')).toBe('A English→Tamil On ✓');
    expect(translateWith(catalog, 'अ अंग्रेज़ी→तमिल कुछ और')).toBe('A English→Tamil कुछ और');
  });

  test('the pattern with more fixed text wins', () => {
    expect(translateWith(catalog, 'कविता टैग की रचनाएँ')).toBe('Stories tagged कविता');
  });

  test('text with no entry is left alone (null)', () => {
    expect(translateWith(catalog, 'यह कहीं नहीं')).toBeNull();
    expect(translateWith(catalog, '')).toBeNull();
    expect(translateWith(catalog, '   ')).toBeNull();
    expect(translateWith(null, 'रचनाएँ')).toBeNull();
    expect(translateWith({}, 'रचनाएँ')).toBeNull();
  });
});
