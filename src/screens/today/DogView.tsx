import { Button } from "../../components/ui";

const DOG = [
  { letter: "D", title: "Discipline", body: "Help me show up and stay with it." },
  { letter: "O", title: "Open ears", body: "Let me hear you, not just read words." },
  { letter: "G", title: "Gladness", body: "Give me joy in your Word today." },
] as const;

export function DogView({ onContinue, onSkip }: { onContinue: () => void; onSkip: () => void }) {
  return (
    <div className="dog">
      <div className="nav-row">
        <p>Before you read</p>
        <button type="button" className="text-link" onClick={onSkip}>
          Skip
        </button>
      </div>
      <p className="kicker">Optional prayer</p>
      <h1>Ask God for a heart ready to read.</h1>
      <ul className="dog-list dog-card">
        {DOG.map((item) => (
          <li key={item.letter}>
            <span>{item.letter}</span>
            <div>
              <strong>{item.title}</strong>
              <p>{item.body}</p>
            </div>
          </li>
        ))}
      </ul>
      <p className="soft">Pray these in your own words — or skip straight to the passage.</p>
      <div className="footer">
        <Button onClick={onContinue}>Continue to passage</Button>
      </div>
    </div>
  );
}
