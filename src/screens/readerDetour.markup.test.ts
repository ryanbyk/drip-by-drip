import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ESV_COPYRIGHT } from "../domain/esv";
import { esvReaderSnapshot } from "../storybook/fixtures";
import { StoryApp } from "../storybook/harness";
import { EsvReader } from "./today/EsvReader";
import { SomethingElse } from "./today/SomethingElse";

describe("in-app reader source link and detour reading", () => {
  it("shows Open in YouVersion (or chosen Bible source) in the in-app reader header", () => {
    const passage = {
      query: "Mark 1:1-11",
      canonical: "Mark 1:1–11",
      copyright: ESV_COPYRIGHT,
      blocks: [{ kind: "paragraph" as const, runs: [{ kind: "verse" as const, chapter: 1, verse: 1, text: "The beginning." }] }],
    };

    const youVersionHtml = renderToStaticMarkup(
      createElement(StoryApp, {
        snapshot: esvReaderSnapshot(),
        children: createElement(EsvReader, {
          reference: "Mark 1:1–11",
          passage,
          onBack: () => undefined,
          onReflect: () => undefined,
          onRead: () => undefined,
        }),
      }),
    );
    expect(youVersionHtml).toContain("Open in YouVersion");
    expect(youVersionHtml).toContain("https://www.bible.com/bible/59/MRK.1.1-11.ESV");

    const gatewaySnapshot = esvReaderSnapshot();
    gatewaySnapshot.prefs.bibleSource = "biblegateway";
    const gatewayHtml = renderToStaticMarkup(
      createElement(StoryApp, {
        snapshot: gatewaySnapshot,
        children: createElement(EsvReader, {
          reference: "Mark 1:1–11",
          passage,
          onBack: () => undefined,
          onReflect: () => undefined,
          onRead: () => undefined,
        }),
      }),
    );
    expect(gatewayHtml).toContain("Open in Bible Gateway");
  });

  it("offers Read in app on Something else when in-app ESV is available", () => {
    const html = renderToStaticMarkup(
      createElement(StoryApp, {
        snapshot: esvReaderSnapshot(),
        children: createElement(SomethingElse, {
          bookName: "Mark",
          backupLabel: "Your place in Mark stays saved.",
          initialRef: "Psalm 46",
          onUse: () => undefined,
          onBackToBook: () => undefined,
          onReflect: () => undefined,
          onRead: () => undefined,
          onReadInApp: () => undefined,
        }),
      }),
    );
    expect(html).toContain("Read in app");
    expect(html).toContain("Open Psalm 46 in YouVersion");
    expect(html).toContain("I read it");
  });
});
