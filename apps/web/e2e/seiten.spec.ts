import { expect, neuePraxis, test } from "./hilfen";

const SEITEN = [
  "/",
  "/kalender",
  "/patienten",
  "/patienten/neu",
  "/honorarnoten",
  "/aufgaben",
  "/kennzahlen",
  "/einstellungen",
];

test("alle Seiten laden ohne Fehler in der Konsole", async ({ page }) => {
  const fehler: string[] = [];
  page.on("pageerror", (e) => fehler.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") fehler.push(m.text());
  });
  await neuePraxis(page);
  await page.getByRole("button", { name: "Beispieldaten laden" }).click();
  await expect(page.getByRole("button", { name: "Beispieldaten laden" })).toHaveCount(0);
  for (const pfad of SEITEN) {
    const antwort = await page.goto(pfad);
    expect(antwort?.status(), pfad).toBe(200);
  }
  await page.goto("/patienten");
  await page.getByRole("row").nth(1).getByRole("link").first().click();
  await expect(page).toHaveURL(/\/patienten\/[0-9a-f-]{36}$/);
  expect(fehler).toEqual([]);
});

test.describe("am Handy", () => {
  test.use({ viewport: { width: 390, height: 844 } });

  test("keine Seite scrollt seitlich", async ({ page }) => {
    await neuePraxis(page);
    await page.getByRole("button", { name: "Beispieldaten laden" }).click();
    await expect(page.getByRole("button", { name: "Beispieldaten laden" })).toHaveCount(0);
    for (const pfad of SEITEN) {
      await page.goto(pfad);
      const breite = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(breite, pfad).toBeLessThanOrEqual(390);
    }
  });

  test("Navigation unten erreicht alle Bereiche und das Abmelden", async ({ page }) => {
    await neuePraxis(page);
    const leiste = page.getByRole("navigation", { name: "Hauptnavigation" });
    await leiste.getByRole("link", { name: "Kalender" }).click();
    await expect(page).toHaveURL(/\/kalender$/);
    await leiste.getByRole("button", { name: "Mehr" }).click();
    await page.getByRole("link", { name: "Einstellungen" }).click();
    await expect(page).toHaveURL(/\/einstellungen$/);
    await expect(page.getByRole("link", { name: "Einstellungen" })).toHaveCount(0);
    await leiste.getByRole("button", { name: "Mehr" }).click();
    await page.getByRole("button", { name: "Abmelden" }).click();
    await expect(page).toHaveURL(/\/anmelden$/);
  });

  test("Kalender zeigt die Woche als Liste und öffnet einen Termin", async ({ page }) => {
    await neuePraxis(page);
    await page.getByRole("button", { name: "Beispieldaten laden" }).click();
    await expect(page.getByRole("button", { name: "Beispieldaten laden" })).toHaveCount(0);
    await page.goto("/kalender");
    await expect(page.getByText("Montag")).toBeVisible();
    await page
      .getByRole("link", { name: /^\d{2}:\d{2}–\d{2}:\d{2} / })
      .first()
      .click();
    await expect(page).toHaveURL(/termin=/);
    await expect(
      page.getByRole("heading", { name: "Verschieben" }).or(page.getByText("Erledigt").first()),
    ).toBeVisible();
  });
});
