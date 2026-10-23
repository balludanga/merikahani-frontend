import { anchorFromRange, applyMarks, clearMarks, indexBody, locate } from './textAnchors';

const HTML =
  '<div><p>यह  एक\n परीक्षण लेख है।</p><p>दूसरा <strong>अनुच्छेद</strong> यहाँ है।</p>' +
  '<ul><li>पहला बिंदु</li><li>दूसरा बिंदु</li></ul><p>यह एक परीक्षण लेख है।</p></div>';

function mount(html = HTML) {
  const root = document.createElement('div');
  root.innerHTML = html;
  document.body.appendChild(root);
  return root;
}

function rangeOver(root, fromText, fromOffset, toText, toOffset) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let start;
  let end;
  while (walker.nextNode()) {
    const node = walker.currentNode;
    if (!start && node.nodeValue.includes(fromText)) start = node;
    if (node.nodeValue.includes(toText)) end = node;
  }
  const range = document.createRange();
  range.setStart(start, start.nodeValue.indexOf(fromText) + fromOffset);
  range.setEnd(end, end.nodeValue.indexOf(toText) + toOffset);
  return range;
}

const describe2 = () => ({ className: 'hl-mine', title: 't' });

afterEach(() => {
  document.body.innerHTML = '';
});

test('collapses whitespace and counts block breaks as one space', () => {
  const index = indexBody(mount());
  expect(index.text).toBe(
    'यह एक परीक्षण लेख है। दूसरा अनुच्छेद यहाँ है। पहला बिंदु दूसरा बिंदु यह एक परीक्षण लेख है।'
  );
});

test('a selection across paragraphs and bold text is highlighted, survives a reload, and clears cleanly', () => {
  const root = mount();
  const before = root.innerHTML;
  const index = indexBody(root);
  const range = rangeOver(root, 'लेख है।', 0, 'अनुच्छेद', 'अनुच्छेद'.length);
  const anchor = anchorFromRange(index, range);
  expect(anchor.text).toBe('लेख है। दूसरा अनुच्छेद');

  const saved = { id: 1, text: anchor.text, start_offset: anchor.start, prefix: anchor.prefix, suffix: anchor.suffix };
  applyMarks(index, [{ id: 1, start: anchor.start, end: anchor.end }], describe2);
  const marked = Array.from(root.querySelectorAll('mark.text-highlight'));
  expect(marked.length).toBeGreaterThan(1);
  expect(marked.map((m) => m.textContent).join('')).toBe('लेख है।दूसरा अनुच्छेद');
  expect(indexBody(root).text).toBe(index.text);

  // "Reload": brand-new DOM, same saved row.
  const fresh = mount();
  const freshIndex = indexBody(fresh);
  const start = locate(freshIndex, saved);
  expect(start).toBe(anchor.start);
  applyMarks(freshIndex, [{ id: 1, start, end: start + saved.text.length }], describe2);
  expect(fresh.querySelectorAll('mark.text-highlight').length).toBe(marked.length);

  clearMarks(root);
  expect(root.innerHTML).toBe(before);
});

test('the same words twice: the saved position, or failing that the surrounding words, pick the right one', () => {
  const root = mount();
  const index = indexBody(root);
  const first = index.text.indexOf('यह एक परीक्षण');
  const second = index.text.lastIndexOf('यह एक परीक्षण');
  expect(second).toBeGreaterThan(first);

  const item = {
    text: 'यह एक परीक्षण',
    start_offset: second,
    prefix: index.text.slice(second - 32, second),
    suffix: index.text.slice(second + 13, second + 45),
  };
  expect(locate(index, item)).toBe(second);
  // Story edited: the stored offset no longer lines up, the context still does.
  expect(locate(index, { ...item, start_offset: second + 3 })).toBe(second);
  // An older row with no position at all falls back to the first occurrence.
  expect(locate(index, { text: item.text })).toBe(first);
  // Passage deleted from the story.
  expect(locate(index, { text: 'यह शब्द कहीं नहीं', start_offset: 5 })).toBe(-1);
});

test('overlapping highlights never nest and each stretch lists every highlight covering it', () => {
  const root = mount();
  const index = indexBody(root);
  const a = index.text.indexOf('परीक्षण लेख');
  const spans = [
    { id: 1, start: a, end: a + 'परीक्षण लेख है।'.length },
    { id: 2, start: a + 'परीक्षण '.length, end: a + 'परीक्षण लेख है। दूसरा'.length },
  ];
  applyMarks(index, spans, (ids) => ({ className: 'x', title: ids.join('+') }));
  const marks = Array.from(root.querySelectorAll('mark.text-highlight'));
  expect(marks.some((m) => m.querySelector('mark'))).toBe(false);
  expect(marks.map((m) => m.dataset.hl)).toEqual(expect.arrayContaining(['1', '1,2', '2']));
  expect(indexBody(root).text).toBe(index.text);
});
