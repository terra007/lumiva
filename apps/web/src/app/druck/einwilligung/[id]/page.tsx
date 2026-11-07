import { formatDatum } from "@/lib/format";
import { praxisApi } from "@/server/lumiva";
import { DruckenKnopf } from "./drucken-knopf";

export const metadata = { title: "Einwilligung Sitzungsaufnahme – LUMIVA" };

/**
 * Vorlage zur Einwilligung in die Aufnahme von Sitzungen (DSGVO Art. 9 Abs. 2 lit. a, Art. 7).
 * Vorlage, keine Rechtsberatung: vor dem Einsatz rechtlich prüfen lassen.
 */
export default async function Einwilligung({ params }: PageProps<"/druck/einwilligung/[id]">) {
  const { id } = await params;
  const lumiva = await praxisApi();
  const [p, praxis, ich] = await Promise.all([
    lumiva.patienten.details({ id }),
    lumiva.praxis.einstellungen(),
    lumiva.praxis.ich(),
  ]);
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-5 bg-white p-10 text-[15px] text-black leading-relaxed print:p-0">
      <DruckenKnopf />
      <header className="text-sm">
        <p className="font-semibold">{praxis.name}</p>
        <p>{ich.benutzer?.name}</p>
        <p>{praxis.anschrift}</p>
      </header>
      <h1 className="font-semibold text-2xl">
        Einwilligung in die Tonaufnahme von Psychotherapie-Sitzungen
      </h1>
      <p>
        Patient:in:{" "}
        <strong>
          {p.vorname} {p.nachname}
        </strong>
        , geboren am {formatDatum(p.geburtsdatum)}
      </p>
      <p>
        Ich bin damit einverstanden, dass meine Psychotherapie-Sitzungen als Tonaufnahme
        aufgezeichnet werden. Die Aufnahme dient ausschließlich dazu, die gesetzlich vorgeschriebene
        Dokumentation (§ 18 Psychotherapiegesetz 2024) zu erstellen.
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>
          Die Aufnahme wird auf einem Server der Praxis in der EU automatisch in Text umgewandelt
          und zusammengefasst. Sie wird nicht an andere Anbieter, etwa von KI-Diensten,
          weitergegeben.
        </li>
        <li>
          Die Tonaufnahme wird nicht gespeichert und sofort nach der Verarbeitung gelöscht.
          Gespeichert wird nur der von der Therapeut:in geprüfte Dokumentationseintrag,
          verschlüsselt und unter Verschwiegenheit (§ 37 Psychotherapiegesetz 2024).
        </li>
        <li>
          Die Einwilligung ist freiwillig. Wenn ich nicht einwillige, hat das keinen Einfluss auf
          meine Behandlung.
        </li>
        <li>
          Ich kann die Einwilligung jederzeit ohne Angabe von Gründen widerrufen, auch mündlich in
          einer Sitzung. Der Widerruf gilt für alle künftigen Sitzungen (Art. 7 Abs. 3 DSGVO).
        </li>
        <li>
          Ich habe die Rechte auf Auskunft, Berichtigung, Löschung und Einschränkung nach der DSGVO
          und kann mich bei der österreichischen Datenschutzbehörde beschweren.
        </li>
      </ul>
      <div className="mt-10 grid grid-cols-2 gap-10 text-sm">
        <div className="border-black border-t pt-1">Ort, Datum</div>
        <div className="border-black border-t pt-1">Unterschrift Patient:in</div>
      </div>
      <p className="mt-6 text-gray-500 text-xs print:hidden">
        Vorlage aus LUMIVA, keine Rechtsberatung. Bitte vor dem ersten Einsatz rechtlich prüfen
        lassen. Nach der Unterschrift das Datum in der Akte unter „Einwilligung Sitzungsaufnahme“
        eintragen.
      </p>
    </main>
  );
}
