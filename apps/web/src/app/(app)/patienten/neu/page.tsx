import { Formular } from "@/components/formular";
import { patientAnlegen } from "@/server/aktionen";
import { StammdatenFelder } from "../stammdaten-felder";

export default function NeuerPatient() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <h1 className="font-semibold text-3xl tracking-tight">Neuer Patient</h1>
      <div className="karte">
        <Formular aktion={patientAnlegen} knopf="Anlegen">
          <StammdatenFelder />
        </Formular>
      </div>
    </div>
  );
}
