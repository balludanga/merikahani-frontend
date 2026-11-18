/**
 * Live Hinglish typing for a React-controlled <textarea>/<input>.
 *
 *   const typing = useFieldTyping(ref, { enabled, apply, maxLength });
 *   <textarea ref={ref} onKeyDown={(e) => { if (typing.onKeyDown(e)) return; ... }}
 *             onBlur={typing.onBlur} onMouseDown={typing.onMouseDown} />
 *
 * `apply(value, caret)` must put the new text in the box and the caret at `caret` (see HindiTextarea).
 */
import { useCallback, useEffect, useRef } from 'react';
import { Composer } from './composer.js';
import { sharedBox } from './suggestBox.js';
import { TextareaHost } from './textareaHost.js';
import { loadLexicon, showSuggestions } from './setup.js';

export function useFieldTyping(ref, { enabled, apply, maxLength, typing }) {
  // `typing` is { engine, stop, prepare } for the language being written; Hindi when it is left out
  const live = useRef({ enabled, apply, maxLength, typing });
  live.current = { enabled, apply, maxLength, typing };
  const parts = useRef(null);

  const get = useCallback(() => {
    const el = ref.current;
    if (!el) return null;
    if (!parts.current || parts.current.el !== el) {
      const host = new TextareaHost(el, {
        apply: (value, caret) => live.current.apply(value, caret),
        maxLength: () => live.current.maxLength,
      });
      const composer = new Composer(host, {
        ...(live.current.typing ? { engine: live.current.typing.engine, stop: live.current.typing.stop } : null),
        box: sharedBox(),
        enabled: () => !!live.current.enabled,
        showList: showSuggestions,
      });
      // a browser that still types a letter this composer took over: stop the second copy
      const guard = (e) => composer.guardInput(e);
      el.addEventListener('beforeinput', guard, true);
      parts.current = { el, host, composer, guard };
    }
    return parts.current;
  }, [ref]);

  const prepare = typing && typing.prepare;
  useEffect(() => {
    if (!enabled) return;
    if (prepare) prepare();
    else loadLexicon();
  }, [enabled, prepare]);

  useEffect(
    () => () => {
      if (parts.current) {
        parts.current.el.removeEventListener('beforeinput', parts.current.guard, true);
        parts.current.composer.destroy();
      }
    },
    []
  );

  const onKeyDown = useCallback(
    (event) => {
      if (!live.current.enabled) return false;
      const p = get();
      if (!p) return false;
      p.host.sync();
      const current = live.current.typing;
      if (current) p.composer.configure({ engine: current.engine, stop: current.stop });
      return p.composer.keydown(event.nativeEvent || event);
    },
    [get]
  );

  const interrupt = useCallback(() => {
    if (parts.current) parts.current.composer.interrupted();
  }, []);

  return { onKeyDown, onBlur: interrupt, onMouseDown: interrupt, interrupt };
}
