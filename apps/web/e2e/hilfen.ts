import { test as basis, expect, type Page } from "@playwright/test";

/**
 * Jeder Test als eigener „Rechner“: Better Auth begrenzt Anmeldungen je IP-Adresse
 * (3 in 10 Sekunden), die Tests legen aber viele Konten an.
 */
export const test = basis.extend({
  // biome-ignore lint/correctness/noEmptyPattern: Playwright verlangt hier ein Objektmuster.
  extraHTTPHeaders: async ({}, use) => {
    const zufall = () => Math.floor(Math.random() * 250) + 1;
    await use({ "x-forwarded-for": `10.${zufall()}.${zufall()}.${zufall()}` });
  },
});
export { expect };

export const PASSWORT = "sicheres-passwort-123";

let zaehler = 0;
/** Eindeutige E-Mail je Test, damit sich Tests nicht in die Quere kommen. */
export function neueEmail(): string {
  return `test-${Date.now()}-${++zaehler}@lumiva.test`;
}

export async function registrieren(page: Page, name = "Mag. Maria Muster", email = neueEmail()) {
  await page.goto("/anmelden");
  await page.getByRole("button", { name: "Konto erstellen" }).first().click();
  await page.getByLabel("Name mit Titel").fill(name);
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.locator("form").getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/einrichten$/);
  return email;
}

export async function praxisAnlegen(page: Page, name = "Praxis Muster") {
  await page.getByLabel("Name der Praxis").fill(name);
  await page.getByLabel("Anschrift").fill("Musterstraße 1, 1010 Wien");
  await page.getByLabel("IBAN").fill("AT61 1904 3002 3457 3201");
  await page.getByRole("button", { name: "Praxis anlegen" }).click();
  await expect(page).toHaveURL(/\/$/);
}

/** Neues Konto mit Praxis, angemeldet. */
export async function neuePraxis(page: Page) {
  const email = await registrieren(page);
  await praxisAnlegen(page);
  return email;
}

export async function patientAnlegen(page: Page, vorname = "Anna", nachname = "Berger") {
  await page.goto("/patienten/neu");
  await page.getByLabel("Vorname").fill(vorname);
  await page.getByLabel("Nachname").fill(nachname);
  await page.getByLabel("Geburtsdatum").fill("1988-04-12");
  await page.getByLabel("Sozialversicherungsnummer").fill("1237 010180");
  await page.getByLabel("Anschrift").fill("Testgasse 2, 1020 Wien");
  await page.getByRole("button", { name: "Anlegen" }).click();
  await expect(page).toHaveURL(/\/patienten\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop() ?? "";
}

/** Termin heute um 09:00 anlegen und als erledigt vermerken. */
export async function erledigteSitzung(page: Page, patientId: string, name = "Anna Berger") {
  await page.goto(`/kalender?patient=${patientId}`);
  await page.getByRole("button", { name: "Termin anlegen" }).click();
  const termin = page.getByRole("link", { name: new RegExp(`09:00 ${name}`) }).first();
  await expect(termin).toBeVisible();
  await termin.click();
  await page.getByRole("button", { name: "Erledigt", exact: true }).click();
  await expect(page.locator("aside").getByText("Erledigt").first()).toBeVisible();
}

export async function dokuMitDiagnose(page: Page, patientId: string, text = "Erstgespräch") {
  await page.goto(`/patienten/${patientId}`);
  const icd = page.getByRole("combobox", { name: "Diagnosen (ICD-10)" });
  await icd.fill("F32.1");
  await icd.press("Enter");
  await expect(page.getByRole("button", { name: "F32.1 entfernen" })).toBeVisible();
  await page.getByLabel("Eintrag", { exact: true }).fill(text);
  await page.getByRole("button", { name: "Eintrag speichern" }).click();
  await expect(page.locator("ol p").getByText(text)).toBeVisible();
}

export async function honorarnoteAusstellen(page: Page, patientId: string) {
  await page.goto(`/patienten/${patientId}`);
  await page.getByRole("button", { name: "Honorarnote ausstellen" }).click();
  await expect(page.getByText("Keine offenen Sitzungen zum Abrechnen.")).toBeVisible();
  const nummer = page.getByRole("link", { name: /^\d{4}-\d{4}$/ }).first();
  return (await nummer.textContent()) ?? "";
}
