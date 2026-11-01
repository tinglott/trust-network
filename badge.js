/**
 * The Trust Network — member badge.
 *
 * A member pastes ONE snippet on their own site (see BADGE.md):
 *   <div class="trust-network-badge" data-member="artisy"></div>
 *   <script src="https://YOUR-DIRECTORY/badge.js" async></script>
 *
 * The badge reads the directory's LIVE member data at render time and:
 *   - member verified === true  → renders "✓ Verified member" + the date
 *     their identity, storefront, and ownership were checked.
 *   - member not verified / not found / data unreachable → renders a plain
 *     "Listed in The Trust Network" link — the word "Verified" never appears.
 *
 * There is no image to copy and no static "verified" graphic to steal:
 * if verification is suspended in the directory data, every embedded badge
 * stops claiming it on the next page load. That is the whole design.
 */
(function () {
  'use strict';

  var script = document.currentScript;
  var base = '';
  if (script && script.src) {
    base = script.src.replace(/badge\.js(\?.*)?$/, '');
  }

  function esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render(el, member) {
    var id = el.getAttribute('data-member');
    var href = base + 'index.html#member-' + encodeURIComponent(id || '');
    var verified = !!member && member.verified === true;
    el.innerHTML =
      '<a href="' + esc(href) + '" target="_blank" rel="noopener" ' +
      'style="display:inline-flex;align-items:center;gap:8px;padding:8px 14px;border-radius:999px;' +
      'border:1px solid ' + (verified ? '#2dd4bf' : '#94a3b8') + ';' +
      'background:#0a1628;color:#f8fafc;font:600 13px/1.2 system-ui,sans-serif;text-decoration:none">' +
      (verified
        ? '<span style="color:#2dd4bf">✓</span> Verified member — The Trust Network' +
          (member.verifiedDate
            ? '<span style="font-weight:400;color:#cbd5e1">· checked ' + esc(member.verifiedDate) + '</span>'
            : '')
        : '<span>Listed in The Trust Network</span>') +
      '</a>';
  }

  function paint(members) {
    var els = document.querySelectorAll('.trust-network-badge[data-member]');
    els.forEach(function (el) {
      var id = el.getAttribute('data-member');
      var member = (members || []).filter(function (m) { return m.id === id; })[0] || null;
      render(el, member);
    });
  }

  // Load the directory's live data file, then paint. Any failure → neutral badge.
  var s = document.createElement('script');
  s.src = base + 'data/members.js';
  s.onload = function () { paint(window.TRUST_MEMBERS); };
  s.onerror = function () { paint(null); };
  document.head.appendChild(s);
})();
