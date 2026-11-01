/**
 * Trust Network — member + review data.
 *
 * At founding scale this file IS the database, edited by a human after
 * verification (see VERIFICATION.md). Rules that bind every edit:
 *   - verified is false for every new member. It becomes true only after
 *     the full manual checklist passes, with verifiedDate + checks recorded.
 *   - No statistic is ever typed into copy — the app computes them.
 *   - A review's status becomes 'published' only after the member matches
 *     its transaction reference (transactionMatched: true).
 *   - Facts only. If it wasn't checked, it isn't written here.
 *
 * Member #1 below was verified against its real facts on 2026-11-01.
 * The full worked verification record is in VERIFICATION.md.
 */
window.TRUST_MEMBERS = [
  {
    id: 'artisy',
    businessName: 'ARTISY — T. Lott Creative',
    ownerName: 'Ting Lott',
    category: 'Health, Wellness & Faith Resources',
    secondaryCategories: ['Digital Products & Downloads', 'Books, Writing & Publishing'],
    sellsWhat: 'Nurse-designed digital wellness products: audiobooks, faith coloring books, wellness guides, music, and AI tools — designed by a registered nurse with 17 years of experience.',
    servesOnline: true,
    baseTown: 'Hahira',
    region: 'Georgia',
    country: 'US',
    serviceArea: 'Serves online — digital delivery, no local service area',
    lat: null,
    lng: null,
    storefrontUrl: 'https://shop.artistrystore.com',
    trustpilot: {
      url: 'https://www.trustpilot.com/review/artistrystore.com',
      trustScore: 3.7,
      reviewCount: 4,
      recordedDate: '2026-11-01',
      recordedNote: 'Seen by the verifier on the public Trustpilot page on November 1, 2026: TrustScore 3.7, counted over the 4 reviews Trustpilot uses for the score (5 reviews on the page in total). The reviews are mixed — real praise, including a customer\u2019s 5-star review of the book Sent From Home, and one 1-star complaint from October 2025. A mixed page is what a real business looks like; we record it as one signal, not a verdict.'
    },
    memberSince: '2026-11-01',
    readiness: {
      locationCard: { done: true, date: '2026-11-01', source: 'AI Command Center — Location & Service Area pack (ARTISY worked example)' },
      localSchema: { done: false }
    },
    verified: true,
    verifiedDate: '2026-11-01',
    checks: [
      'Named owner matches the storefront: the store names Ting Lott (T. Lott Creative) as its owner',
      'Storefront live and selling, checked November 1, 2026 — priced products with working checkout via Gumroad, Whop, and JVZoo',
      'Contact path published on the storefront (tinglott@gmail.com) and actively answered by the owner',
      'Web check on November 1, 2026: no fraud pattern found for this business or its domain',
      'Location stated truthfully: an online store — "serves online," based in Hahira, Georgia'
    ],
    verificationScope: 'Identity, storefront, and ownership checked on November 1, 2026. This is not a guarantee of service quality.',
    notes: 'Name note: unrelated businesses with similar names (in other countries) carry complaints online. They are not this store. This profile exists so you can tell the difference.'
  }
];

window.TRUST_REVIEWS = [
  {
    id: 'artisy-review-angela-cook',
    memberId: 'artisy',
    reviewerName: 'Angela Cook',
    stars: 5,
    product: 'Sent From Home (book)',
    text: 'This isn’t another self-help book promising five easy steps to discovering your purpose. Instead, it’s something rarer: a companion for the journey, one that combines scriptural depth with psychological research and pastoral warmth.',
    transactionRef: 'Whop purchase — Sent From Home',
    transactionMatched: true,
    status: 'published',
    basis: 'Written by the buyer and posted on the Whop product page for Sent From Home, where the purchase was made.',
    dateLabel: 'Posted on Whop, 2026'
  }
];

/**
 * Complaints on the public record. Starts EMPTY — ARTISY has none, so its
 * profile shows no complaint counts at all (counts render only when real
 * complaints exist). A complaint lands here only after human review moves
 * it through its states; resolved entries must carry the outcome text.
 * Intake submissions live in the capture queue/Sheet first — never here
 * directly. See core.js → complaintCounts().
 */
window.TRUST_COMPLAINTS = [];
