import { bibleUrl } from "../../domain/refs";
import { bookRecap, type ChapterSitting } from "../../domain/recap";
import { useApp } from "../../state/AppState";
import { ChevronLeft, CircleQuestionMark, CornerDownRight, MoonStar, NotebookPen, Share } from "../../components/Icons";
import { Button } from "../../components/ui";

export function RecapView({ onNext }: { onNext: () => void }) {
  const { snapshot, today, share } = useApp();
  const recap = bookRecap(snapshot, today);
  const rows = chunk(recap.sittings, 8);

  return (
    <div className="recap">
      <div className="nav-row">
        <button type="button" className="icon-btn" aria-label="Back" onClick={onNext}>
          <ChevronLeft size={18} />
        </button>
        <p className="recap-title">Recap</p>
        <button type="button" className="icon-btn" aria-label="Share this look back" onClick={() => void share(recap.bookName)}>
          <Share size={18} />
        </button>
      </div>
      <header className="recap-head">
        {recap.from && recap.to ? (
          <p className="eyebrow">
            {recap.from} – {recap.to}
          </p>
        ) : (
          <p className="eyebrow">A look back</p>
        )}
        <h1 className="display-40">{recap.bookName}, drip by drip.</h1>
      </header>
      <section>
        <p className="eyebrow">Every chapter</p>
        <div className="chapter-mosaic" aria-label="Chapters you read">
          {rows.map((row, rowIndex) => (
            <div key={rowIndex} className="chapter-row">
              {row.map((sitting, index) => {
                const number = rowIndex * 8 + index + 1;
                return (
                  <span key={number} className={sitting === "two" ? "chapter-cell is-two" : "chapter-cell"}>
                    {number}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
        <ul className="legend">
          <li>
            <i className="swatch chapter-cell" /> One sitting
          </li>
          <li>
            <i className="swatch chapter-cell is-two" /> Two sittings
          </li>
        </ul>
      </section>
      <div className="recap-stats" aria-label="A quiet look back">
        <div>
          <strong>{recap.readingDays}</strong>
          <span>reading days</span>
        </div>
        <div>
          <strong>{recap.longest}</strong>
          <span>longest streak</span>
        </div>
        <div>
          <strong>
            {recap.powerWeeks.hit} of {recap.powerWeeks.total}
          </strong>
          <span>weeks with Power of Four</span>
        </div>
        <div>
          <strong>{recap.usualTime}</strong>
          <span>your usual time</span>
        </div>
      </div>
      <section>
        <p className="eyebrow">Along the way</p>
        <div className="along">
          <div className="along-row">
            <span className="note-icon" aria-hidden="true">
              <NotebookPen size={16} />
            </span>
            <span>
              <strong>
                {recap.reflections} {recap.reflections === 1 ? "reflection" : "reflections"}
              </strong>
              <span>{recap.topVerse ? `Most-tagged verse: ${recap.bookName} ${recap.topVerse}` : "Notes you kept along the way"}</span>
            </span>
            {recap.topVerse ? (
              <a className="along-action" href={bibleUrl(`${recap.bookName} ${recap.topVerse}`)} target="_blank" rel="noopener noreferrer">
                Read
              </a>
            ) : null}
          </div>
          <div className="along-row">
            <span className="note-icon" aria-hidden="true">
              <CornerDownRight size={16} />
            </span>
            <span>
              <strong>
                {recap.detourRefs.length} {recap.detourRefs.length === 1 ? "detour" : "detours"}
              </strong>
              <span>{recap.detourRefs.length > 0 ? recap.detourRefs.slice(0, 4).join(" · ") : "Your place stayed put"}</span>
            </span>
          </div>
          <div className="along-row">
            <span className="note-icon" aria-hidden="true">
              <CircleQuestionMark size={16} />
            </span>
            <span>
              <strong>
                {recap.huhRefs.length} “Huh?” {recap.huhRefs.length === 1 ? "moment" : "moments"}
              </strong>
              <span>{recap.huhRefs.length > 0 ? recap.huhRefs.slice(0, 3).join(" · ") : "Nothing you marked to revisit"}</span>
            </span>
            {recap.huhRefs[0] ? (
              <a className="along-action" href={bibleUrl(recap.huhRefs[0])} target="_blank" rel="noopener noreferrer">
                Revisit
              </a>
            ) : null}
          </div>
          <div className="along-row">
            <span className="grace-mini" aria-hidden="true">
              <MoonStar size={16} />
            </span>
            <span>
              <strong>
                {recap.restDays} rest {recap.restDays === 1 ? "day" : "days"}
              </strong>
              <span>Not today — and that’s ok</span>
            </span>
          </div>
        </div>
      </section>
      <p className="recap-note">Not a score — just a look back at the drips. Every one was grace.</p>
      <div className="footer">
        <Button onClick={onNext}>Choose what’s next</Button>
      </div>
    </div>
  );
}

function chunk(items: ChapterSitting[], size: number): ChapterSitting[][] {
  const rows: ChapterSitting[][] = [];
  for (let index = 0; index < items.length; index += size) rows.push(items.slice(index, index + size));
  return rows;
}
