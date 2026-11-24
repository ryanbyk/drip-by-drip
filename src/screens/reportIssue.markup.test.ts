import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReportIssueSheet, type ReportIssuePreview } from "../components/ReportIssueSheet";
import { settingsSnapshot } from "../storybook/fixtures";
import { StoryApp } from "../storybook/harness";
import { Settings } from "./Settings";

afterEach(() => {
  vi.unstubAllGlobals();
});

function renderSheet(preview?: ReportIssuePreview) {
  return renderToStaticMarkup(
    createElement(StoryApp, {
      snapshot: settingsSnapshot(),
      authUser: { id: "u1", email: "reader@example.com", provider: "email", displayName: "Reader" },
      children: createElement(ReportIssueSheet, {
        onClose: () => undefined,
        preview: {
          diagnostics: {
            appUrl: "https://app.drip-by-drip.com",
            path: "/",
            displayMode: "standalone",
            appearance: "System",
            signedIn: true,
            syncEnabled: true,
            notificationsEnabled: true,
          },
          ...preview,
        },
      }),
    }),
  );
}

describe("issue reporting UI", () => {
  it("shows Report an issue in Settings under About", () => {
    vi.stubGlobal("window", {
      navigator: { userAgent: "Mozilla/5.0" },
      matchMedia: () => ({ matches: false }),
    });
    const html = renderToStaticMarkup(
      createElement(StoryApp, {
        snapshot: settingsSnapshot(),
        children: createElement(Settings),
      }),
    );
    expect(html).toContain("Report an issue");
    expect(html).toContain("About Drip by drip");
  });

  it("renders the report form with category chips, attachment picker, optional email, and privacy reassurance", () => {
    const html = renderSheet({
      attachments: [
        { id: "a", name: "IMG_4021.png", sizeLabel: "1.4 MB", kind: "image" },
        { id: "b", name: "repro.mov", sizeLabel: "6.8 MB", kind: "video" },
      ],
    });
    expect(html).toContain("Report an issue");
    expect(html).toContain("Bug");
    expect(html).toContain("Suggestion");
    expect(html).toContain("Screenshots or recording (optional)");
    expect(html).toContain("Add screenshot or recording");
    expect(html).toContain("IMG_4021.png");
    expect(html).toContain("repro.mov");
    expect(html).toContain("Email (optional)");
    expect(html).toContain("reader@example.com");
    expect(html).toContain("Never includes your answers, reading notes, or book.");
    expect(html).toContain("Send report");
  });

  it("renders the confirmation state with Linear reference when submitted", () => {
    const html = renderSheet({ submitted: true, identifier: "CW-99" });
    expect(html).toContain("Report sent");
    expect(html).toContain("Reference CW-99");
    expect(html).toContain("Done");
  });
});
