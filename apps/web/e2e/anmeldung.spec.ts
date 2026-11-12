import {
  expect,
  geheimnisse,
  PASSWORT,
  praxisAnlegen,
  registrieren,
  test,
  totp,
  zweiFaktorEinrichten,
} from "./hilfen";

test("ohne Anmeldung geht es zur Anmeldeseite", async ({ page }) => {
  await page.goto("/patienten");
  await expect(page).toHaveURL(/\/anmelden$/);
  await expect(page.getByText("Klarheit für deine Praxis.")).toBeVisible();
});

test("Konto erstellen, Praxis anlegen, abmelden und wieder anmelden", async ({ page }) => {
  const email = await registrieren(page, "Mag. Lena Test");
  await expect(page.getByRole("heading", { name: "Willkommen, Mag. Lena Test" })).toBeVisible();
  await praxisAnlegen(page, "Praxis Test");
  await expect(page.getByText("Praxis Test · Inhaber")).toBeVisible();

  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/anmelden$/);

  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("falsches-passwort-1");
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("E-Mail oder Passwort stimmt nicht.");

  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await expect(page.getByRole("heading", { name: "Bestätigungscode" })).toBeVisible();
  await page.getByLabel("Code").fill("000000");
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page.locator("p[role=alert]")).toContainText("Der Code stimmt nicht");

  await page.getByLabel("Code").fill(totp(geheimnisse.get(email) ?? ""));
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("Zwei-Faktor-Anmeldung ist Pflicht und geht auch mit Wiederherstellungscode", async ({
  page,
}) => {
  await page.goto("/anmelden");
  await page.getByRole("button", { name: "Konto erstellen" }).first().click();
  await page.getByLabel("Name mit Titel").fill("Mag. Pflicht Test");
  const email = `pflicht-${Date.now()}@lumiva.test`;
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.locator("form").getByRole("button", { name: "Konto erstellen" }).click();
  await expect(page).toHaveURL(/\/zwei-faktor$/);

  // Ohne zweiten Faktor führt jede Seite zurück zur Einrichtung, die API gibt nichts heraus.
  await page.goto("/patienten");
  await expect(page).toHaveURL(/\/zwei-faktor$/);
  await page.goto("/einrichten");
  await expect(page).toHaveURL(/\/zwei-faktor$/);
  const antwort = await page.request.get("/api/trpc/patienten.liste");
  expect(antwort.status()).toBe(403);

  const [ersatz] = await zweiFaktorEinrichten(page, email);
  await expect(page).toHaveURL(/\/einrichten$/);
  await praxisAnlegen(page);

  await page.getByRole("button", { name: "Abmelden" }).click();
  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await page.getByRole("button", { name: "Kein Zugriff auf die App?" }).click();
  await page.getByLabel("Wiederherstellungscode").fill(ersatz ?? "");
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("doppelte Registrierung wird abgelehnt", async ({ page, browser }) => {
  const email = await registrieren(page);
  const neu = await (await browser.newContext()).newPage();
  await neu.goto("/anmelden");
  await neu.getByRole("button", { name: "Konto erstellen" }).first().click();
  await neu.getByLabel("Name mit Titel").fill("Jemand");
  await neu.getByLabel("E-Mail").fill(email);
  await neu.getByLabel("Passwort").fill(PASSWORT);
  await neu.locator("form").getByRole("button", { name: "Konto erstellen" }).click();
  await expect(neu.locator("p[role=alert]")).toContainText("schon ein Konto");
});
