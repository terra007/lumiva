/** Fehler von Better Auth (Anmeldung, Zwei-Faktor) als Text für die Oberfläche. */
export function authFehlerText(error: {
  code?: string;
  status?: number;
  message?: string;
}): string {
  if (error.status === 429)
    return "Zu viele Versuche. Bitte warte eine Minute und versuche es dann erneut.";
  switch (error.code) {
    case "INVALID_EMAIL_OR_PASSWORD":
      return "E-Mail oder Passwort stimmt nicht.";
    case "INVALID_PASSWORD":
      return "Das Passwort stimmt nicht.";
    case "USER_ALREADY_EXISTS":
    case "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL":
      return "Mit dieser E-Mail gibt es schon ein Konto. Bitte melde dich an.";
    case "PASSWORD_TOO_SHORT":
      return "Das Passwort braucht mindestens 10 Zeichen.";
    case "INVALID_CODE":
    case "INVALID_BACKUP_CODE":
      return "Der Code stimmt nicht. Bitte prüfe ihn und die Uhrzeit am Handy.";
    case "INVALID_TWO_FACTOR_COOKIE":
    case "TWO_FACTOR_NOT_ENABLED":
      return "Die Anmeldung ist abgelaufen. Bitte gib E-Mail und Passwort erneut ein.";
    case "TOO_MANY_ATTEMPTS_REQUEST_NEW_CODE":
    case "ACCOUNT_TEMPORARILY_LOCKED":
      return "Zu viele falsche Codes. Die Anmeldung ist für 15 Minuten gesperrt.";
    default:
      return error.message ?? "Das hat nicht geklappt.";
  }
}
