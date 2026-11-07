import { Formular } from "@/components/formular";
import { patientBearbeiten } from "@/server/aktionen";
import { praxisApi } from "@/server/lumiva";
import { StammdatenFelder } from "../../stammdaten-felder";

export default async function PatientBearbeiten({
  params,
}: PageProps<"/patienten/[id]/bearbeiten">) {
  const { id } = await params;
  const p = await (await praxisApi()).patienten.details({ id });
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-semibold text-3xl tracking-tight">
        {p.vorname} {p.nachname} bearbeiten
      </h1>
      <div className="karte">
        <Formular aktion={patientBearbeiten} knopf="Speichern">
          <StammdatenFelder p={p} />
        </Formular>
      </div>
    </div>
  );
}
