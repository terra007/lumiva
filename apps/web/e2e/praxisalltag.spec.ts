import {
  dokuMitDiagnose,
  erledigteSitzung,
  expect,
  honorarnoteAusstellen,
  neuePraxis,
  patientAnlegen,
  test,
} from "./hilfen";

test("Patientin, Sitzung, Dokumentation und Honorarnote", async ({ page }) => {
  await neuePraxis(page);
  const patientId = await patientAnlegen(page);
  await expect(page.getByRole("heading", { name: "Anna Berger" })).toBeVisible();

  await erledigteSitzung(page, patientId);

  // Ohne Diagnose keine Honorarnote für den Kostenzuschuss.
  await page.goto(`/patienten/${patientId}`);
  await page.getByRole("button", { name: "Honorarnote ausstellen" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Für den Kostenzuschuss fehlt noch");

  await dokuMitDiagnose(page, patientId);
  const nummer = await honorarnoteAusstellen(page, patientId);
  expect(nummer).toMatch(/^\d{4}-0001$/);

  // PDF der Honorarnote.
  const pdf = await page.request.get(
    (await page.getByRole("link", { name: nummer }).getAttribute("href")) ?? "",
  );
  expect(pdf.status()).toBe(200);
  expect(pdf.headers()["content-type"]).toBe("application/pdf");
  expect((await pdf.body()).subarray(0, 4).toString()).toBe("%PDF");

  // Liste der Honorarnoten: bezahlt, wieder offen, storniert.
  await page.goto("/honorarnoten");
  const zeile = page.getByRole("row", { name: new RegExp(nummer) });
  await expect(zeile.locator(".abzeichen", { hasText: "Offen" })).toBeVisible();
  await zeile.getByRole("button", { name: "Bezahlt" }).click();
  await expect(zeile.locator(".abzeichen", { hasText: "Bezahlt" })).toBeVisible();
  await zeile.getByRole("button", { name: "Doch offen" }).click();
  await expect(zeile.locator(".abzeichen", { hasText: "Offen" })).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await zeile.getByRole("button", { name: "Stornieren" }).click();
  await expect(zeile.locator(".abzeichen", { hasText: "Storniert" })).toBeVisible();

  // Nach dem Storno ist die Sitzung wieder abrechenbar.
  await page.goto(`/patienten/${patientId}`);
  await expect(page.getByRole("button", { name: "Honorarnote ausstellen" })).toBeVisible();
});

test("Dokumentation löschen und aus dem Papierkorb wiederherstellen", async ({ page }) => {
  await neuePraxis(page);
  const patientId = await patientAnlegen(page, "Ben", "Huber");
  await dokuMitDiagnose(page, patientId, "Eintrag zum Löschen");
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "Eintrag löschen" }).click();
  await expect(page.getByText("Noch keine Einträge.")).toBeVisible();
  await page.getByRole("link", { name: /Papierkorb/ }).click();
  await expect(page.getByText("Eintrag zum Löschen")).toBeVisible();
  await page.getByRole("button", { name: "Wiederherstellen" }).click();
  await expect(page.getByText("Der Papierkorb ist leer.")).toBeVisible();
});

test("Zusammenfassung mit dem Bleistift bearbeiten", async ({ page }) => {
  await neuePraxis(page);
  const patientId = await patientAnlegen(page, "Clara", "Moser");
  await dokuMitDiagnose(page, patientId, "Erste Fassung");
  await page.getByRole("button", { name: "Zusammenfassung bearbeiten" }).click();
  await page.getByLabel("Zusammenfassung", { exact: true }).fill("Korrigierte Fassung");
  await page.locator("ol").getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.locator("ol p").getByText("Korrigierte Fassung")).toBeVisible();
  await expect(page.getByText(/geändert/)).toBeVisible();
  await page.reload();
  await expect(page.locator("ol p").getByText("Korrigierte Fassung")).toBeVisible();
  await expect(page.getByText("Erste Fassung")).toHaveCount(0);
});

test("Aufgaben anlegen und erledigen", async ({ page }) => {
  await neuePraxis(page);
  await page.goto("/aufgaben");
  await page.getByLabel("Neue Aufgabe").fill("Befund anfordern");
  await page.getByRole("button", { name: "Hinzufügen" }).click();
  const aufgabe = page.getByRole("listitem").filter({ hasText: "Befund anfordern" });
  await expect(aufgabe).toBeVisible();
  await aufgabe.getByRole("button", { name: "✓" }).click();
  await expect(page.getByRole("button", { name: "↺" })).toBeVisible();
});

test("Praxisdaten und Honorare in den Einstellungen ändern", async ({ page }) => {
  await neuePraxis(page);
  await page.goto("/einstellungen");
  await page.getByLabel("Telefon").fill("+43 1 234 56 78");
  await page.getByRole("button", { name: "Speichern" }).first().click();
  await page.reload();
  await expect(page.getByLabel("Telefon")).toHaveValue("+43 1 234 56 78");
});

test("Beispieldaten füllen eine leere Praxis", async ({ page }) => {
  await neuePraxis(page);
  await page.getByRole("button", { name: "Beispieldaten laden" }).click();
  await page.goto("/patienten");
  await expect(page.getByRole("row")).toHaveCount(7);
});

test("Klick ins Kalenderraster schlägt Tag und Uhrzeit für den neuen Termin vor", async ({
  page,
}) => {
  await neuePraxis(page);
  await patientAnlegen(page, "Clara", "Moser");
  await page.goto("/kalender?woche=2026-11-09");
  await page.getByRole("link", { name: "Neuer Termin am 11.11.2026 um 14:30" }).click();
  await expect(page).toHaveURL(/datum=2026-11-11&uhrzeit=14:30/);
  const formular = page.locator("#neuer-termin");
  await expect(formular.getByLabel("Datum")).toHaveValue("2026-11-11");
  await expect(formular.getByLabel("Uhrzeit")).toHaveValue("14:30");
  await formular.getByRole("button", { name: "Termin anlegen" }).click();
  await expect(page.getByRole("link", { name: /14:30 Clara Moser/ })).toBeVisible();
});
