import {
  expect,
  kontoErstellen,
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
  const { email, geheimnis } = await registrieren(page, "Mag. Lena Test");
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

  await page.getByLabel("Code").fill(totp(geheimnis));
  await page.getByRole("button", { name: "Bestätigen" }).click();
  await expect(page).toHaveURL(/\/$/);
});

test("Zwei-Faktor-Anmeldung ist Pflicht und geht auch mit Wiederherstellungscode", async ({
  page,
}) => {
  const email = await kontoErstellen(page, "Mag. Pflicht Test");

  // Ohne zweiten Faktor führt jede Seite zurück zur Einrichtung, die API gibt nichts heraus.
  await page.goto("/patienten");
  await expect(page).toHaveURL(/\/zwei-faktor$/);
  await page.goto("/einrichten");
  await expect(page).toHaveURL(/\/zwei-faktor$/);
  const antwort = await page.request.get("/api/trpc/patienten.liste");
  expect(antwort.status()).toBe(403);

  const {
    codes: [ersatz],
  } = await zweiFaktorEinrichten(page);
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

test("Sitzung von vor der Einrichtung bekommt danach keinen Zugriff", async ({ page, browser }) => {
  const email = await kontoErstellen(page, "Mag. Alt Test");

  // Ein zweites Gerät meldet sich nur mit Passwort an, während der zweite Faktor noch fehlt.
  const anderes = await (await browser.newContext()).newPage();
  await anderes.goto("/anmelden");
  await anderes.getByLabel("E-Mail").fill(email);
  await anderes.getByLabel("Passwort").fill(PASSWORT);
  await anderes.locator("form").getByRole("button", { name: "Anmelden" }).click();
  await expect(anderes).toHaveURL(/\/zwei-faktor$/);

  await zweiFaktorEinrichten(page);
  await expect(page).toHaveURL(/\/einrichten$/);

  await anderes.goto("/patienten");
  await expect(anderes).toHaveURL(/\/anmelden$/);
});

test("doppelte Registrierung wird abgelehnt", async ({ page, browser }) => {
  const { email } = await registrieren(page);
  const neu = await (await browser.newContext()).newPage();
  await neu.goto("/anmelden");
  await neu.getByRole("button", { name: "Konto erstellen" }).first().click();
  await neu.getByLabel("Name mit Titel").fill("Jemand");
  await neu.getByLabel("E-Mail").fill(email);
  await neu.getByLabel("Passwort").fill(PASSWORT);
  await neu.locator("form").getByRole("button", { name: "Konto erstellen" }).click();
  await expect(neu.locator("p[role=alert]")).toContainText("schon ein Konto");
});

test("in den Einstellungen neue Codes erzeugen und ein neues Handy einrichten", async ({
  page,
}) => {
  await registrieren(page);
  await praxisAnlegen(page);
  await page.goto("/einstellungen");
  await expect(page.getByText("Eingeschaltet")).toBeVisible();

  await page.getByRole("button", { name: "Neue Wiederherstellungscodes" }).click();
  await page.getByLabel("Zur Bestätigung dein Passwort").fill(PASSWORT);
  await page.getByRole("button", { name: "Neue Codes erzeugen" }).click();
  await expect(page.getByText("Wiederherstellungscodes:")).toBeVisible();
  await page.getByRole("button", { name: "Ich habe die Codes gesichert" }).click();

  await page.getByRole("button", { name: "Neues Handy einrichten" }).click();
  await page.getByLabel("Zur Bestätigung dein Passwort").fill(PASSWORT);
  await page.getByRole("button", { name: "Weiter" }).click();
  await expect(page.getByRole("img", { name: "QR-Code für die Authenticator-App" })).toBeVisible();
  const geheimnis = (await page.locator("code").first().textContent()) ?? "";
  await page.getByLabel("Den 6-stelligen Code aus der App eingeben").fill(totp(geheimnis));
  await page.getByRole("button", { name: "Bestätigen und einschalten" }).click();
  await page.getByRole("button", { name: "Ich habe die Codes gesichert" }).click();
  await expect(page.getByText("Eingeschaltet")).toBeVisible();
  // Die eigene, neue Sitzung bleibt gültig.
  await page.goto("/patienten");
  await expect(page).toHaveURL(/\/patienten$/);
});
