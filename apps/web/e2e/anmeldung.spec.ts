import { expect, PASSWORT, praxisAnlegen, registrieren, test } from "./hilfen";

test("ohne Anmeldung geht es zur Anmeldeseite", async ({ page }) => {
  await page.goto("/patienten");
  await expect(page).toHaveURL(/\/anmelden$/);
  await expect(page.getByText("Klarheit für deine Praxis.")).toBeVisible();
});

test("Konto erstellen, Praxis anlegen, abmelden und wieder anmelden", async ({ page }) => {
  const email = await registrieren(page, "Mag. Lena Test");
  await expect(page.getByRole("heading", { name: "Willkommen, Mag. Lena Test" })).toBeVisible();
  await praxisAnlegen(page, "Praxis Test");
  await expect(page.getByText("Praxis Test · Inhaber:in")).toBeVisible();

  await page.getByRole("button", { name: "Abmelden" }).click();
  await expect(page).toHaveURL(/\/anmelden$/);

  await page.getByLabel("E-Mail").fill(email);
  await page.getByLabel("Passwort").fill("falsches-passwort-1");
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await expect(page.locator("p[role=alert]")).toHaveText("E-Mail oder Passwort stimmt nicht.");

  await page.getByLabel("Passwort").fill(PASSWORT);
  await page.locator("form").getByRole("button", { name: "Anmelden" }).click();
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
