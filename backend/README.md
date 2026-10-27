# TOROLAGON checkout service

The static storefront is served by GitHub Pages. Checkout sessions and inventory are handled only by the separate `torolagon-checkout` Cloudflare Worker. Domain and DNS configuration are unchanged.

## Launch gates

`TEST_ENABLED` and `LIVE_ENABLED` are enabled. The three-product sandbox payment (6297 USD cents), verified paid return and actual webhook delivery (HTTP 200, received true) passed. Live Checkout was verified with all three existing prices, required email, U.S.-only shipping, free shipping, and cancellation back to the saved cart; no real charge was submitted. Live payment notification delivery remains to be observed on the first real payment. A successful return page never marks an order paid. The server checks Stripe's payment status; only verified payment notifications and reconciliation update order state.

Encrypted Worker secrets (never store values in GitHub, chat, local source, or browser code):

- `STRIPE_TEST_KEY`: restricted test API key
- `STRIPE_TEST_WEBHOOK_SECRET`: signing secret for `/test/webhook`
- `STRIPE_LIVE_KEY`: restricted live API key
- `STRIPE_LIVE_WEBHOOK_SECRET`: signing secret for `/live/webhook`

Stripe keys need Checkout Sessions read/write, and Products/Prices read. Customer creation also requires appropriate Customer access. Never use the expiring CLI login credential as a production credential.

Webhook endpoints:

- `https://torolagon-checkout.businessmen3737.workers.dev/test/webhook`
- `https://torolagon-checkout.businessmen3737.workers.dev/live/webhook`

Events: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`.

Test page: `/checkout-test.html` (no real charges, not indexed or linked from navigation). Success return: `/order-success.html`. Cancel return: `/cart.html?checkout=cancelled`.

## Inventory and fulfillment

Separate SQLite-backed Durable Objects isolate test and live inventory. Each starts with 50 units of each of the three individual products. The Oil & Spray Kit shares oil and spray stock: one kit reserves one of each. Kit availability is the lower of the two component quantities; mixed carts aggregate all component demand before reserving atomically. Inventory is reserved atomically before creating Checkout, and released only after a confirmed expired or failed session. Network uncertainty keeps a reservation in place. Sessions expire after 31 minutes; reconciliation retries uncertain operations using the same idempotency key. Persistent uncertainty needs operator review rather than restoring stock blindly.

Paid orders remain in Stripe for the merchant to prepare and ship within 24–48 hours. Use Stripe's payment notifications and Dashboard; this service does not purchase labels or send tracking emails. Stripe customer receipts must be enabled. No separate shipment notification system is claimed to be automated.

Current live prices map to Stripe Prices at 1799 cents for the TOROLAGON spray, 1599 cents for oil, 1799 cents for Dragon Power 9000, and 2998 cents for the Oil & Spray Kit. Historical prices remain for existing order references. Test sessions use the same authoritative amounts. Neither client-supplied prices nor unknown product IDs are trusted. Only U.S. shipping addresses are accepted, shipping is free, billing address is collected, and Checkout collects customer email.

No active tax registrations were present in Stripe at setup, so automatic tax collection is not enabled. Registration and applicable obligations must be resolved by the merchant before enabling collection.

## Verification

Run `npm test` in `backend/` for cart validation, tampered prices, concurrent inventory reservations, idempotency, asynchronous failures, payment field validation, signature validation, and origin protection. These checks do not substitute for a real Stripe test-mode checkout and webhook delivery verification. After test checkout passes, enable live credentials and check the live hosted payment form without submitting a paid order.
