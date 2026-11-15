import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCommentNavigation } from "../hooks/useCommentNavigation";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "./domTestUtils";

const Harness = ({ html }: { html: string }) => {
  const { previewRef, navigation } = useCommentNavigation();
  return (
    <>
      <div ref={previewRef} dangerouslySetInnerHTML={{ __html: html }} />
      <output>
        {navigation.position ?? "–"} / {navigation.count}
      </output>
      <button
        disabled={!navigation.previous}
        onClick={() => navigation.previous?.()}
      >
        Previous
      </button>
      <button disabled={!navigation.next} onClick={() => navigation.next?.()}>
        Next
      </button>
    </>
  );
};

const thread = (id: number, articles = 1) =>
  `<div class="comment-thread" data-location="${id}">${"<article>Comment</article>".repeat(articles)}</div>`;
const preview = (html: string) => `<div class="markdown-preview">${html}</div>`;
const next = () => screen.getByRole("button", { name: "Next" });
const previous = () => screen.getByRole("button", { name: "Previous" });
const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

beforeEach(() => {
  vi.stubGlobal("scrollY", 0);
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(
    function (this: HTMLElement) {
      if (this.tagName === "HEADER") return new DOMRect(0, 0, 800, 64);
      return new DOMRect(
        0,
        Number(this.dataset.location) * 300 - window.scrollY,
        800,
        100,
      );
    },
  );
  HTMLElement.prototype.scrollIntoView = vi.fn(function (this: HTMLElement) {
    vi.stubGlobal("scrollY", Number(this.dataset.location) * 300 - 96);
  });
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (originalScrollIntoView) {
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  } else {
    delete (HTMLElement.prototype as Partial<HTMLElement>).scrollIntoView;
  }
});

describe("useCommentNavigation", () => {
  it("visits each rendered location once in document order without wrapping", () => {
    const { container } = render(
      <Harness html={preview(thread(1, 2) + thread(2))} />,
    );
    expect(screen.getByRole("status").textContent).toBe("– / 2");
    expect(previous().hasAttribute("disabled")).toBe(true);
    fireEvent.click(next());
    expect(screen.getByRole("status").textContent).toBe("1 / 2");
    const first = container.querySelector<HTMLElement>('[data-location="1"]')!;
    expect(first.hasAttribute("data-comment-navigation-current")).toBe(true);
    expect(first.scrollIntoView).toHaveBeenCalledWith({
      block: "start",
      behavior: "instant",
    });
    expect(previous().hasAttribute("disabled")).toBe(true);
    fireEvent.click(next());
    expect(screen.getByRole("status").textContent).toBe("2 / 2");
    expect(first.hasAttribute("data-comment-navigation-current")).toBe(false);
    expect(next().hasAttribute("disabled")).toBe(true);
    fireEvent.click(previous());
    expect(screen.getByRole("status").textContent).toBe("1 / 2");
  });

  it("starts in either direction from the viewport and follows manual scrolling", () => {
    vi.stubGlobal("scrollY", 450);
    const { container } = render(
      <Harness
        html={`<header></header>${preview(thread(1) + thread(2) + thread(3))}`}
      />,
    );
    fireEvent.click(previous());
    expect(screen.getByRole("status").textContent).toBe("1 / 3");
    expect(
      container.querySelector<HTMLElement>('[data-location="1"]')!.style
        .scrollMarginTop,
    ).toBe("96px");
    act(() => {
      vi.stubGlobal("scrollY", 450);
      window.dispatchEvent(new Event("scroll"));
    });
    expect(screen.getByRole("status").textContent).toBe("– / 3");
    expect(
      container.querySelector("[data-comment-navigation-current]"),
    ).toBeNull();
    fireEvent.click(next());
    expect(screen.getByRole("status").textContent).toBe("2 / 3");
    act(() => window.dispatchEvent(new Event("scroll")));
    expect(screen.getByRole("status").textContent).toBe("2 / 3");
  });

  it("updates after resolution or deletion and ignores empty composers and other views", async () => {
    const { container } = render(
      <Harness
        html={
          preview(
            thread(1) +
              '<div class="comment-thread"><textarea></textarea></div>',
          ) + thread(9)
        }
      />,
    );
    fireEvent.click(next());
    const root = container.querySelector(".markdown-preview")!;
    act(() => root.insertAdjacentHTML("beforeend", thread(2)));
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("1 / 2"),
    );
    act(() => root.querySelector('[data-location="1"]')!.remove());
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("– / 1"),
    );
    fireEvent.click(next());
    expect(screen.getByRole("status").textContent).toBe("1 / 1");
    act(() => root.replaceChildren());
    await waitFor(() =>
      expect(screen.getByRole("status").textContent).toBe("– / 0"),
    );
    expect(next().hasAttribute("disabled")).toBe(true);
    expect(previous().hasAttribute("disabled")).toBe(true);
  });

  it("navigates comments in deletion blocks and clears highlights on unmount", () => {
    const { container, unmount } = render(
      <Harness
        html={preview(`<div class="document-diff-deletion">${thread(1)}</div>`)}
      />,
    );
    const target = container.querySelector<HTMLElement>(".comment-thread")!;
    fireEvent.click(next());
    expect(target.hasAttribute("data-comment-navigation-current")).toBe(true);
    unmount();
    expect(target.hasAttribute("data-comment-navigation-current")).toBe(false);
  });
});
