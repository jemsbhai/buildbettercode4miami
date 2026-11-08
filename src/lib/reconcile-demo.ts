import type { WorkbookSnapshot, Cell } from "./reconcile-types";

const row = (...values: Cell["value"][]) => values.map(value => ({ value }));
export function demoWorkbooks(): WorkbookSnapshot[] {
  const headers = () => row("Gift ID", "Donor ID", "Name", "Email", "Phone", "Amount", "Date", "Currency", "Quantity");
  return [
    { id: "demo-community", name: "Fictional community gifts", version: "1", tabs: [
      { id: 0, title: "Donations", rows: [headers(), row("g1", "d1", " Rosa Delgado ", "rosa@example.test", "3055550101", "$125.00", "2026-07-10", "USD", "2"), row("g2", "d2", "Rosa Delgado", "ROSA@example.test", "3055550101", "20.00", "07/11/2026", "usd", "two"), row("g3", "d3", "Alex Gray", "alex@example.test", "", "12.345", "2026-02-30", "USD", 1)] },
      { id: 1, title: "Tickets", rows: [headers(), row("g4", "d1", "Rosa Delgado", "rosa@example.test", "3055550101", "40.00", "2026-08-03", "USD", 1)] },
      { id: 2, title: "Private counseling", rows: [row("private notes"), row("PRIVATE_FIXTURE_SENTINEL")] },
    ] },
    { id: "demo-outreach", name: "Fictional outreach gifts", version: "1", tabs: [
      { id: 0, title: "Donations", rows: [headers(), row("g1", "d1", "Rosa Delgado", "rosa@example.test", "3055550101", "125.00", "2026-07-10", "USD", 2), row("g5", "d4", "Jo Smith", "jo@example.test", "", "10", "2026-09-01", "USD", 1), row("", "d5", "Sam Lee", "sam@example.test", "", "25.00", "2026-09-02", "USD", 1)] },
    ] },
  ];
}
