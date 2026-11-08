import {
  dokuMitDiagnose,
  erledigteSitzung,
  expect,
  honorarnoteAusstellen,
  neuePraxis,
  patientAnlegen,
  test,
} from "./hilfen";

test("SumUp-Demo: Zahlung am Terminal und über den Zahllink", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await neuePraxis(page);

  await page.goto("/einstellungen");
  await page.getByRole("button", { name: "Demo ohne SumUp-Konto" }).click();
  await expect(page.getByText("Demo-Modus: Terminal und QR-Zahlung")).toBeVisible();

  const patientId = await patientAnlegen(page);
  await dokuMitDiagnose(page, patientId);
  await erledigteSitzung(page, patientId);
  const ersteNote = await honorarnoteAusstellen(page, patientId);

  // Terminal: nach einigen Sekunden bezahlt.
  await page.goto("/honorarnoten");
  let zeile = page.getByRole("row", { name: new RegExp(ersteNote) });
  await zeile.getByRole("button", { name: "Terminal" }).click();
  await expect(zeile.getByText("Am Terminal bezahlen …")).toBeVisible();
  await expect(zeile.locator(".abzeichen", { hasText: "Bezahlt" })).toBeVisible({
    timeout: 20_000,
  });

  // Zweite Note: online über den Zahllink.
  await page.goto(`/kalender?patient=${patientId}`);
  await page.getByLabel("Uhrzeit").fill("11:00");
  await page.getByRole("button", { name: "Termin anlegen" }).click();
  await page.getByRole("link", { name: /11:00 Anna Berger/ }).click();
  await page.getByRole("button", { name: "Erledigt", exact: true }).click();
  await expect(page.locator("aside").getByText("Erledigt").first()).toBeVisible();
  const zweiteNote = await honorarnoteAusstellen(page, patientId);

  await page.goto("/honorarnoten");
  zeile = page.getByRole("row", { name: new RegExp(zweiteNote) });
  await zeile.getByRole("button", { name: "Zahllink" }).click();
  await expect(zeile.getByText("Link kopiert.")).toBeVisible();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  expect(link).toMatch(/\/bezahlen\/[0-9a-f-]{36}\.[\w-]+$/);

  // Die Patientin sieht nur Praxis, Nummer und Betrag, keinen Namen.
  const patientin = await (await context.browser()?.newContext())?.newPage();
  if (!patientin) throw new Error("Kein zweiter Browser");
  await patientin.goto(link);
  await expect(patientin.getByRole("heading", { name: `Honorarnote ${zweiteNote}` })).toBeVisible();
  await expect(patientin.getByText("Anna")).toHaveCount(0);
  await patientin.getByRole("button", { name: "Mit Karte bezahlen" }).click();
  await expect(patientin.getByText("Demo: So sieht die Zahlseite von SumUp aus.")).toBeVisible();
  await patientin.getByRole("button", { name: "Bezahlen" }).click();
  await expect(patientin.getByText("Danke, der Betrag ist bezahlt.")).toBeVisible();

  await page.reload();
  await expect(zeile.locator(".abzeichen", { hasText: "Bezahlt" })).toBeVisible();
});

test("ungültiger Zahllink zeigt nichts von der Praxis", async ({ page }) => {
  await page.goto("/bezahlen/00000000-0000-4000-8000-000000000000.falsch");
  await expect(page.getByText("Dieser Zahlungslink ist ungültig.")).toBeVisible();
});

test("Kassieren gleich nach der Sitzung, Honorarnote später gesammelt", async ({ page }) => {
  await neuePraxis(page);
  await page.goto("/einstellungen");
  await page.getByRole("button", { name: "Demo ohne SumUp-Konto" }).click();
  await expect(page.getByText("Demo-Modus: Terminal und QR-Zahlung")).toBeVisible();

  const patientId = await patientAnlegen(page);
  await dokuMitDiagnose(page, patientId);
  await erledigteSitzung(page, patientId);

  // Direkt in der Akte: Betrag an das Terminal, nach einigen Sekunden bezahlt.
  await page.goto(`/patienten/${patientId}`);
  const termine = page.locator("section", { has: page.getByRole("heading", { name: "Termine" }) });
  await termine.getByRole("button", { name: /^Kassieren € 90,00/ }).click();
  await expect(termine.getByText("Am Terminal bezahlen …")).toBeVisible();
  await expect(termine.locator(".abzeichen", { hasText: "Bezahlt" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(termine.getByRole("button", { name: /^Kassieren/ })).toHaveCount(0);
  // In der Liste zum Ausstellen: bezahlt markiert, kein Terminal-Knopf mehr.
  const ausstellen = page.locator("section", {
    has: page.getByRole("heading", { name: "Honorarnote ausstellen" }),
  });
  await page.reload();
  await expect(ausstellen.locator(".abzeichen", { hasText: "Bezahlt" })).toBeVisible();
  await expect(ausstellen.getByRole("button", { name: "Terminal" })).toHaveCount(0);

  // Die Honorarnote über die bezahlte Sitzung ist gleich bezahlt.
  const nummer = await honorarnoteAusstellen(page, patientId);
  await page.goto("/honorarnoten");
  const zeile = page.getByRole("row", { name: new RegExp(nummer) });
  await expect(zeile.locator(".abzeichen", { hasText: "Bezahlt" })).toBeVisible();
});

test("Terminal je Sitzung in der Liste zum Ausstellen", async ({ page }) => {
  await neuePraxis(page);
  await page.goto("/einstellungen");
  await page.getByRole("button", { name: "Demo ohne SumUp-Konto" }).click();
  await expect(page.getByText("Demo-Modus: Terminal und QR-Zahlung")).toBeVisible();
  const patientId = await patientAnlegen(page);
  await erledigteSitzung(page, patientId);

  await page.goto(`/patienten/${patientId}`);
  const ausstellen = page.locator("section", {
    has: page.getByRole("heading", { name: "Honorarnote ausstellen" }),
  });
  await ausstellen.getByRole("button", { name: "Terminal" }).click();
  await expect(ausstellen.getByText("Am Terminal bezahlen …")).toBeVisible();
  await expect(ausstellen.locator(".abzeichen", { hasText: "Bezahlt" })).toBeVisible({
    timeout: 20_000,
  });
});
