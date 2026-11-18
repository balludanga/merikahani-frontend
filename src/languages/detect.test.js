import { dominantScript, suggestLanguage } from './detect';

const TAMIL = 'இது ஒரு சிறிய கதை. ஒரு ஊரில் ஒரு பெண் இருந்தாள். அவள் தினமும் கடலைப் பார்த்தாள்.';
const HINDI = 'यह एक छोटी कहानी है। एक गाँव में एक लड़की रहती थी। वह रोज़ नदी के किनारे जाती थी।';
const ENGLISH = 'This is a small story. In a village there lived a girl who looked at the river every day.';
const URDU = 'یہ ایک چھوٹی سی کہانی ہے۔ ایک گاؤں میں ایک لڑکی رہتی تھی۔ وہ روز دریا کے کنارے جاتی تھی۔';

describe('what script a text is in', () => {
  test('is found from the letters, and said only when it is clear', () => {
    expect(dominantScript(TAMIL)).toBe('Taml');
    expect(dominantScript(HINDI)).toBe('Deva');
    expect(dominantScript(ENGLISH)).toBe('Latn');
    expect(dominantScript(URDU)).toBe('Arab');
    expect(dominantScript('थोड़ा')).toBeNull(); // too little to say
    expect(dominantScript(`${HINDI} ${ENGLISH.slice(0, 20)}`)).toBe('Deva');
    expect(dominantScript(`${HINDI} ${ENGLISH}`)).toBeNull(); // half and half
  });
});

describe('a language worth suggesting', () => {
  test('Tamil letters in a story marked Hindi point to Tamil', () => {
    expect(suggestLanguage(TAMIL, 'hi')).toBe('ta');
    expect(suggestLanguage(URDU, 'hi')).toBe('ur');
    expect(suggestLanguage(ENGLISH, 'ta')).toBe('en');
  });

  test('nothing is suggested when the text fits the language chosen', () => {
    expect(suggestLanguage(TAMIL, 'ta')).toBeNull();
    expect(suggestLanguage(HINDI, 'hi')).toBeNull();
    expect(suggestLanguage(HINDI, 'mr')).toBeNull(); // Devanagari is Marathi's script too
    expect(suggestLanguage(URDU, 'sd')).toBeNull(); // and Sindhi can be Perso-Arabic
    expect(suggestLanguage('', 'hi')).toBeNull();
  });

  test('Hindi written in Roman letters is never "corrected" to English', () => {
    const hinglish = 'main aaj bahut khush hoon kyunki meri kahani chhap gayi hai aur sabko pasand aayi';
    expect(suggestLanguage(hinglish, 'hi')).toBeNull();
  });
});
