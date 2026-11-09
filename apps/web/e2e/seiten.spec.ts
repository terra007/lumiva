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
});
