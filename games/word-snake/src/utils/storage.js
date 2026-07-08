export function getStoredBoolean(key, fallback = false) {
  try {
    return window.localStorage.getItem(key) === 'true';
  } catch {
    return fallback;
  }
}

export function setStoredBoolean(key, value) {
  try {
    window.localStorage.setItem(key, value ? 'true' : 'false');
  } catch {
    // localStorage can be unavailable in privacy modes; the game can still run.
  }
}
