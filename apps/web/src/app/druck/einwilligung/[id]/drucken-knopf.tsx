"use client";

export function DruckenKnopf() {
  return (
    <button type="button" className="knopf self-end print:hidden" onClick={() => window.print()}>
      Drucken
    </button>
  );
}
