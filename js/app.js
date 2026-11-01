/**
 * The Trust Network — app (rendering, routing, forms, capture).
 * All trust logic lives in js/core.js and is unit-tested. This file only
 * renders what core decides — it never invents a number or a badge.
 */
(function () {
  'use strict';
  var C = window.TrustCore;
  var CFG = window.TRUST_CONFIG || {};
  var MEMBERS = window.TRUST_MEMBERS || [];
  var REVIEWS = window.TRUST_REVIEWS || [];
  var COMPLAINTS = window.TRUST_COMPLAINTS || [];
  var ZIPDB = window.TRUST_ZIP_DB || {};
  var zipDbRequested = false;
  /** The ZIP dataset loads ONLY when a visitor actually searches by ZIP
   *  (research (b)): ordinary browsing never pays for the feature. */
  function ensureZipDb(done) {
    if (window.TRUST_ZIP_DB) { ZIPDB = window.TRUST_ZIP_DB; done(); return; }
    if (zipDbRequested) return;
    zipDbRequested = true;
    var s = document.createElement('script');
    s.src = 'data/zipdb.js';
    s.onload = function () { ZIPDB = window.TRUST_ZIP_DB || {}; done(); };
    s.onerror = function () { done(); };
    document.head.appendChild(s);
  }
  var esc = C.escapeHTML;
  var app = document.getElementById('app');

  /* ---------------- capture layer ---------------- */
  var QKEYS = { apply: 'tn_applications', review: 'tn_reviews', complaint: 'tn_complaints' };
  var SOURCES = { apply: 'trust-network-apply', review: 'trust-network-review', complaint: 'trust-network-complaint' };

  function readQueue(kind) {
    try { return JSON.parse(localStorage.getItem(QKEYS[kind]) || '[]'); }
    catch (e) { return []; }
  }
  function writeQueue(kind, rows) {
    localStorage.setItem(QKEYS[kind], JSON.stringify(rows));
  }
  function queueLocal(kind, payload) {
    var rows = readQueue(kind);
    rows.push(payload);
    writeQueue(kind, rows);
  }

  var CONTACT_EMAIL = 'tinglott@gmail.com';

  /** Visible notice while capture setup finishes: forms do not collect;
   *  the same information is taken by email, and it counts the same. */
  function emailModeNotice(kind) {
    if (CFG.CAPTURE_MODE !== 'email') return '';
    var what = kind === 'apply'
      ? 'Founding applications are open <strong>by email</strong> while our application system finishes setup. ' +
        'Email <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> with your name, your business name, what you sell, ' +
        'whether you sell online, locally, or both, your town if you sell locally, your storefront link, and your answer to the ' +
        '$' + (CFG.FOUNDING_PRICE_QUESTION || 19) + '/month question on this page. Emailed applications count toward the founding test exactly like form ones. ' +
        'You can still read the form below to see what we ask — but please email it rather than submitting here.'
      : kind === 'review'
      ? 'Review intake is open <strong>by email</strong> while our form system finishes setup. Email your review — with its purchase reference — to ' +
        '<a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> and it will be held for matching in exactly the same way.'
      : 'Concern intake is open <strong>by email</strong> while our form system finishes setup. Email the facts — what happened, when, and any purchase reference — to ' +
        '<a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> and it will be recorded as received and held for human review in exactly the same way.';
    return '<div class="notice warn">' + what + '</div>';
  }

  /**
   * Submit one payload. Live mode posts to the Trust Network's OWN Apps
   * Script endpoint (never the ARTISY signup adapter — see config.js).
   * Any failure falls back to the local queue and says so.
   * Email mode (public-launch interim): stores NOTHING — a queue on the
   * visitor's own device would strand their words where the owner can
   * never read them, which would be a fake collection. The caller shows
   * the email instructions instead.
   */
  function capture(kind, payload) {
    payload.source = SOURCES[kind];
    payload.received_at = new Date().toISOString();
    if (CFG.CAPTURE_MODE === 'email') {
      return Promise.resolve({ mode: 'email' });
    }
    if (CFG.CAPTURE_MODE === 'live' && CFG.CAPTURE_ENDPOINT) {
      return fetch(CFG.CAPTURE_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      }).then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || j.ok !== true) throw new Error('capture rejected');
          return { mode: 'live' };
        })
        .catch(function () {
          queueLocal(kind, payload);
          return { mode: 'local-fallback' };
        });
    }
    queueLocal(kind, payload);
    return Promise.resolve({ mode: 'local' });
  }

  /* ---------------- shared bits ---------------- */
  function fmtDate(iso) {
    if (!iso) return '';
    var d = new Date(iso + (iso.length === 10 ? 'T12:00:00' : ''));
    return isNaN(d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  function initials(name) {
    return String(name || '?').split(/\s+/).map(function (w) { return w[0]; }).slice(0, 2).join('').toUpperCase();
  }
  function starsHTML(avg) {
    if (avg === null) return '<span class="meta">No reviews yet</span>';
    var full = Math.round(avg);
    return '<span class="stars" title="' + avg + ' out of 5">' +
      '★★★★★'.slice(0, full) + '☆☆☆☆☆'.slice(0, 5 - full) + '</span> ' +
      '<span class="meta">' + avg + ' / 5</span>';
  }
  function memberById(id) {
    return MEMBERS.filter(function (m) { return m.id === id; })[0] || null;
  }

  /* ---------------- directory ---------------- */
  var dirState = { query: '', category: '', zip: '', radius: '', verifiedOnly: false };

  function directoryHTML() {
    var stats = C.computeStats(MEMBERS, REVIEWS);
    return '' +
    '<section class="hero">' +
      '<span class="pill">✓ Named owners · purchase-linked reviews · no paid rankings</span>' +
      '<h1>Find businesses that are <span class="grad">truly good</span> —<br/>and prove it.</h1>' +
      '<p class="lede">A verified directory for small businesses. Every member is a named, accountable ' +
      'person. Reviews exist only where a real purchase happened. Frauds need anonymity — here, they don\u2019t get it.</p>' +
      '<div class="stats">' +
        '<div class="stat"><b>' + stats.memberCount + '</b><span>business' + (stats.memberCount === 1 ? '' : 'es') + ' listed</span></div>' +
        '<div class="stat"><b>' + stats.verifiedCount + '</b><span>verified so far</span></div>' +
        '<div class="stat"><b>' + stats.publishedReviewCount + '</b><span>purchase-linked review' + (stats.publishedReviewCount === 1 ? '' : 's') + '</span></div>' +
        '<div class="stat"><b>' + stats.categoryCount + '</b><span>categor' + (stats.categoryCount === 1 ? 'y' : 'ies') + ' with members</span></div>' +
      '</div>' +
      '<p class="small">These counts are computed from the directory itself, every time this page loads. ' +
      'Small numbers are shown as they are — that is the point of this place.</p>' +
    '</section>' +

    '<section class="searchbar" aria-label="Search the directory">' +
      '<div class="row">' +
        '<input class="f-search" id="q" type="text" placeholder="What do you need? (audiobooks, cleaning, coaching…)" value="' + esc(dirState.query) + '" />' +
        '<select class="f-cat" id="cat"><option value="">All categories</option>' +
          C.categoriesInUse(MEMBERS).map(function (c) {
            return '<option' + (dirState.category === c ? ' selected' : '') + '>' + esc(c) + '</option>';
          }).join('') +
        '</select>' +
        '<input class="f-zip" id="zip" type="text" inputmode="numeric" maxlength="5" placeholder="Your ZIP" value="' + esc(dirState.zip) + '" />' +
        '<select class="f-radius" id="radius">' +
          '<option value="">Any distance</option>' +
          [10, 25, 50, 100].map(function (mi) {
            return '<option value="' + mi + '"' + (String(dirState.radius) === String(mi) ? ' selected' : '') + '>Within ' + mi + ' mi</option>';
          }).join('') +
        '</select>' +
      '</div>' +
      '<label class="checkline"><input type="checkbox" id="vonly"' + (dirState.verifiedOnly ? ' checked' : '') + ' /> Verified members only</label>' +
      '<p class="small" id="geoMsg"></p>' +
    '</section>' +

    '<section><div class="grid" id="results"></div>' +
    '<p class="small">Listing order: verified first, then nearest, then A–Z. Nobody pays to move up.</p></section>' +

    '<section class="section"><h2>For honest businesses</h2><div class="cols">' +
      '<div class="panel"><h3>Founding members</h3><p>We are enrolling a founding cohort — free while we prove this works. ' +
      'You bring a real store and your real name. In return: a profile that shows what was checked, a badge that means something, ' +
      'and reviews no one can buy.</p><p><a class="btn amber" href="#/apply">Apply as a founding member</a></p></div>' +
      '<div class="panel"><h3>What “Verified” means</h3><p>A person — not a script — checked the owner\u2019s identity against the storefront, ' +
      'confirmed the store is live and selling, reached the business through its published contact path, and ran a web check for a fraud pattern. ' +
      'The date and the checks are printed on every profile.</p><p><a href="#/how">Read the full checklist →</a></p></div>' +
      '<div class="panel"><h3>What it never means</h3><p>Not a guarantee of good work. Not insurance. Not a protection plan. ' +
      'This network sells none of those and claims none of those. It is a record of facts that were checked, kept in the open.</p></div>' +
    '</div></section>';
  }

  function renderResults() {
    var box = document.getElementById('results');
    var geoMsg = document.getElementById('geoMsg');
    if (!box) return;
    var visitor = null;
    var msg = '';
    if (dirState.zip && dirState.zip.length === 5 && !window.TRUST_ZIP_DB) {
      ensureZipDb(renderResults);
      if (geoMsg) geoMsg.textContent = 'Loading the ZIP lookup…';
      return;
    }
    if (dirState.zip) {
      visitor = C.coordsForZip(dirState.zip, ZIPDB);
      if (visitor) {
        msg = 'Distances measured from ZIP ' + esc(dirState.zip) + ' (town-level, typed by you — never tracked).';
        if (dirState.radius) msg += ' A distance limit hides online-only businesses.';
      } else {
        msg = 'That ZIP isn\u2019t in this staged lookup yet, so distances are off. Everything else still works.';
      }
    }
    if (geoMsg) geoMsg.textContent = msg;

    var list = C.filterMembers(MEMBERS, {
      query: dirState.query,
      category: dirState.category || undefined,
      verifiedOnly: dirState.verifiedOnly,
      visitor: visitor,
      maxMiles: dirState.radius ? Number(dirState.radius) : undefined
    });

    if (!list.length) {
      box.innerHTML = '<p class="meta">No businesses match that yet. This directory is young and growing by hand — ' +
        'if you run an honest business, <a href="#/apply">the founding door is open</a>.</p>';
      return;
    }
    box.innerHTML = list.map(function (m) {
      var avg = C.starAverage(REVIEWS, m.id);
      var pubCount = C.publishedReviewsFor(REVIEWS, m.id).length;
      var reviewLine = avg !== null
        ? starsHTML(avg)
        : (pubCount > 0
          ? '<span class="meta">' + pubCount + ' purchase-linked review' + (pubCount === 1 ? '' : 's') + ' — read them on the profile</span>'
          : '<span class="meta">No reviews yet</span>');
      var d = C.memberDistanceMiles(m, visitor);
      var where = m.servesOnline && d === null
        ? 'Serves online'
        : esc([m.baseTown, m.region].filter(Boolean).join(', '));
      return '<article class="card">' +
        '<div>' + (C.isVerified(m) ? C.verifiedBadge(m) : '<span class="badge-pending">Joined — verification not yet completed</span>') + '</div>' +
        '<h3><a href="#member-' + esc(m.id) + '">' + esc(m.businessName) + '</a></h3>' +
        '<div class="owner">Owner: ' + esc(m.ownerName) + ' · ' + esc(m.category) + '</div>' +
        '<p class="what">' + esc(m.sellsWhat) + '</p>' +
        '<div>' + reviewLine + '</div>' +
        '<div class="meta">📍 ' + where + (d !== null ? ' · ' + C.distanceBucket(d) + ' (from ZIP centre)' : '') + '</div>' +
        '<div class="meta">Member since ' + fmtDate(m.memberSince) + '</div>' +
      '</article>';
    }).join('');
  }

  function bindDirectory() {
    var q = document.getElementById('q');
    var cat = document.getElementById('cat');
    var zip = document.getElementById('zip');
    var radius = document.getElementById('radius');
    var vonly = document.getElementById('vonly');
    q.addEventListener('input', function () { dirState.query = q.value; renderResults(); });
    cat.addEventListener('change', function () { dirState.category = cat.value; renderResults(); });
    zip.addEventListener('input', function () { dirState.zip = zip.value; renderResults(); });
    radius.addEventListener('change', function () { dirState.radius = radius.value; renderResults(); });
    vonly.addEventListener('change', function () { dirState.verifiedOnly = vonly.checked; renderResults(); });
    renderResults();
  }

  /* ---------------- profile ---------------- */
  function profileHTML(m) {
    var avg = C.starAverage(REVIEWS, m.id);
    var pub = C.publishedReviewsFor(REVIEWS, m.id);
    var held = C.heldReviewsFor(REVIEWS, m.id);
    var tp = C.trustpilotSummary(m);
    var h = '' +
    '<section class="section"><p><a href="#/">← Back to the directory</a></p>' +
    '<div class="profile-head"><div class="avatar">' + esc(initials(m.businessName)) + '</div>' +
      '<div><h2 style="margin:0 0 6px">' + esc(m.businessName) + '</h2>' +
      '<div>' + (C.isVerified(m) ? C.verifiedBadge(m) : '<span class="badge-pending">Joined — verification not yet completed</span>') + '</div>' +
      '<p class="meta" style="margin:8px 0 0">Owner: ' + esc(m.ownerName) + ' · ' + esc(m.category) + ' · Member since ' + fmtDate(m.memberSince) + '</p>' +
      '<p class="meta">📍 ' + esc(m.serviceArea || ([m.baseTown, m.region].filter(Boolean).join(', '))) + '</p>' +
      '</div></div>' +
    '<p style="font-size:17px;max-width:680px">' + esc(m.sellsWhat) + '</p>' +
    '<p><a class="btn" href="' + esc(m.storefrontUrl) + '" target="_blank" rel="noopener">Visit the storefront ↗</a> ' +
    '<a class="btn ghost" href="#/review?member=' + esc(m.id) + '">Review a purchase</a> ' +
    '<a class="btn ghost" href="#/complaint?member=' + esc(m.id) + '">File a concern</a></p>';

    var steps = C.readinessSteps(m);
    if (steps.length) {
      h += '<div class="panel" style="margin-top:22px"><h3>Trust-readiness — work this member has done</h3>' +
        '<p class="small">Steps from the AI Command Center training materials, shown only when actually completed. Facts, not a score.</p>' +
        '<ul class="checks">' +
        steps.map(function (s) { return '<li><strong>' + esc(s.label) + '</strong> — ' + esc(s.detail) + '</li>'; }).join('') +
        '</ul></div>';
    }

    var cc = C.complaintCounts(COMPLAINTS, m.id);
    if (cc.show) {
      h += '<div class="notice warn" style="margin-top:18px"><strong>Complaint record:</strong> ' + cc.total +
        ' complaint' + (cc.total === 1 ? '' : 's') + ' on file — ' + cc.resolved + ' resolved, ' + cc.unresolved +
        ' unresolved. Counts only; the member\u2019s answers live in the record. No complaint can be removed by payment.</div>';
    }

    if (C.isVerified(m)) {
      h += '<div class="panel" style="margin-top:22px"><h3>What was checked</h3>' +
        '<p class="small">' + esc(m.verificationScope || '') + '</p><ul class="checks">' +
        (m.checks || []).map(function (c) { return '<li>' + esc(c) + '</li>'; }).join('') +
        '</ul></div>';
    } else {
      h += '<div class="notice warn">This business has joined but its verification is not yet completed. ' +
        'Until a person runs the full checklist, this profile carries no Verified mark — that is the rule for everyone.</div>';
    }

    if (m.notes) h += '<p class="small" style="margin-top:14px">' + esc(m.notes) + '</p>';

    if (tp) {
      h += '<div class="tp"><h3 style="margin:0 0 6px">Also on Trustpilot</h3>';
      if (tp.recorded) {
        h += '<p style="margin:0 0 6px">TrustScore <strong>' + tp.trustScore + '</strong> · ' + tp.reviewCount +
          ' reviews counted toward the score<br/><span class="small">Recorded by our verifier from the public Trustpilot page on ' +
          fmtDate(tp.recordedDate) + '. Trustpilot\u2019s numbers move; ours is a dated snapshot of what a person actually saw.</span></p>';
        if (tp.recordedNote) h += '<p class="small">' + esc(tp.recordedNote) + '</p>';
      }
      h += '<p style="margin:6px 0"><a href="' + esc(tp.url) + '" target="_blank" rel="noopener">See this business on Trustpilot ↗</a></p>' +
        '<p class="small" style="margin:0">Trustpilot is one signal our verifier looks at — it is not our badge. ' +
        'Their score is computed their way; our Verified mark means our own checklist was run, by a person, on the date shown above.</p></div>';
    }

    h += '<h3 style="margin-top:30px">Reviews from real purchases</h3>' +
      '<p class="small">A review appears here only when it carries a purchase reference the business could match in its own records. ' +
      'No reference, no match — no publication. That rule protects readers and honest businesses alike.</p>';
    if (avg !== null) h += '<p>' + starsHTML(avg) + ' <span class="meta">from ' + pub.length + ' purchase-linked review' + (pub.length === 1 ? '' : 's') + '</span></p>';
    else if (pub.length) h += '<p class="meta">' + pub.length + ' purchase-linked review' + (pub.length === 1 ? '' : 's') + ' below — averages appear once a member has ' + C.AVERAGE_MIN + ' or more, so one voice never poses as a consensus.</p>';
    if (!pub.length) {
      h += '<p class="meta">No reviews yet.</p>';
    } else {
      h += pub.map(function (r) {
        return '<div class="review"><div>' + starsHTML(r.stars) + '</div>' +
          '<p style="margin:8px 0">' + esc(r.text) + '</p>' +
          '<p class="meta">— ' + esc(r.reviewerName) + (r.product ? ' · bought: ' + esc(r.product) : '') +
          (r.dateLabel ? ' · ' + esc(r.dateLabel) : '') + '<br/>Purchase basis: ' + esc(r.basis || ('Reference: ' + r.transactionRef)) + '</p></div>';
      }).join('');
    }
    if (held.length) {
      h += '<p class="small">' + held.length + ' submitted review' + (held.length === 1 ? ' is' : 's are') +
        ' held — waiting on a matched purchase reference before it can appear here.</p>';
    }
    return h + '</section>';
  }

  /* ---------------- complaint intake ---------------- */
  function complaintHTML(presetMember) {
    return '<section class="section"><h2>File a concern about a member</h2>' +
    '<p style="max-width:660px">If a member business took your money and vanished, refused a refund, or failed you in a way this record should show — say so here, with facts and dates. ' +
    'Your concern is <strong>held for human review</strong>: it is read, the member is asked for their answer, and it moves through public states — received, under review, resolved with the outcome written in. ' +
    'Complaints are never deleted for payment. A concern that turns out to be mistaken is resolved saying so; a concern that stands stays on the record.</p>' +
    emailModeNotice('complaint') +
    '<form class="appform" id="complaintForm" novalidate>' +
      '<label>Business</label><select id="c_member">' +
        MEMBERS.map(function (m) {
          return '<option value="' + esc(m.id) + '"' + (presetMember === m.id ? ' selected' : '') + '>' + esc(m.businessName) + '</option>';
        }).join('') + '</select><div class="err" data-err="member_id"></div>' +
      field('complainant_name', 'Your name', '<input id="c_name" type="text" />', 'Concerns are named here, like members and reviews.') +
      field('complainant_email', 'Your email', '<input id="c_email" type="email" />', 'Never published. The member\u2019s answer may be shared with you.') +
      '<label>Kind of concern</label><select id="c_category"><option value="">Choose…</option>' +
        C.COMPLAINT_CATEGORIES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') +
        '</select><div class="err" data-err="category"></div>' +
      field('complaint_text', 'What happened?', '<textarea id="c_text" rows="5"></textarea>', 'Facts and dates help most. What you bought, when, what the business said.') +
      field('purchase_ref', 'Purchase reference (optional)', '<input id="c_ref" type="text" />', 'Order number or marketplace + date, if you have it.') +
      '<div class="hp"><label>Website<input id="c_website" type="text" tabindex="-1" autocomplete="off" /></label></div>' +
      '<p style="margin-top:20px"><button class="btn amber" type="submit">Submit concern</button></p>' +
      '<div id="complaintResult"></div>' +
    '</form></section>';
  }
  function bindComplaint() {
    var form = document.getElementById('complaintForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = {
        member_id: val('c_member'), complainant_name: val('c_name'), complainant_email: val('c_email'),
        category: val('c_category'), complaint_text: val('c_text'), purchase_ref: val('c_ref'),
        website: val('c_website')
      };
      var v = C.validateComplaint(input);
      if (v.quarantined) {
        input.quarantined = true;
        input.received_at = new Date().toISOString();
        queueLocal('complaint', input);
        document.getElementById('complaintResult').innerHTML = '<div class="notice ok">Thank you — your concern has been received and will be reviewed.</div>';
        form.reset();
        return;
      }
      showErrors(v.errors);
      if (!v.ok) return;
      input.status = 'received'; // held for human review; states move only by a person
      capture('complaint', input).then(function (res) {
        document.getElementById('complaintResult').innerHTML = (res && res.mode === 'email')
          ? '<div class="notice warn"><strong>This form is not collecting yet</strong> — nothing you typed here was stored or sent. ' +
            'To file this concern today, email the same facts to <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a>. ' +
            'It will be recorded as <strong>received</strong> and held for human review, the member will be asked for their answer, ' +
            'and nothing filed can be deleted by payment — that rule protects you.</div>'
          : '<div class="notice ok">Thank you. Your concern is recorded as <strong>received</strong> and held for human review. ' +
            'The member will be asked for their answer. Nothing you filed can be deleted by payment — that rule protects you.</div>';
        form.reset();
        showErrors({});
      });
    });
  }

  /* ---------------- how it works ---------------- */
  function howHTML() {
    return '<section class="section"><h2>How verification works</h2>' +
    '<p class="small">Verification criteria <strong>version ' + esc(C.CRITERIA.version) + '</strong>, in force since ' + fmtDate(C.CRITERIA.effectiveDate) + '. ' +
    'The criteria are a public, dated document — when they change, the version changes and the changelog below says what moved. Incumbents grade in a black box; we publish ours.</p>' +
    '<p style="max-width:680px;font-size:17px">Verification here is done by a person, by hand, the same way for the first member as for the five-hundredth. ' +
    'Every member starts unverified. Nobody pays to skip, and there is no “verified while we check.”</p>' +
    '<div class="panel"><h3>The checklist</h3><ul class="checks">' +
      '<li><strong>Identity matches the storefront owner.</strong> A real name, checked against the store itself. Scams require anonymity; members don\u2019t get it.</li>' +
      '<li><strong>The storefront is live and actually selling</strong> — real products, real prices, a checkout that works, seen on the day.</li>' +
      '<li><strong>A contact path that answers.</strong> The business can be reached through the path it publishes — and it replies like a person, because it is one.</li>' +
      '<li><strong>A web check for a fraud pattern</strong> — repeated “took my money and vanished” reports attached to this business. One unhappy review is not a pattern; a pattern is.</li>' +
      '<li><strong>Public review presence, read as a signal</strong> — including Trustpilot, where a member has one. Recorded with the date seen; never a pass or fail by itself.</li>' +
      '<li><strong>Location stated truthfully</strong> — a real town and service area for local businesses, or a plain “serves online.” Town-level only; we never publish anyone\u2019s street address.</li>' +
    '</ul>' +
    '<p class="small">When all of it passes, the profile shows the Verified mark, the date, and the list of what was checked. ' +
    'The mark means exactly: <em>identity, storefront, and ownership checked on that date</em>. It is not a guarantee of service quality, ' +
    'and this network offers no insurance, protection plan, or coverage of any kind.</em></p></div>' +
    '<div class="cols" style="margin-top:18px">' +
      '<div class="panel"><h3>Reviews</h3><p>Published only when tied to a purchase the business can match. Anything else is held, and labeled held. ' +
      'Star averages are computed from published reviews only — a business with none says “No reviews yet,” plainly.</p></div>' +
      '<div class="panel"><h3>Suspension, removal &amp; appeal — the process, in public</h3><p>Storefront dead, contact path abandoned, complaints left unanswered — the badge suspends and the profile says why, ' +
      'in factual language (“failed re-verification,” “contact path abandoned”). We publish facts and process, never verdicts we can\u2019t prove.</p>' +
      '<p><strong>Appeal:</strong> a suspended or removed business may answer in writing at any time. The answer becomes part of its record, unedited. ' +
      'If the facts change — the store is back, the customers are answered — the record changes and the badge can be re-earned through the same checklist as everyone else. ' +
      'There is no faster lane and no paid one.</p></div>' +
      '<div class="panel"><h3>Never, for anyone</h3><p>No paying to remove a complaint. No paying to restore a badge. No paying to rank higher. ' +
      'No invented numbers anywhere — every count on this site is computed from the directory itself.</p></div>' +
    '</div>' +
    '<div class="panel" style="margin-top:18px"><h3>Criteria changelog</h3><ul class="checks">' +
      C.CRITERIA.changelog.map(function (c) {
        return '<li><strong>v' + esc(c.version) + ' — ' + fmtDate(c.date) + ':</strong> ' + esc(c.note) + '</li>';
      }).join('') +
    '</ul></div></section>';
  }

  /* ---------------- founding application (the front door) ---------------- */
  function applyHTML() {
    return '<section class="section"><h2>Join as a founding member</h2>' +
    '<p style="max-width:660px;font-size:17px">A verified directory for small businesses. Named owners. Reviews tied to real purchases. ' +
    'Complaints answered in the open. No paid rankings, ever. <strong>Founding members: free while we prove it.</strong></p>' +
    '<p class="small" style="max-width:660px">Applying does not make you verified — everyone starts unverified, and a person runs the checklist before any badge exists. ' +
    'The founding test is simple: within 30 days of opening the door, we look for 50 real sellers applying, at least 10 completing free verification, ' +
    'and at least 20 saying the badge would be worth $19/month after the founding period. If the numbers aren\u2019t there, we\u2019ll say so honestly.</p>' +
    emailModeNotice('apply') +
    '<form class="appform" id="applyForm" novalidate>' +
      field('name', 'Your full name', '<input id="f_name" type="text" autocomplete="name" />', 'Members are named, accountable people. This name goes on your profile.') +
      field('email', 'Email', '<input id="f_email" type="email" autocomplete="email" />', 'Where we reach you for verification. Never sold, never shared.') +
      field('business_name', 'Business name', '<input id="f_business_name" type="text" />') +
      field('what_you_sell', 'What do you sell?', '<textarea id="f_what_you_sell" rows="3"></textarea>', 'A sentence or two, in your own words.') +
      field('category', 'Closest category', '<select id="f_category"><option value="">Choose…</option>' +
        C.CATEGORIES.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('') + '</select>') +
      '<label>Do you sell online, locally, or both?</label><div class="radio-row">' +
        '<label><input type="radio" name="sell_where" value="online" /> Online</label>' +
        '<label><input type="radio" name="sell_where" value="local" /> Locally</label>' +
        '<label><input type="radio" name="sell_where" value="both" /> Both</label></div><div class="err" data-err="sell_where"></div>' +
      field('town', 'Your town (local sellers)', '<input id="f_town" type="text" />', 'Town-level only — never your street address. This is how “near me” finds you.') +
      field('region', 'State / region', '<input id="f_region" type="text" />') +
      field('storefront_url', 'Your storefront link', '<input id="f_storefront_url" type="url" placeholder="https://…" />', 'Your shop, marketplace page, or site — it must be live and selling.') +
      '<label>If the badge brought you customers, would you pay $' + (CFG.FOUNDING_PRICE_QUESTION || 19) + '/month to keep it after the free founding period?</label>' +
      '<div class="radio-row"><label><input type="radio" name="pay_19" value="yes" /> Yes</label>' +
      '<label><input type="radio" name="pay_19" value="no" /> No</label></div><div class="err" data-err="pay_19"></div>' +
      field('referred_by', 'Referred by (optional)', '<input id="f_referred_by" type="text" />', 'A member, a community, a friend — whoever sent you. Recorded with your application; never shown publicly.') +
      field('notes', 'Anything we should know? (optional)', '<textarea id="f_notes" rows="2"></textarea>') +
      '<div class="hp"><label>Website<input id="f_website" type="text" tabindex="-1" autocomplete="off" /></label></div>' +
      '<p style="margin-top:20px"><button class="btn amber" type="submit">Submit founding application</button></p>' +
      '<div id="applyResult"></div>' +
    '</form></section>';
  }
  function field(key, label, control, hint) {
    return '<label for="f_' + key + '">' + label + (hint ? ' <span class="hint">' + hint + '</span>' : '') + '</label>' +
      control + '<div class="err" data-err="' + key + '"></div>';
  }
  function showErrors(errors) {
    document.querySelectorAll('[data-err]').forEach(function (el) {
      el.textContent = errors[el.getAttribute('data-err')] || '';
    });
  }
  function bindApply() {
    var form = document.getElementById('applyForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var sw = form.querySelector('input[name="sell_where"]:checked');
      var pay = form.querySelector('input[name="pay_19"]:checked');
      var input = {
        name: val('f_name'), email: val('f_email'), business_name: val('f_business_name'),
        what_you_sell: val('f_what_you_sell'), category: val('f_category'),
        sell_where: sw ? sw.value : '',
        town: val('f_town'), region: val('f_region'),
        storefront_url: val('f_storefront_url'),
        pay_19: pay ? (pay.value === 'yes') : undefined,
        referred_by: val('f_referred_by'),
        notes: val('f_notes'), website: val('f_website')
      };
      var v = C.validateApplication(input);
      if (v.quarantined) { // bot: look successful, store flagged, count nothing
        input.quarantined = true;
        queueLocal('apply', withStamp(input));
        document.getElementById('applyResult').innerHTML = okMsg();
        form.reset();
        return;
      }
      showErrors(v.errors);
      if (!v.ok) return;
      input.verification_completed = false;
      capture('apply', input).then(function (res) {
        document.getElementById('applyResult').innerHTML = okMsg(res.mode);
        form.reset();
        showErrors({});
      });
    });
  }
  function okMsg(mode) {
    if (mode === 'live') return '<div class="notice ok">Application received. You start unverified — a person will run the founding checklist and write back to you. Thank you for being willing to be checked; that willingness is the whole idea.</div>';
    if (mode === 'email') return '<div class="notice warn"><strong>This form is not collecting yet</strong> — our application system is finishing setup, and nothing you typed here was stored or sent. ' +
      'To apply today, email <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a> with your name, your business name, what you sell, whether you sell online, locally, or both, ' +
      'your town if you sell locally, your storefront link, and your yes/no on the $' + (CFG.FOUNDING_PRICE_QUESTION || 19) + '/month question. ' +
      'Emailed applications count toward the founding test exactly like form ones. You start unverified either way: a person runs the checklist before any badge exists.</div>';
    return '<div class="notice warn">Application saved to the founding queue <strong>on this device</strong> (staging mode — the network is not collecting publicly yet). ' +
      'When the door opens for real, this same form sends to the network\u2019s own list. You start unverified either way: a person runs the checklist before any badge exists.</div>';
  }
  function withStamp(input) {
    input.received_at = new Date().toISOString();
    input.source = 'trust-network-apply';
    return input;
  }
  function val(id) { var el = document.getElementById(id); return el ? el.value.trim() : ''; }

  /* ---------------- review form ---------------- */
  function reviewHTML(presetMember) {
    return '<section class="section"><h2>Review a purchase</h2>' +
    '<p style="max-width:660px">Reviews here are tied to real purchases. Give the business something it can match in its own records — ' +
    'an order number, a receipt detail, the marketplace and date. <strong>Without a purchase reference, your review is held and cannot be published.</strong> ' +
    'With one, it is held until the business confirms the match — then it appears, whatever the stars.</p>' +
    emailModeNotice('review') +
    '<form class="appform" id="reviewForm" novalidate>' +
      '<label>Business</label><select id="r_member">' +
        MEMBERS.map(function (m) {
          return '<option value="' + esc(m.id) + '"' + (presetMember === m.id ? ' selected' : '') + '>' + esc(m.businessName) + '</option>';
        }).join('') + '</select><div class="err" data-err="member_id"></div>' +
      field('reviewer_name', 'Your name', '<input id="r_name" type="text" />', 'Reviews are named here, like members.') +
      field('reviewer_email', 'Your email', '<input id="r_email" type="email" />', 'Never published. Used only if the business needs help matching your purchase.') +
      '<label>Your rating</label><select id="r_stars"><option value="">Choose…</option>' +
        [5, 4, 3, 2, 1].map(function (s) { return '<option value="' + s + '">' + s + ' star' + (s === 1 ? '' : 's') + '</option>'; }).join('') +
        '</select><div class="err" data-err="stars"></div>' +
      field('review_text', 'Your review', '<textarea id="r_text" rows="4"></textarea>') +
      field('product', 'What did you buy? (optional)', '<input id="r_product" type="text" />') +
      field('transaction_ref', 'Purchase reference', '<input id="r_ref" type="text" />', 'Order number, marketplace + date, or receipt detail the business can check.') +
      '<div class="hp"><label>Website<input id="r_website" type="text" tabindex="-1" autocomplete="off" /></label></div>' +
      '<p style="margin-top:20px"><button class="btn" type="submit">Submit review</button></p>' +
      '<div id="reviewResult"></div>' +
    '</form></section>';
  }
  function bindReview() {
    var form = document.getElementById('reviewForm');
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var input = {
        member_id: val('r_member'), reviewer_name: val('r_name'), reviewer_email: val('r_email'),
        stars: val('r_stars'), review_text: val('r_text'), product: val('r_product'),
        transaction_ref: val('r_ref'), website: val('r_website')
      };
      var v = C.validateReview(input);
      if (v.quarantined) {
        input.quarantined = true;
        input.received_at = new Date().toISOString();
        queueLocal('review', input);
        document.getElementById('reviewResult').innerHTML = '<div class="notice ok">Thank you — your review has been received and is held for a purchase match.</div>';
        form.reset();
        return;
      }
      showErrors(v.errors);
      if (!v.ok) return;
      input.stars = Number(input.stars);
      input.status = 'held'; // every review starts held — a human publishes after the match
      capture('review', input).then(function (res) {
        document.getElementById('reviewResult').innerHTML = (res && res.mode === 'email')
          ? '<div class="notice warn"><strong>This form is not collecting yet</strong> — nothing you typed here was stored or sent. ' +
            'To send this review today, email it — with its purchase reference — to <a href="mailto:' + CONTACT_EMAIL + '">' + CONTACT_EMAIL + '</a>. ' +
            'It will be <strong>held for matching</strong> in exactly the same way: the business confirms the purchase, and then the review appears, whatever the stars.</div>'
          : '<div class="notice ' + (v.willBeHeld ? 'warn' : 'ok') + '">' +
            (v.willBeHeld
              ? 'Thank you. Your review is <strong>held</strong>: you didn\u2019t include a purchase reference, so it can\u2019t be published. If you find your order details, submit again with them and it can be matched.'
              : 'Thank you. Your review is <strong>held for matching</strong>: the business will confirm your purchase reference, and then your review appears — whatever the stars.') +
            '</div>';
        form.reset();
        showErrors({});
      });
    });
  }

  /* ---------------- owner console ---------------- */
  function ownerHTML() {
    var apps = readQueue('apply');
    var revs = readQueue('review');
    var counters = C.computeTestCounters(apps);
    var marks = counters.marks;
    function bar(label, n, mark, passed) {
      var pct = Math.min(100, Math.round((n / mark) * 100));
      return '<div class="panel"><h3 style="margin-bottom:6px">' + label + '</h3>' +
        '<div class="bar"><i style="width:' + pct + '%"></i></div>' +
        '<p class="meta" style="margin:8px 0 0">' + n + ' of ' + mark + (passed ? ' — ✓ mark met' : '') + '</p></div>';
    }
    var h = '<section class="section"><h2>Owner console — founding test</h2>' +
    '<p class="small" style="max-width:700px">Capture mode: <strong>' + esc(String(CFG.CAPTURE_MODE || '')) + '</strong>. These counters read the founding queue stored in <strong>this browser</strong> ' +
    'While capture runs in email mode, real applications arrive in the owner\u2019s inbox instead \u2014 they are <strong>not</strong> in this queue, and this console must not be read as the test tally until emailed ' +
    'applications are counted in (the counting rules do not change when they are). In live mode the same counters run on the network\u2019s own Sheet rows. ' +
    'Counted: applications carrying a live storefront link; verifications a human marked completed below; ' +
    '“yes” answers to the $' + (CFG.FOUNDING_PRICE_QUESTION || 19) + '/month question. Quarantined (bot-suspect) rows never count. Window: ' + marks.windowDays + ' days from the door opening.</p>' +
    '<div class="cols">' +
      bar('Signups with a live storefront', counters.signups, marks.signups, counters.pass.signups) +
      bar('Founding verifications completed', counters.verifications, marks.verifications, counters.pass.verifications) +
      bar('“Yes” to $19/month', counters.payYes, marks.payYes, counters.pass.payYes) +
    '</div>' +
    '<p style="margin-top:14px">' + (counters.pass.all
      ? '<strong>All three marks met.</strong> The test has passed on this data — growth past v1 is earned.'
      : 'Test status: <strong>not yet passed</strong> on this data. All three marks must be met inside the window.') + '</p>';

    h += '<h3 style="margin-top:30px">Founding applications in this queue (' + apps.length + ')</h3>';
    if (!apps.length) h += '<p class="meta">None yet.</p>';
    else {
      h += '<table class="queue"><tr><th>When</th><th>Business</th><th>Sells</th><th>Where</th><th>Storefront</th><th>$19?</th><th>Verification</th><th>Packet</th></tr>' +
        apps.map(function (a, i) {
          return '<tr' + (a.quarantined ? ' style="opacity:.5"' : '') + '><td>' + esc((a.received_at || '').slice(0, 10)) + '</td>' +
            '<td>' + esc(a.business_name) + '<br/><span class="meta">' + esc(a.name) + ' · ' + esc(a.email) + '</span></td>' +
            '<td>' + esc(a.category) + '</td><td>' + esc(a.sell_where) + (a.town ? '<br/>' + esc(a.town) : '') + '</td>' +
            '<td><a href="' + esc(a.storefront_url) + '" target="_blank" rel="noopener">link</a></td>' +
            '<td>' + (a.pay_19 === true ? 'yes' : a.pay_19 === false ? 'no' : '—') + '</td>' +
            '<td>' + (a.quarantined ? 'bot-suspect — excluded' : (a.verification_completed
              ? '✓ completed'
              : '<button class="btn ghost" data-verify="' + i + '" style="padding:6px 10px;font-size:12px">Mark completed</button>')) + '</td>' +
            '<td><button class="btn ghost" data-packet="' + i + '" style="padding:6px 10px;font-size:12px">Evidence packet</button></td></tr>';
        }).join('') + '</table>';
    }

    h += '<h3 style="margin-top:30px">Submitted reviews in this queue (' + revs.length + ') — all held</h3>';
    if (!revs.length) h += '<p class="meta">None yet.</p>';
    else {
      h += '<table class="queue"><tr><th>When</th><th>Business</th><th>Reviewer</th><th>Stars</th><th>Purchase reference</th><th>Status</th></tr>' +
        revs.map(function (r) {
          var m = memberById(r.member_id);
          return '<tr><td>' + esc((r.received_at || '').slice(0, 10)) + '</td><td>' + esc(m ? m.businessName : r.member_id) + '</td>' +
            '<td>' + esc(r.reviewer_name) + '</td><td>' + esc(r.stars) + '</td>' +
            '<td>' + (r.transaction_ref ? esc(r.transaction_ref) : '<em>none — cannot publish</em>') + '</td>' +
            '<td><span class="badge-pending">held</span></td></tr>';
        }).join('') + '</table>' +
        '<p class="small">To publish one: ask the member to confirm the purchase reference matches their records. On confirmation, add the review to data/members.js with status "published" and transactionMatched true. Nothing publishes from this queue automatically — that is by design.</p>';
    }

    var comps = readQueue('complaint');
    h += '<h3 style="margin-top:30px">Complaints in this queue (' + comps.length + ') — held for human review</h3>';
    if (!comps.length) h += '<p class="meta">None yet.</p>';
    else {
      h += '<table class="queue"><tr><th>When</th><th>Business</th><th>From</th><th>Kind</th><th>State</th><th>Move</th></tr>' +
        comps.map(function (cp, i) {
          var m2 = memberById(cp.member_id);
          return '<tr><td>' + esc((cp.received_at || '').slice(0, 10)) + '</td><td>' + esc(m2 ? m2.businessName : cp.member_id) + '</td>' +
            '<td>' + esc(cp.complainant_name) + '</td><td>' + esc(cp.category) + '</td>' +
            '<td><span class="badge-pending">' + esc(cp.status || 'received') + '</span></td>' +
            '<td>' + (cp.status === 'resolved'
              ? esc(cp.outcome || '')
              : '<button class="btn ghost" data-comp="' + i + '" style="padding:6px 10px;font-size:12px">' +
                (cp.status === 'under-review' ? 'Resolve with outcome…' : 'Begin review') + '</button>') + '</td></tr>';
        }).join('') + '</table>' +
        '<p class="small">Public counts appear on a profile only when a complaint is entered into the public record (data/members.js → TRUST_COMPLAINTS) after review. ' +
        'Resolving here asks for the outcome in writing — a resolved complaint without an outcome does not count as resolved anywhere in this system.</p>';
    }

    h += '<div id="packetZone"></div>' +
      '<p style="margin-top:24px"><button class="btn ghost" id="expApps">Export applications (JSON)</button> ' +
      '<button class="btn ghost" id="expRevs">Export reviews (JSON)</button> ' +
      '<button class="btn ghost" id="expComps">Export complaints (JSON)</button></p></section>';
    return h;
  }

  /** Render one application's evidence packet as copyable text. */
  function packetText(a) {
    var p = C.buildEvidencePacket(a);
    var lines = [];
    lines.push('EVIDENCE PACKET — The Trust Network founding verification');
    lines.push('Business: ' + p.packetFor + ' · Applicant: ' + p.applicantName);
    if (p.referredBy) lines.push('Referred by (internal): ' + p.referredBy);
    lines.push('');
    p.sections.forEach(function (s) {
      lines.push('## ' + s.title);
      s.items.forEach(function (it) {
        lines.push('- [ ] ' + it.label + (it.prefilled ? ' — ' + it.prefilled : '') + '  → finding: ______  evidence: ______');
      });
      lines.push('');
    });
    lines.push('LIMIT: ' + p.limit);
    lines.push('HUMAN DECISION (verifier only): decided by ______ · date ______ · outcome ______');
    return lines.join('\n');
  }
  function bindOwner() {
    document.querySelectorAll('[data-verify]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var apps = readQueue('apply');
        var a = apps[Number(btn.getAttribute('data-verify'))];
        if (a) { a.verification_completed = true; writeQueue('apply', apps); route(); }
      });
    });
    document.querySelectorAll('[data-packet]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var apps = readQueue('apply');
        var a = apps[Number(btn.getAttribute('data-packet'))];
        var zone = document.getElementById('packetZone');
        if (a && zone) {
          zone.innerHTML = '<div class="panel" style="margin-top:22px"><h3>Evidence packet — ' + esc(a.business_name) + '</h3>' +
            '<p class="small">Pre-filled from the application. The verifier — a human, or the Verifier AI employee working its role card — completes the checks and records findings. ' +
            'The packet cannot grant verification; only the human decision can.</p>' +
            '<textarea rows="26" readonly style="font-size:13px">' + esc(packetText(a)) + '</textarea></div>';
          zone.scrollIntoView({ behavior: 'smooth' });
        }
      });
    });
    document.querySelectorAll('[data-comp]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var comps = readQueue('complaint');
        var cp = comps[Number(btn.getAttribute('data-comp'))];
        if (!cp) return;
        if (cp.status === 'received') {
          cp.status = 'under-review';
        } else if (cp.status === 'under-review') {
          var outcome = window.prompt('Resolve this complaint — write the outcome in factual words (it becomes part of the record):');
          if (!outcome || !outcome.trim()) return;
          cp.status = 'resolved';
          cp.outcome = outcome.trim();
        }
        writeQueue('complaint', comps);
        route();
      });
    });
    function dl(id, kind, name) {
      var el = document.getElementById(id);
      if (!el) return;
      el.addEventListener('click', function () {
        var blob = new Blob([JSON.stringify(readQueue(kind), null, 2)], { type: 'application/json' });
        var a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = name;
        a.click();
        URL.revokeObjectURL(a.href);
      });
    }
    dl('expApps', 'apply', 'trust-network-applications.json');
    dl('expRevs', 'review', 'trust-network-reviews.json');
    dl('expComps', 'complaint', 'trust-network-complaints.json');
  }

  /* ---------------- router ---------------- */
  function route() {
    var hash = location.hash || '#/';
    window.scrollTo(0, 0);
    if (hash.indexOf('#member-') === 0) {
      var m = memberById(hash.slice('#member-'.length));
      app.innerHTML = m ? profileHTML(m)
        : '<section class="section"><h2>Not found</h2><p>No business with that id is in the directory. <a href="#/">Back to the directory</a></p></section>';
      return;
    }
    switch (hash) {
      case '#/how': app.innerHTML = howHTML(); return;
      case '#/apply': app.innerHTML = applyHTML(); bindApply(); return;
      case '#/owner': app.innerHTML = ownerHTML(); bindOwner(); return;
      default:
        if (hash.indexOf('#/review') === 0) {
          var mm = /member=([^&]+)/.exec(hash);
          app.innerHTML = reviewHTML(mm ? decodeURIComponent(mm[1]) : '');
          bindReview();
          return;
        }
        if (hash.indexOf('#/complaint') === 0) {
          var cm = /member=([^&]+)/.exec(hash);
          app.innerHTML = complaintHTML(cm ? decodeURIComponent(cm[1]) : '');
          bindComplaint();
          return;
        }
        app.innerHTML = directoryHTML();
        bindDirectory();
    }
  }
  window.addEventListener('hashchange', route);
  route();
})();
