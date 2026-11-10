import { redirect } from "next/navigation";
import { praxisApi } from "@/server/lumiva";
import { Navigation } from "./navigation";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const { benutzer, praxis } = await (await praxisApi()).praxis.ich();
  if (!benutzer) redirect("/anmelden");
  if (!praxis) redirect("/einrichten");
  return (
    <div className="flex min-h-full flex-1 flex-col md:flex-row">
      <Navigation praxis={praxis.name} benutzer={benutzer.name} rolle={praxis.rolle} />
      {/* Unten Platz für die Navigationsleiste am Handy. */}
      <main className="mx-auto w-full min-w-0 max-w-6xl flex-1 px-4 pt-6 pb-28 md:px-8 md:py-10">
        {children}
      </main>
    </div>
  );
}
