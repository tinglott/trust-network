/**
 * Trust Network — core logic (pure functions, no DOM).
 * Shared by index.html (browser) and tests/run-tests.js (Node).
 *
 * THE CONSTITUTION, IN CODE (from the TrustLink corrections, Oct 23 2026):
 *  1. Every member starts verified=false. isVerified() is strict: only the
 *     boolean true counts — never a truthy string, never a default.
 *  2. The Verified badge renders ONLY for verified members (verifiedBadge()).
 *  3. Every number shown anywhere is computed from the data present
 *     (computeStats / computeTestCounters). No literal statistics exist
 *     in the app. If the data isn't there, the number isn't shown.
 *  4. A review is published ONLY when it carries a transaction reference
 *     AND a human recorded that the member matched it (reviewPublishable()).
 *     Everything else is held, and labeled held.
 *  5. No protection / insurance / coverage claims exist in this codebase.
 */
(function (global) {
  'use strict';

  /* ---------- Categories (v1 taxonomy — research/BORROW-LIST.md §7 + (a)) ---------- */
  /**
   * A closed list of 14, built from Yelp's roots + Google Business Profile's
   * digital-era categories + the Yellow Pages spine, cut to the founding mix.
   * Rules: one primary category per member (this field), up to two secondary
   * (member record's secondaryCategories), free-form service tags are NOT
   * categories. No member-invented categories in v1 — a request goes in the
   * application notes and is reviewed quarterly. "Serves online/locally" is
   * its own field, never a category.
   */
  var CATEGORIES = [
    'Digital Products & Downloads',
    'Software, Apps & AI Tools',
    'Books, Writing & Publishing',
    'Coaching & Consulting',
    'Design, Media & Creative Services',
    'Marketing & Business Support',
    'Crafts, Gifts & Physical Products',
    'Health, Wellness & Faith Resources',
    'Elder Care, Home Care & Companionship',
    'Home Services, Repair & Trades',
    'Cleaning, Organizing & Moving',
    'Food, Drink & Catering',
    'Education, Tutoring & Childcare',
    'Events, Photography & Entertainment'
  ];

  /**
   * Directory filter shows only categories that have at least one VERIFIED
   * member (research (a)): an empty shelf is not a promise. Falls back to
   * categories with any member if none are verified yet.
   */
  function categoriesInUse(members) {
    var verifiedCats = {};
    var anyCats = {};
    (members || []).forEach(function (m) {
      if (m.category) {
        anyCats[m.category] = true;
        if (isVerified(m)) verifiedCats[m.category] = true;
      }
    });
    var src = Object.keys(verifiedCats).length ? verifiedCats : anyCats;
    return CATEGORIES.filter(function (c) { return src[c]; });
  }

  /* ---------- The interest test's pass marks (DEMAND-CHECK.md §5) ---------- */
  var PASS_MARKS = { signups: 50, verifications: 10, payYes: 20, windowDays: 30 };

  /* ---------- Verification criteria: versioned in public ---------- */
  /**
   * The criteria are a published, dated document — not a black box.
   * The How Verification Works page renders THIS object, so the version
   * the public reads is the version the code carries. Changes get a new
   * version and a changelog line; old versions are never silently edited.
   */
  var CRITERIA = {
    version: '1.0',
    effectiveDate: '2026-11-01',
    changelog: [
      { version: '1.0', date: '2026-11-01', note: 'Founding criteria published with the v1 system: identity ↔ storefront, live-and-selling check, contact-path test, fraud-pattern web check, Trustpilot observation (signal only), truthful location statement.' }
    ]
  };

  var COMPLAINT_CATEGORIES = [
    'Paid, nothing delivered',
    'Refund refused or unreachable',
    'Product or service not as described',
    'Communication failure',
    'Other'
  ];

  /* ---------- Escaping (TrustLink defect #6: never inject raw user text) ---------- */
  function escapeHTML(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /* ---------- Verification ---------- */
  function isVerified(member) {
    return !!member && member.verified === true;
  }

  /**
   * The ONLY way a Verified mark is produced anywhere in the system.
   * Returns '' for unverified members — there is no badge to hide,
   * because there is no badge.
   */
  function verifiedBadge(member) {
    if (!isVerified(member)) return '';
    return '<span class="badge-verified" title="Identity, storefront, and ownership checked on ' +
      escapeHTML(member.verifiedDate || '') + '">✓ Verified</span>';
  }

  function memberStatusLabel(member) {
    if (isVerified(member)) return 'Verified member';
    return 'Joined — verification not yet completed';
  }

  /* ---------- Statistics: computed, never written down as literals ---------- */
  function computeStats(members, reviews) {
    members = members || [];
    reviews = reviews || [];
    var published = reviews.filter(reviewPublishable);
    return {
      memberCount: members.length,
      verifiedCount: members.filter(isVerified).length,
      unverifiedCount: members.filter(function (m) { return !isVerified(m); }).length,
      categoryCount: Object.keys(members.reduce(function (acc, m) {
        if (m.category) acc[m.category] = true;
        return acc;
      }, {})).length,
      publishedReviewCount: published.length
    };
  }

  /* ---------- Reviews ---------- */
  /**
   * A review may be shown publicly ONLY if:
   *   - a human recorded status 'published', AND
   *   - it carries a transaction reference, AND
   *   - the member matched that reference to their own records
   *     (transactionMatched === true, set by a human — never by the form).
   * Anything else is held, and the UI labels it held.
   */
  function reviewPublishable(review) {
    return !!review &&
      review.status === 'published' &&
      typeof review.transactionRef === 'string' &&
      review.transactionRef.trim() !== '' &&
      review.transactionMatched === true;
  }

  function publishedReviewsFor(reviews, memberId) {
    return (reviews || []).filter(function (r) {
      return r.memberId === memberId && reviewPublishable(r);
    });
  }

  function heldReviewsFor(reviews, memberId) {
    return (reviews || []).filter(function (r) {
      return r.memberId === memberId && !reviewPublishable(r);
    });
  }

  /**
   * A star AVERAGE is shown only at AVERAGE_MIN or more published reviews
   * (the Judge.me threshold pattern, research §3.2): an average computed
   * from one or two reviews pretends to a precision the record doesn't
   * have. Below the threshold the reviews themselves still display —
   * they are the evidence — but no average is computed or shown.
   */
  var AVERAGE_MIN = 3;
  function starAverage(reviews, memberId) {
    var pub = publishedReviewsFor(reviews, memberId);
    if (pub.length < AVERAGE_MIN) return null;
    var sum = pub.reduce(function (a, r) { return a + (Number(r.stars) || 0); }, 0);
    return Math.round((sum / pub.length) * 10) / 10;
  }

  /* ---------- Trustpilot: a signal, never the badge ---------- */
  /**
   * Trustpilot is ONE cross-reference among several — it is not our
   * verification, and its score is never displayed unless a human verifier
   * actually saw it on the member's public page and recorded it with a date.
   *   - no Trustpilot URL on the record      → null (show nothing)
   *   - URL, but no dated recorded score     → link only, no numbers
   *   - URL + recorded score/count + date    → link + the recorded figures,
   *                                            stamped with the date seen
   * No scraping, no API, no live numbers in v1 — by design.
   */
  function trustpilotSummary(member) {
    var tp = member && member.trustpilot;
    if (!tp || typeof tp.url !== 'string' || tp.url.trim() === '') return null;
    var hasRecorded = typeof tp.trustScore === 'number' &&
      typeof tp.reviewCount === 'number' &&
      typeof tp.recordedDate === 'string' && tp.recordedDate.trim() !== '';
    return {
      url: tp.url,
      recorded: hasRecorded,
      trustScore: hasRecorded ? tp.trustScore : null,
      reviewCount: hasRecorded ? tp.reviewCount : null,
      recordedDate: hasRecorded ? tp.recordedDate : null,
      recordedNote: typeof tp.recordedNote === 'string' ? tp.recordedNote : ''
    };
  }

  /* ---------- Geo: distance from facts, never from tracking ---------- */
  function haversineMiles(lat1, lon1, lat2, lon2) {
    var R = 3958.8; // Earth radius, miles
    function rad(d) { return d * Math.PI / 180; }
    var dLat = rad(lat2 - lat1);
    var dLon = rad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(rad(lat1)) * Math.cos(rad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * R * Math.asin(Math.sqrt(a));
  }

  /**
   * Distance needs BOTH sides to carry real coordinates.
   * Online-only members return null — the UI shows "Serves online",
   * never a fake distance.
   */
  function memberDistanceMiles(member, visitor) {
    if (!member || !visitor) return null;
    if (typeof member.lat !== 'number' || typeof member.lng !== 'number') return null;
    if (typeof visitor.lat !== 'number' || typeof visitor.lng !== 'number') return null;
    return Math.round(haversineMiles(member.lat, member.lng, visitor.lat, visitor.lng) * 10) / 10;
  }

  /**
   * Distances display as BUCKETS, never decimals (research (b)):
   * centroid-to-centroid distance is approximate by design, and a
   * precise-looking number would claim accuracy the data doesn't have.
   */
  function distanceBucket(miles) {
    if (typeof miles !== 'number' || isNaN(miles)) return '';
    if (miles < 10) return 'Under 10 mi away';
    if (miles < 25) return '10–25 mi away';
    if (miles < 50) return '25–50 mi away';
    return '50+ mi away';
  }

  function coordsForZip(zip, zipDb) {
    if (!zipDb) return null;
    var rec = zipDb[String(zip || '').trim()];
    if (!rec) return null;
    return { lat: rec[0], lng: rec[1], label: 'ZIP ' + String(zip).trim() };
  }

  /* ---------- Directory filtering + the published ordering rule ---------- */
  /**
   * Ordering rule (published in the UI, from VISION.md):
   *   verified members first → then nearest (when distance is known) → then A–Z.
   * Nobody can pay to move up. There is no other ordering.
   */
  function filterMembers(members, opts) {
    opts = opts || {};
    var q = (opts.query || '').trim().toLowerCase();
    var out = (members || []).filter(function (m) {
      if (opts.category && m.category !== opts.category) return false;
      if (opts.verifiedOnly && !isVerified(m)) return false;
      if (q) {
        var hay = [m.businessName, m.ownerName, m.category, m.sellsWhat,
                   m.baseTown, m.region, m.serviceArea]
          .filter(Boolean).join(' ').toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (typeof opts.maxMiles === 'number') {
        var d = memberDistanceMiles(m, opts.visitor);
        if (d === null || d > opts.maxMiles) return false;
      }
      return true;
    });
    out.sort(function (a, b) {
      var va = isVerified(a) ? 0 : 1;
      var vb = isVerified(b) ? 0 : 1;
      if (va !== vb) return va - vb;
      var da = memberDistanceMiles(a, opts.visitor);
      var db = memberDistanceMiles(b, opts.visitor);
      if (da !== null && db !== null && da !== db) return da - db;
      if (da !== null && db === null) return -1;
      if (da === null && db !== null) return 1;
      return String(a.businessName).localeCompare(String(b.businessName));
    });
    return out;
  }

  /* ---------- Founding application validation ---------- */
  function validateApplication(input) {
    input = input || {};
    var errors = {};
    function req(field, msg) { if (!String(input[field] || '').trim()) errors[field] = msg; }

    req('name', 'Your name is required — members are named, accountable people.');
    req('business_name', 'Business name is required.');
    req('what_you_sell', 'Tell us what you sell, in a sentence or two.');
    if (input.what_you_sell && String(input.what_you_sell).trim().length < 10) {
      errors.what_you_sell = 'A little more detail, please — at least a full sentence.';
    }
    var email = String(input.email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'A valid email is required.';
    if (!input.category || CATEGORIES.indexOf(input.category) === -1) {
      errors.category = 'Please choose the closest category.';
    }
    if (['online', 'local', 'both'].indexOf(input.sell_where) === -1) {
      errors.sell_where = 'Please tell us whether you sell online, locally, or both.';
    }
    if ((input.sell_where === 'local' || input.sell_where === 'both') &&
        !String(input.town || '').trim()) {
      errors.town = 'Local sellers: your town is how "near me" finds you.';
    }
    var url = String(input.storefront_url || '').trim();
    if (!url) {
      errors.storefront_url = 'Your storefront link is required — the test only counts sellers with a live storefront.';
    } else {
      try {
        var u = new URL(url);
        if (u.protocol !== 'http:' && u.protocol !== 'https:') throw new Error('protocol');
      } catch (e) {
        errors.storefront_url = 'That link doesn’t look like a full web address (https://…).';
      }
    }
    if (typeof input.pay_19 !== 'boolean') {
      errors.pay_19 = 'Please answer yes or no — it decides whether this network can exist.';
    }
    // Honeypot: a filled "website" field means a bot. Not an error — a quarantine.
    var quarantined = !!String(input.website || '').trim();
    return { ok: Object.keys(errors).length === 0 && !quarantined, errors: errors, quarantined: quarantined };
  }

  /* ---------- Review submission validation ---------- */
  function validateReview(input) {
    input = input || {};
    var errors = {};
    if (!input.member_id) errors.member_id = 'Choose the business you are reviewing.';
    var stars = Number(input.stars);
    if (!Number.isInteger(stars) || stars < 1 || stars > 5) {
      errors.stars = 'Please give 1 to 5 stars.';
    }
    if (!String(input.review_text || '').trim()) errors.review_text = 'Please write a few words.';
    if (!String(input.reviewer_name || '').trim()) errors.reviewer_name = 'Your name is required — reviews here are named, like members.';
    var email = String(input.reviewer_email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.reviewer_email = 'A valid email is required (never published).';
    // No transaction reference is NOT a validation error — the review is
    // accepted and HELD, labeled held, until a reference is matched.
    var quarantined = !!String(input.website || '').trim();
    return {
      ok: Object.keys(errors).length === 0 && !quarantined,
      errors: errors,
      quarantined: quarantined,
      willBeHeld: !String(input.transaction_ref || '').trim()
    };
  }

  /* ---------- The interest test counters: real submissions only ---------- */
  /**
   * Counts ONLY what the demand check says counts:
   *   signups       — applications carrying a live storefront link
   *   verifications — founding applicants whose manual verification COMPLETED
   *   payYes        — applications answering yes to $19/month after founding
   * Friends-and-family rows without a storefront link do not count as signups.
   */
  function computeTestCounters(applications) {
    var apps = applications || [];
    var real = apps.filter(function (a) {
      return a && a.quarantined !== true;
    });
    var signups = real.filter(function (a) {
      return typeof a.storefront_url === 'string' && a.storefront_url.trim() !== '';
    }).length;
    var verifications = real.filter(function (a) {
      return a.verification_completed === true;
    }).length;
    var payYes = real.filter(function (a) { return a.pay_19 === true; }).length;
    return {
      signups: signups,
      verifications: verifications,
      payYes: payYes,
      totalApplications: real.length,
      pass: {
        signups: signups >= PASS_MARKS.signups,
        verifications: verifications >= PASS_MARKS.verifications,
        payYes: payYes >= PASS_MARKS.payYes,
        all: signups >= PASS_MARKS.signups &&
             verifications >= PASS_MARKS.verifications &&
             payYes >= PASS_MARKS.payYes
      },
      marks: PASS_MARKS
    };
  }

  /* ---------- Complaints: counted only when real ones exist ---------- */
  /**
   * Public profiles show complaint COUNTS only — never complaint text —
   * and only when at least one real complaint is on the member's record.
   * States: 'received' and 'under-review' count as unresolved;
   * 'resolved' counts only with a recorded outcome.
   */
  function complaintCounts(complaints, memberId) {
    var list = (complaints || []).filter(function (c) { return c && c.memberId === memberId; });
    var resolved = list.filter(function (c) {
      return c.status === 'resolved' && typeof c.outcome === 'string' && c.outcome.trim() !== '';
    }).length;
    return {
      total: list.length,
      resolved: resolved,
      unresolved: list.length - resolved,
      show: list.length > 0
    };
  }

  function validateComplaint(input) {
    input = input || {};
    var errors = {};
    if (!input.member_id) errors.member_id = 'Choose the business this concern is about.';
    if (!String(input.complainant_name || '').trim()) errors.complainant_name = 'Your name is required — concerns here are named, like everything else.';
    var email = String(input.complainant_email || '').trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.complainant_email = 'A valid email is required (never published).';
    if (COMPLAINT_CATEGORIES.indexOf(input.category) === -1) errors.category = 'Please choose the closest kind of concern.';
    if (String(input.complaint_text || '').trim().length < 20) {
      errors.complaint_text = 'Please describe what happened in at least a sentence or two — facts and dates help most.';
    }
    var quarantined = !!String(input.website || '').trim();
    return { ok: Object.keys(errors).length === 0 && !quarantined, errors: errors, quarantined: quarantined };
  }

  /* ---------- Member trust-readiness (facts from the AICC curriculum) ---------- */
  /**
   * Readiness steps are drawn from the AI Command Center materials
   * (Location & Service Area pack; Module 6 Trust Stack). A step appears
   * ONLY when it is actually done — this is a checklist of facts,
   * never a score, and never a percentage.
   */
  function readinessSteps(member) {
    var steps = [];
    var r = (member && member.readiness) || {};
    if (r.locationCard && r.locationCard.done === true) {
      steps.push({
        label: 'Location Card completed',
        detail: 'Service area, hours, and local resources written down and checked — from the AI Command Center Location & Service Area pack.' +
          (r.locationCard.date ? ' Completed ' + r.locationCard.date + '.' : '')
      });
    }
    if (r.localSchema && r.localSchema.done === true) {
      steps.push({
        label: 'Local business schema published',
        detail: 'Machine-readable LocalBusiness facts (address, geo, hours) live on the member\u2019s own site, so search and AI assistants repeat true facts.' +
          (r.localSchema.url ? ' Published at ' + r.localSchema.url + '.' : '')
      });
    }
    var tp = trustpilotSummary(member);
    if (tp) {
      steps.push({
        label: 'Trustpilot linked',
        detail: 'Public Trustpilot profile cross-referenced on this page, with the verifier\u2019s dated observation.'
      });
    }
    return steps;
  }

  /* ---------- Evidence packet: the AI employee's work product ---------- */
  /**
   * Every application produces a structured evidence packet mirroring
   * VERIFICATION.md. The packet is designed to be PRE-FILLED by an AI
   * employee working the Verifier role card (see AI-VERIFIER.md):
   * the employee assembles evidence and flags concerns; the packet can
   * never contain a decision. A HUMAN grants or denies verified status.
   */
  var PACKET_LIMIT = 'This packet assembles evidence and flags concerns. It does not decide. A human grants or denies verified status — no AI employee can grant it, and no packet is complete without a human\u2019s dated decision recorded outside this document.';

  function buildEvidencePacket(application) {
    var a = application || {};
    function todo(label, prefilled) {
      return { label: label, prefilled: prefilled || '', status: 'TO BE CHECKED', finding: '', evidence: '' };
    }
    return {
      packetFor: a.business_name || '',
      applicantName: a.name || '',
      generatedFrom: 'founding application',
      referredBy: a.referred_by || '', // internal only — never displayed publicly
      sections: [
        { title: 'Storefront — live, and what it sells', items: [
          todo('Storefront URL (from application)', a.storefront_url),
          todo('Storefront loads and presents real products/services with real prices'),
          todo('One product/service + price observed (write it down)'),
          todo('Working path to purchase confirmed')
        ]},
        { title: 'Ownership signals', items: [
          todo('Applicant name (from application)', a.name),
          todo('Name as it appears on the storefront (About / policy / seller profile)'),
          todo('Corroboration (community profile, marketplace seller page) — URL')
        ]},
        { title: 'Contact path', items: [
          todo('Published contact path (email / form / platform messaging)'),
          todo('Test message sent — date'),
          todo('Human reply received — date (an auto-reply does not count)')
        ]},
        { title: 'Trustpilot observation (signal only — never pass/fail alone)', items: [
          todo('Profile URL, if one exists'),
          todo('TrustScore + review count AS SEEN, with the date seen'),
          todo('Reviews read: transaction-specific? owner responds to criticism?')
        ]},
        { title: 'Web fraud-signal check', items: [
          todo('Queries run (business name + domain + scam/complaint/refund)'),
          todo('Findings for THIS business (look-alike names are notes, not strikes)'),
          todo('Regulator action or impersonation warnings found? (facts + links)')
        ]},
        { title: 'Location & service area', items: [
          todo('As stated by the applicant', [a.sell_where, a.town, a.region].filter(Boolean).join(' · ')),
          todo('As evidenced on the storefront'),
          todo('Any contradiction between stated and evidenced?')
        ]},
        { title: 'Flags & concerns (employee raises; human weighs)', items: [
          todo('Anything that does not line up — stated plainly, with the evidence')
        ]}
      ],
      limit: PACKET_LIMIT,
      humanDecision: { decidedBy: '', date: '', outcome: '', note: 'Completed by the human verifier only. The packet author — human or AI employee — leaves this blank.' }
    };
  }

  var api = {
    CATEGORIES: CATEGORIES,
    categoriesInUse: categoriesInUse,
    AVERAGE_MIN: AVERAGE_MIN,
    PASS_MARKS: PASS_MARKS,
    CRITERIA: CRITERIA,
    COMPLAINT_CATEGORIES: COMPLAINT_CATEGORIES,
    escapeHTML: escapeHTML,
    isVerified: isVerified,
    verifiedBadge: verifiedBadge,
    memberStatusLabel: memberStatusLabel,
    computeStats: computeStats,
    trustpilotSummary: trustpilotSummary,
    reviewPublishable: reviewPublishable,
    publishedReviewsFor: publishedReviewsFor,
    heldReviewsFor: heldReviewsFor,
    starAverage: starAverage,
    haversineMiles: haversineMiles,
    memberDistanceMiles: memberDistanceMiles,
    distanceBucket: distanceBucket,
    coordsForZip: coordsForZip,
    filterMembers: filterMembers,
    validateApplication: validateApplication,
    validateReview: validateReview,
    computeTestCounters: computeTestCounters,
    complaintCounts: complaintCounts,
    validateComplaint: validateComplaint,
    readinessSteps: readinessSteps,
    buildEvidencePacket: buildEvidencePacket,
    PACKET_LIMIT: PACKET_LIMIT
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  global.TrustCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
