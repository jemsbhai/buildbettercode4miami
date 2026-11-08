import { HeartHandshake, Inbox, Pencil } from "lucide-react";

const choices = [
  { label: "Inbox", icon: Inbox },
  { label: "Grants", icon: Pencil },
  { label: "Counseling session", icon: HeartHandshake },
];

export function WelcomeScreen() {
  return <section className="welcome">
    <h2 className="display welcome-heading">What will we work on today?</h2>
    <div className="welcome-actions">
      {choices.map(({ icon: Icon, label }) => <button key={label} type="button" className="welcome-button"><Icon size={22} />{label}</button>)}
    </div>
  </section>;
}
