import { categoryLabel, collapseWithMap, findNoteInText } from './review';

describe('collapseWithMap', () => {
  test('collapses runs of whitespace and keeps a way back', () => {
    const raw = 'एक  दो\n\nतीन';
    const { text, map } = collapseWithMap(raw);
    expect(text).toBe('एक दो तीन');
    expect(raw[map[0]]).toBe('एक'[0]);
    expect(raw[map[text.indexOf('तीन')]]).toBe('त');
  });

  test('ignores leading space', () => {
    expect(collapseWithMap('  \n अ ब').text).toBe('अ ब');
  });
});

describe('findNoteInText', () => {
  const raw = 'पहला वाक्य।\nयह एक अनुचित अंश है।\n\nआख़िरी वाक्य।\n';

  test('finds the passage across the editor text, with raw offsets', () => {
    const note = { text: 'यह एक अनुचित अंश है।', start_offset: 12, prefix: 'पहला वाक्य। ', suffix: ' आख़िरी वाक्य।' };
    const at = findNoteInText(raw, note);
    expect(raw.slice(at.start, at.end)).toBe('यह एक अनुचित अंश है।');
  });

  test('a passage that crosses a paragraph break maps to the real span', () => {
    const note = { text: 'अंश है। आख़िरी' };
    const at = findNoteInText(raw, note);
    expect(raw.slice(at.start, at.end)).toBe('अंश है।\n\nआख़िरी');
  });

  test('picks the occurrence whose surroundings match', () => {
    const twice = 'क्या है। बुरा शब्द। फिर से। अच्छा बात। बुरा शब्द। अंत।';
    const note = { text: 'बुरा शब्द।', prefix: 'अच्छा बात। ', suffix: ' अंत।' };
    const at = findNoteInText(twice, note);
    expect(at.start).toBe(twice.lastIndexOf('बुरा शब्द।'));
  });

  test('null once the writer has reworded the passage', () => {
    expect(findNoteInText(raw, { text: 'यह वाक्य नहीं है' })).toBeNull();
  });
});

test('unknown categories fall back to "other"', () => {
  expect(categoryLabel('hate')).toBe('नफ़रत / भेदभाव');
  expect(categoryLabel('???')).toBe('अन्य');
});
