const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const CHECKOUT = 'https://contentsparkpro.lemonsqueezy.com/checkout/buy/ca205280-0116-4e4e-a5d6-37b4ab667652';
const NOTICE = 'Last updated November 5, 2026. This page describes how ContentSpark works in plain language. It is not legal advice.';

function read(name) {
  return fs.readFileSync(path.join(ROOT, name), 'utf8');
}

test('homepage states the product, shows pricing, and links Pro to the existing checkout', () => {
  const html = read('index.html');
  assert.match(html, /href="#pricing"/);
  assert.match(html, /id="pricing"/);
  assert.match(
    html,
    /ContentSpark is a free browser-based social caption, hook, and hashtag generator for social media creators, and ContentSpark Pro is a \$9\/month digital subscription for AI generation\./,
  );
  assert.match(html, /<h3>Free<\/h3>/);
  assert.match(html, /<p class="amount">\$0<\/p>/);
  assert.match(html, /Browser-based templates/);
  assert.match(html, /<h3>Pro<\/h3>/);
  assert.match(html, /<p class="amount">\$9<span>\/month<\/span><\/p>/);
  assert.match(html, /Lemon Squeezy license key/);
  assert.match(html, /Cancel anytime/);
  assert.match(html, new RegExp('id="pricingProBtn"[^>]*href="' + CHECKOUT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '"'));
  assert.equal(html.split(CHECKOUT).length - 1, 3);
  assert.match(html, /href="terms\.html"/);
  assert.match(html, /href="privacy\.html"/);
  assert.match(html, /href="refund\.html"/);
  assert.match(html, /Thad Waugh/);
  assert.match(html, /mailto:thad\.waugh@gmail\.com/);
  assert.equal(html.includes('{{CONTACT_EMAIL}}'), false);
  assert.match(html, /id="licenseKeyInput"/);
  assert.match(html, /id="proBuyBtn"/);
});

test('policy pages name the seller, the contact email, and the plain-language notice', () => {
  for (const name of ['terms.html', 'privacy.html', 'refund.html']) {
    const html = read(name);
    assert.match(html, /Thad Waugh/);
    assert.match(html, /mailto:thad\.waugh@gmail\.com/);
    assert.equal(html.includes('{{CONTACT_EMAIL}}'), false);
    assert.equal(html.includes(NOTICE), true, name);
    assert.match(html, /href="terms\.html"/);
    assert.match(html, /href="privacy\.html"/);
    assert.match(html, /href="refund\.html"/);
    assert.equal(html.includes(CHECKOUT), false, name);
  }

  const privacy = read('privacy.html');
  assert.match(privacy, /contentspark_license_key/);
  assert.match(privacy, /contentspark_license_instance/);
  assert.match(privacy, /localStorage/);
  assert.match(privacy, /does not sell your personal information/);
  assert.match(privacy, /Lemon Squeezy/);

  const refund = read('refund.html');
  assert.match(refund, /14 days/);
  assert.match(refund, /customer portal/);
  assert.match(refund, /Cancel anytime/);

  const terms = read('terms.html');
  assert.match(terms, /\$9 per month/);
  assert.match(terms, /merchant of record/);
  assert.match(terms, /refund\.html/);
});
