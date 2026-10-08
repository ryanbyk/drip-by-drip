import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SwitchBookConfirm } from "./today/MoreViews";

function confirm(props: Partial<Parameters<typeof SwitchBookConfirm>[0]> = {}) {
  return renderToStaticMarkup(
    createElement(SwitchBookConfirm, {
      fromName: "Mark",
      toName: "James",
      sameBook: false,
      startLabel: "Start at James 3",
      detail: "James 3",
      timing: "now",
      plan: false,
      todayDone: false,
      onClose: () => undefined,
      onConfirm: () => undefined,
      ...props,
    }),
  );
}

describe("switch book confirmation", () => {
  it("renders the saved-place question before leaving Mark", () => {
    const html = confirm();
    expect(html).toContain("Switch book?");
    expect(html).toContain("Switch from Mark to James? Your place in Mark is saved, so you can come back to it.");
    expect(html).toContain("Today’s drip switches to James 3.");
    expect(html).toContain("Switch to James");
    expect(html).toContain("Cancel");
  });

  it("says a finished day starts the new book tomorrow", () => {
    const html = confirm({ timing: "tomorrow", todayDone: true });
    expect(html).toContain("James 3 starts tomorrow. Today’s reading is already done.");
    expect(html).toContain("Start James tomorrow");
  });

  it("says a plan stays as it is", () => {
    const html = confirm({ plan: true, detail: "James 3" });
    expect(html).toContain("This changes your book to James 3. The plan stays as it is.");
  });
});
