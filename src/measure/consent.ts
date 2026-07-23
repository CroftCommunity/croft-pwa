// Sharing consent (opt-in/out). LOCAL counting is always on and always visible on
// the Metrics page — it never leaves the device. This toggle governs only whether
// a flush would transmit (here: log the payload "as if" a remote received it, since
// no endpoint is configured). Default OFF: nothing is shared until the user opts in.
const KEY = 'croft-measure-consent';

export function getConsent(): boolean {
  try {
    return localStorage.getItem(KEY) === 'on';
  } catch {
    return false;
  }
}

export function setConsent(on: boolean): void {
  try {
    localStorage.setItem(KEY, on ? 'on' : 'off');
  } catch {
    // Storage denied (private mode) — the choice does not persist, but transmission
    // stays off by default, which is the safe direction to fail.
  }
}
