import Link from "next/link";
import { HeartHandshake, Inbox, Pencil } from "lucide-react";
import styles from "./welcome-screen.module.css";

const choices = [
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/grants", label: "Grants & Reports", icon: Pencil },
  { href: "/counseling", label: "Counseling sessions", icon: HeartHandshake },
];

export function WelcomeScreen() {
  return <main className={styles.welcome}>
    <h1 className={`display ${styles.heading}`}>What will we work on today?</h1>
    <div className={styles.actions}>
      {choices.map(({ href, icon: Icon, label }) => <Link key={label} href={href} prefetch={false} className={styles.button}><Icon size={22} />{label}</Link>)}
    </div>
  </main>;
}
