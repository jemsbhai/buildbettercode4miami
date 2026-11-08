import { HeartHandshake, Inbox, Pencil } from "lucide-react";
import styles from "./welcome-screen.module.css";

const choices = [
  { label: "Inbox", icon: Inbox },
  { label: "Grants", icon: Pencil },
  { label: "Counseling session", icon: HeartHandshake },
];

export function WelcomeScreen() {
  return <section className={styles.welcome}>
    <h2 className={`display ${styles.heading}`}>What will we work on today?</h2>
    <div className={styles.actions}>
      {choices.map(({ icon: Icon, label }) => <button key={label} type="button" className={styles.button}><Icon size={22} />{label}</button>)}
    </div>
  </section>;
}
