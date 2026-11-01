/**
 * Trust Network — site configuration.
 *
 * PUBLIC LAUNCH STATE (Nov 1, 2026): the directory is staged push-ready
 * for DIRECTORY_URL. Two owner taps put it on the public web (create the
 * GitHub repo + enable Pages — OWNER-STEPS.md, taps 1–2; the bench's
 * GitHub integration cannot create repos). The moment Pages is enabled,
 * DIRECTORY_URL below is the live address.
 * Capture is LIVE (flipped Nov 1, 2026, on the owner's word): the
 * network's own Apps Script capture (apps-script/Code.gs, bound to the
 * Sheet "Trust Network — Captures"; the web app was deployed Nov 1,
 * 2026 under tinglott@gmail.com) receives every form submission at
 * CAPTURE_ENDPOINT below. (Never the ARTISY Email Signups adapter —
 * different system, different sheet, by design.) Applications that
 * arrived by email to tinglott@gmail.com during the brief pre-live
 * window count toward the founding test exactly like form ones.
 * Nothing is ever faked: no queue on the visitor's device is presented
 * as a received application.
 *
 * Modes: "live" (Apps Script) | "email" (honest email fallback, nothing
 * stored) | "local" (on-device staging queue — never use on the public
 * site; it exists for offline review only).
 */
window.TRUST_CONFIG = {
  CAPTURE_MODE: 'live',            // 'live' | 'email' | 'local' — see header
  CAPTURE_ENDPOINT: 'https://script.google.com/macros/s/AKfycbygcdEszB0XrIf6G4ImaoCeMHCKXYn0f2K_t4AX25Bd4qCVvSzgp9GZ-bYAQ8x1h19VEg/exec', // the Trust Network script's OWN /exec URL
  DIRECTORY_URL: 'https://tinglott.github.io/trust-network/',
  NETWORK_NAME: 'The Trust Network',
  FOUNDING_PRICE_QUESTION: 19       // $19/month, as asked in the founding test
};
