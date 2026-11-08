/**
 * The small list that appears under the caret while a word is being typed.
 *
 * Plain DOM rather than React: it is shown and hidden on every key press, and the editors it serves
 * (Quill, textareas) live outside React's tree. The list never takes focus - pressing on it keeps the
 * caret where it was - and everything it does is also reachable from the keyboard (see composer.js).
 */
const HINT_KEY = 'lekhani_typing_hint';
const HINT_TIMES = 12; // the keyboard line is shown for this many words, then stays out of the way

let shared = null;

function hintsLeft() {
  try {
    return Number(localStorage.getItem(HINT_KEY) || 0) < HINT_TIMES;
  } catch (error) {
    return false;
  }
}

function hintShown() {
  try {
    localStorage.setItem(HINT_KEY, String(Number(localStorage.getItem(HINT_KEY) || 0) + 1));
  } catch (error) {
    // storage blocked: the hint simply keeps showing
  }
}

export class SuggestBox {
  constructor() {
    this.el = null;
    this.live = null;
    this.visible = false;
    this.current = null;
    this.hinted = false;
    this.reposition = () => {
      if (this.visible && this.current && this.current.locate) this.place(this.current.locate());
    };
  }

  build() {
    if (this.el || typeof document === 'undefined') return;
    const el = document.createElement('div');
    el.className = 'hs-box';
    el.setAttribute('role', 'listbox');
    el.setAttribute('aria-label', 'हिंदी शब्द के सुझाव');
    el.hidden = true;
    // pressing on the list must not move the caret out of the text
    el.addEventListener('mousedown', (e) => e.preventDefault());
    el.addEventListener('click', (e) => {
      const row = e.target.closest('.hs-row');
      if (row && this.current) this.current.onPick(Number(row.dataset.i));
    });
    document.body.appendChild(el);
    this.el = el;

    const live = document.createElement('div');
    live.className = 'hs-sr';
    live.setAttribute('role', 'status');
    live.setAttribute('aria-live', 'polite');
    document.body.appendChild(live);
    this.live = live;
  }

  /**
   * @param {{ id: string, items: Array<{text: string, kind: string}>, index: number, typed: string,
   *           rect: {left: number, top: number, bottom: number}, onPick: (i: number) => void,
   *           element?: HTMLElement|null }} view
   */
  show(view) {
    this.build();
    if (!this.el || !view.items.length) {
      this.hide();
      return;
    }
    this.current = view;
    const el = this.el;
    el.id = view.id;
    el.textContent = '';

    const head = document.createElement('div');
    head.className = 'hs-head';
    head.textContent = `(${view.typed})`;
    el.appendChild(head);

    view.items.forEach((item, i) => {
      const row = document.createElement('div');
      const more = item.kind === 'more';
      row.className = `hs-row${i === view.index ? ' hs-on' : ''}${more ? ' hs-more' : ''}`;
      row.id = `${view.id}-${i}`;
      row.dataset.i = String(i);
      row.setAttribute('role', 'option');
      row.setAttribute('aria-selected', i === view.index ? 'true' : 'false');
      row.setAttribute('lang', 'hi');
      row.textContent = item.text;
      el.appendChild(row);
    });

    if (!this.visible && !this.hinted && hintsLeft()) {
      this.hinted = true;
      hintShown();
    }
    if (this.hinted) {
      const foot = document.createElement('div');
      foot.className = 'hs-foot';
      foot.textContent = 'स्पेस से चुनें · ↑↓ से बदलें · (Esc) अंग्रेज़ी रखें';
      el.appendChild(foot);
    }

    el.hidden = false;
    this.visible = true;
    if (view.element) {
      view.element.setAttribute('aria-expanded', 'true');
      view.element.setAttribute('aria-controls', view.id);
      view.element.setAttribute('aria-activedescendant', `${view.id}-${view.index}`);
    }
    this.place(view.rect);
    if (this.live) this.live.textContent = `${view.items[view.index].text}, ${view.index + 1} / ${view.items.length}`;
    window.addEventListener('scroll', this.reposition, true);
    window.addEventListener('resize', this.reposition);
  }

  place(rect) {
    const el = this.el;
    if (!el || !rect) return;
    const vv = window.visualViewport;
    const viewW = vv ? vv.width : window.innerWidth;
    const viewH = vv ? vv.height : window.innerHeight;
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    let left = rect.left;
    let top = rect.bottom + 6;
    if (left + w > viewW - 8) left = Math.max(8, viewW - w - 8);
    if (top + h > viewH - 8 && rect.top - h - 6 > 8) top = rect.top - h - 6; // no room below: go above
    el.style.left = `${Math.round(Math.max(8, left))}px`;
    el.style.top = `${Math.round(Math.max(8, top))}px`;
  }

  hide() {
    if (!this.el || !this.visible) {
      this.hinted = false;
      this.current = null;
      return;
    }
    const view = this.current;
    this.el.hidden = true;
    this.visible = false;
    this.hinted = false;
    this.current = null;
    if (view && view.element) {
      view.element.setAttribute('aria-expanded', 'false');
      view.element.removeAttribute('aria-activedescendant');
    }
    window.removeEventListener('scroll', this.reposition, true);
    window.removeEventListener('resize', this.reposition);
  }
}

export function sharedBox() {
  if (!shared) shared = new SuggestBox();
  return shared;
}
