import { transliterateWord, transliterateLastWord, dandaOnDoubleSpace } from './transliterate';

test('words people use when responding to a story come out as real Hindi', () => {
  const expected = {
    sundar: 'सुंदर', shukriya: 'शुक्रिया', dhanyavad: 'धन्यवाद', badhiya: 'बढ़िया',
    lajawab: 'लाजवाब', aapka: 'आपका', mera: 'मेरा', achchi: 'अच्छी', hindi: 'हिंदी',
    kahani: 'कहानी', bahut: 'बहुत', lekhak: 'लेखक', padha: 'पढ़ा',
  };
  Object.entries(expected).forEach(([latin, hindi]) => {
    expect(transliterateWord(latin)).toBe(hindi);
  });
});

test('capitals and the verified examples keep working', () => {
  expect(transliterateWord('Sundar')).toBe('सुंदर');
  expect(transliterateWord('baar')).toBe('बार');
  expect(transliterateWord('sitaare')).toBe('सितारे');
  expect(transliterateWord('kshetra')).toBe('क्षेत्र');
  expect(transliterateWord('rang')).toBe('रंग');
});

test('a word converts when a space ends it, and two spaces end the sentence', () => {
  expect(transliterateLastWord('bahut sundar ', 13).value).toBe('bahut सुंदर ');
  expect(transliterateLastWord('sundar', 6, true).value).toBe('सुंदर');
  expect(dandaOnDoubleSpace('सुंदर  ', 7).value).toBe('सुंदर। ');
});
