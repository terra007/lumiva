import { redirect } from "next/navigation";
import { api } from "@/server/lumiva";
import { AnmeldeFormular } from "./formular";

export default async function Anmelden() {
  const { benutzer } = await (await api()).praxis.ich();
  if (benutzer) redirect("/");
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-6 py-16">
      <header className="flex flex-col gap-2">
        <h1 className="font-semibold text-4xl tracking-tight">
          LUMIVA<span className="text-akzent">.</span>
        </h1>
        <p className="text-muted">Klarheit für deine Praxis.</p>
      </header>
      <AnmeldeFormular />
    </main>
  );
}
