import { type RefObject, useEffect, useRef } from "react";

const SLACK_PX = 24;

const scrolls = (el: HTMLElement) => el.scrollHeight > el.clientHeight;

function atEnd(el: HTMLElement) {
  if (scrolls(el)) {
    return el.scrollHeight - el.scrollTop - el.clientHeight <= SLACK_PX;
  }
  const page = document.documentElement;
  return page.scrollHeight - window.scrollY - window.innerHeight <= SLACK_PX;
}

/**
 * Keeps you at the end of `ref` when `key` changes, if you were already there; otherwise leaves you
 * where you are. The element scrolls on its own on wide screens and the window does on narrow ones.
 */
export function useFollowEnd(ref: RefObject<HTMLElement | null>, key: unknown) {
  const wasAtEnd = useRef(false);
  const lastKey = useRef(key);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const track = () => {
      wasAtEnd.current = atEnd(el);
    };
    track();
    el.addEventListener("scroll", track, { passive: true });
    window.addEventListener("scroll", track, { passive: true });
    return () => {
      el.removeEventListener("scroll", track);
      window.removeEventListener("scroll", track);
    };
  }, [ref]);

  useEffect(() => {
    if (Object.is(lastKey.current, key)) return;
    lastKey.current = key;
    const el = ref.current;
    if (!el || !wasAtEnd.current) return;
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)")
      .matches
      ? "instant"
      : "smooth";
    if (scrolls(el)) el.scrollTo({ top: el.scrollHeight, behavior });
    else
      window.scrollTo({
        top: document.documentElement.scrollHeight,
        behavior,
      });
  }, [ref, key]);
}
