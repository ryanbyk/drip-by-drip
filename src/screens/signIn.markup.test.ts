import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AuthFixtureProvider } from "../state/AuthFixture";
import { SignIn } from "./SignIn";

function markup(preview: { email: string; installed: boolean; linkSent?: boolean; codeSent?: boolean }) {
  return renderToStaticMarkup(
    createElement(AuthFixtureProvider, {
      user: null,
      children: createElement(SignIn, { onSkip: () => undefined, preview }),
    }),
  );
}

describe("sign-in surfaces", () => {
  it("offers a code on the browser form, the installed form, and the link sheet", () => {
    const browser = markup({ email: "", installed: false });
    expect(browser).toContain("Email me a sign-in link");
    expect(browser).toContain("Email me a code");
    expect(browser).not.toContain("On iPhone, a sign-in link may open Safari");

    const installed = markup({ email: "", installed: true });
    expect(installed).toContain("Email me a code");
    expect(installed).toContain("Email me a sign-in link");
    expect(installed).toContain("On iPhone, a sign-in link may open Safari");

    const linkSheet = markup({ email: "ryan@example.com", installed: false, linkSent: true });
    expect(linkSheet).toContain("Enter a code instead");
    expect(linkSheet).not.toContain("On iPhone, a sign-in link may open Safari");
  });

  it("asks for the email code without pinning the length to 6 digits", () => {
    const codeSheet = markup({ email: "ryan@example.com", installed: true, codeSent: true });
    expect(codeSheet).toContain("We sent a code to");
    expect(codeSheet).toContain("Code from email");
    expect(codeSheet).not.toContain("6-digit");
  });
});
