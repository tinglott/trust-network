/**
 * Trust Network — site configuration.
 *
 * PUBLIC LAUNCH STATE (Nov 1, 2026): the directory is staged push-ready
 * for DIRECTORY_URL. Two owner taps put it on the public web (create the
 * GitHub repo + enable Pages — OWNER-STEPS.md, taps 1–2; the bench's
 * GitHub integration cannot create repos). The moment Pages is enabled,
 * DIRECTORY_URL below is the live address.
 * Capture is in "email" mode: the network's own Apps Script capture
 * (apps-script/Code.gs, bound to the Sheet "Trust Network — Captures" in
 * tingsterlott12@gmail.com's Drive, created Nov 1, 2026) still needs its
 * one-time script-editor deployment by the owner (see OWNER-STEPS.md).
 * Until that deployment exists there is NO /exec endpoint, so the forms do
 * not collect anything: in "email" mode a submission stores nothing and
 * tells the visitor, in plain sight, to apply by email to
 * tinglott@gmail.com instead. Emailed applications count toward the
 * founding test exactly like form ones. Nothing is ever faked: no queue on
 * the visitor's device is presented as a received application.
 *
 * TO FINISH CAPTURE (owner steps — OWNER-STEPS.md):
 *   1. In the "Trust Network — Captures" Sheet: Extensions → Apps Script,
 *      paste apps-script/Code.gs, Deploy → Web app (Execute as: Me;
 *      Access: Anyone), copy the /exec URL.
 *   2. Paste that URL into CAPTURE_ENDPOINT below and set CAPTURE_MODE
 *      to "live". (Never the ARTISY Email Signups adapter — different
 *      system, different sheet, by design.)
 *
 * Modes: "live" (Apps Script) | "email" (honest email fallback, nothing
 * stored) | "local" (on-device staging queue — never use on the public
 * site; it exists for offline review only).
 */
window.TRUST_CONFIG = {
  CAPTURE_MODE: 'email',           // 'live' | 'email' | 'local' — see header
  CAPTURE_ENDPOINT: '',             // the Trust Network script's OWN /exec URL
  DIRECTORY_URL: 'https://tinglott.github.io/trust-network/',
  NETWORK_NAME: 'The Trust Network',
  FOUNDING_PRICE_QUESTION: 19       // $19/month, as asked in the founding test
};
