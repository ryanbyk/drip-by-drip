import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { askTimeSnapshot, framingSnapshot } from "../storybook/fixtures";
import { AuthFixtureProvider } from "../state/AuthFixture";
import { AppProvider } from "../state/AppState";
import { Onboarding } from "./Onboarding";

beforeAll(() => {
  vi.stubGlobal("navigator", { onLine: true });
});

function markup(create: () => ReturnType<typeof framingSnapshot>) {
  const snapshot = create();
  return renderToStaticMarkup(
    createElement(AppProvider, {
      initialSnapshot: snapshot,
      children: createElement(AuthFixtureProvider, {
        user: null,
        children: createElement(Onboarding, { onSignIn: () => undefined }),
      }),
    }),
  );
}

describe("onboarding sign-in", () => {
  it("offers account sign-in on the first screen", () => {
    const html = markup(framingSnapshot);
    expect(html).toContain("I already have an account");
    expect(html).toContain("btn btn-quiet");
    expect(html).toContain("One small drip, every day.");
  });

  it("leaves later onboarding steps focused on setup", () => {
    expect(markup(askTimeSnapshot)).not.toContain("I already have an account");
  });
});
