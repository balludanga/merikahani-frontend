/**
 * The regular inflections of Hindi verbs and adjectives, for the word list builder.
 *
 * A corpus of encyclopedia articles hardly ever uses "I" or "you" or the imperative, and stories use
 * little else: करूँगा, चलोगी, बताइए, निहारूँ. Hindi verbs are regular enough to write these out from the
 * infinitive, so the list does not depend on the corpus having happened to include every form.
 *
 * Only regular verbs are listed in verbs.txt; the irregular ones (होना, जाना, करना, देना, लेना, पीना, जीना)
 * are written out by hand in curated.txt (so is छूना, whose stem vowel shortens).
 */


/** Both spellings of a nasal dot: the moon (ँ) and the dot (ं). */
const nasal = (form) => [form, form.replace('ँ', 'ं')];

/** Stem of an infinitive ("चलना" -> "चल"); null when it is not an infinitive. */
export function stemOf(infinitive) {
  const word = infinitive.normalize('NFC');
  return word.endsWith('ना') && word.length > 3 ? word.slice(0, -2) : null;
}

/** All the regular forms of a verb, given its infinitive. */
export function verbForms(infinitive) {
  const stem = stemOf(infinitive);
  if (!stem) return [];
  const last = stem[stem.length - 1];
  const vowelFinal = last === 'ा' || last === 'ो';
  const forms = new Set([infinitive.normalize('NFC')]);
  const add = (...parts) => parts.flat().forEach((p) => forms.add(p.normalize('NFC')));

  // shared by both kinds of stem
  add(`${stem}ने`, `${stem}नी`, `${stem}ता`, `${stem}ती`, `${stem}ते`, `${stem}तीं`);
  add(`${stem}कर`, `${stem}के`, `${stem}`);

  if (!vowelFinal) {
    // चल: चला चली चले चलीं | चलूँ चले चलें चलो | चलूँगा चलेगी चलेंगे चलोगे | चलिए चलो
    add(`${stem}ा`, `${stem}ी`, `${stem}े`, `${stem}ीं`);
    add(nasal(`${stem}ूँ`), `${stem}ें`, `${stem}ो`);
    add(nasal(`${stem}ूँगा`), nasal(`${stem}ूँगी`), `${stem}ेगा`, `${stem}ेगी`, `${stem}ेंगे`, `${stem}ेंगी`, `${stem}ोगे`, `${stem}ोगी`);
    add(`${stem}िए`, `${stem}िएगा`, `${stem}ियो`);
  } else {
    // खा: खाया खाई खाए खाईं | खाऊँ खाए खाएँ खाओ | खाऊँगा खाएगी खाएँगे खाओगे | खाइए खाओ
    add(`${stem}या`, `${stem}ई`, `${stem}ए`, `${stem}ईं`);
    add(nasal(`${stem}ऊँ`), nasal(`${stem}एँ`), `${stem}ओ`);
    add(nasal(`${stem}ऊँगा`), nasal(`${stem}ऊँगी`), `${stem}एगा`, `${stem}एगी`, nasal(`${stem}एँगे`), nasal(`${stem}एँगी`), `${stem}ओगे`, `${stem}ओगी`);
    add(`${stem}इए`, `${stem}इएगा`);
  }
  return [...forms];
}

/** The three forms of an adjective that ends in -ा: सुनहरा, सुनहरे, सुनहरी. */
export function adjectiveForms(masculine) {
  const word = masculine.normalize('NFC');
  if (!word.endsWith('ा')) return [word];
  const base = word.slice(0, -1);
  return [word, `${base}े`, `${base}ी`];
}
