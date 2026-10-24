import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useFollowEnd } from "./use-follow-end";

function sized(
  el: HTMLElement,
  size: { scrollHeight: number; clientHeight: number; scrollTop: number },
) {
  for (const [key, value] of Object.entries(size)) {
    Object.defineProperty(el, key, {
      configurable: true,
      writable: true,
      value,
    });
  }
  el.scrollTo = vi.fn();
  return el;
}

function follow(el: HTMLElement) {
  const ref = { current: el };
  return renderHook(({ key }) => useFollowEnd(ref, key), {
    initialProps: { key: false },
  });
}

describe("useFollowEnd", () => {
  beforeEach(() => {
    vi.spyOn(window, "scrollTo").mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it("scrolls to the new end when you were at the end", () => {
    const el = sized(document.createElement("div"), {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 600,
    });
    const { rerender } = follow(el);

    rerender({ key: true });

    expect(el.scrollTo).toHaveBeenCalledWith(
      expect.objectContaining({ top: 1000 }),
    );
  });

  it("leaves you where you are when you'd scrolled up", () => {
    const el = sized(document.createElement("div"), {
      scrollHeight: 1000,
      clientHeight: 400,
      scrollTop: 600,
    });
    const { rerender } = follow(el);

    act(() => {
      el.scrollTop = 100;
      el.dispatchEvent(new Event("scroll"));
    });
    rerender({ key: true });

    expect(el.scrollTo).not.toHaveBeenCalled();
  });

  it("scrolls the window when the element doesn't scroll on its own", () => {
    const el = sized(document.createElement("div"), {
      scrollHeight: 400,
      clientHeight: 400,
      scrollTop: 0,
    });
    const { rerender } = follow(el);

    rerender({ key: true });

    expect(el.scrollTo).not.toHaveBeenCalled();
    expect(window.scrollTo).toHaveBeenCalled();
  });
});
