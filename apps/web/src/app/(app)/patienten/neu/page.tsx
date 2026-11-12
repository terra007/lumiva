import { Formular } from "@/components/formular";
import { Seitenkopf } from "@/components/seitenkopf";
import { patientAnlegen } from "@/server/aktionen";
import { StammdatenFelder } from "../stammdaten-felder";

export default function NeuerPatient() {
  return (
    <div className="flex max-w-2xl flex-col gap-6">
      <Seitenkopf titel="Neuer Patient" zurueck={{ href: "/patienten", text: "Patienten" }} />
      <div className="karte">
        <Formular aktion={patientAnlegen} knopf="Anlegen">
          <StammdatenFelder />
        </Formular>
      </div>
    </div>
  );
}
