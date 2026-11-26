/**
 * A one-time message carried from the details page to /game-nights after the user
 * deleted or left a night (the details page no longer exists for them).
 * Stored in sessionStorage so it isn't visible in the URL and survives the navigation.
 * Plain text only; it's read once and removed.
 */

const FLASH_KEY = "gamenight_overview_flash";
const MAX_LENGTH = 500;

export function setOverviewFlash(message: string): void {
  try {
    window.sessionStorage.setItem(FLASH_KEY, message.slice(0, MAX_LENGTH));
  } catch {
    // Storage blocked: the user just won't see the message.
  }
}

/** Returns the message once and removes it. */
export function consumeOverviewFlash(): string | null {
  try {
    const message = window.sessionStorage.getItem(FLASH_KEY);
    window.sessionStorage.removeItem(FLASH_KEY);
    return message ? message.slice(0, MAX_LENGTH) : null;
  } catch {
    return null;
  }
}
