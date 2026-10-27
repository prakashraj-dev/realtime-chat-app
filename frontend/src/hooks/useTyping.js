import { useCallback, useEffect, useRef } from "react";

// Debounced typing indicator.
//  - tells the server "typing: true" once, on the first keystroke
//  - tells the server "typing: false" after `delay` ms with no keystrokes
export default function useTyping(onTyping, delay = 1500) {
  const callbackRef = useRef(onTyping);  // always points at the latest callback
  const isTypingRef = useRef(false);     // are we currently marked as typing?
  const timerRef = useRef(null);         // the debounce timer

  useEffect(() => {
    callbackRef.current = onTyping;
  });

  // Stop right now: cancel the timer and tell the server (only if we were typing)
  const stopTyping = useCallback(() => {
    clearTimeout(timerRef.current);
    if (isTypingRef.current) {
      isTypingRef.current = false;
      callbackRef.current(false);
    }
  }, []);

  // Call this on every keystroke
  const handleKeystroke = useCallback(() => {
    // Leading edge: emit only the first time
    if (!isTypingRef.current) {
      isTypingRef.current = true;
      callbackRef.current(true);
    }

    // Debounce: reset the timer on every keystroke
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(stopTyping, delay);
  }, [delay, stopTyping]);

  // If the component unmounts while typing, clean up
  useEffect(() => stopTyping, [stopTyping]);

  return { handleKeystroke, stopTyping };
}