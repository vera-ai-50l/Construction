# WhatsApp setup for Desk 05

Meta's screens change often; if a label differs, look for the nearest equivalent. Parts 1 to 6 need no server. Part 7 needs n8n on a public HTTPS address.

**Before you start**: a number not registered on any WhatsApp app (delete that account first if it is), able to get an SMS or call; a personal Facebook account with two-factor login on; a payment card. GST or incorporation papers are not needed for the pilot.

## 1. Business portfolio (10 min)
business.facebook.com → Create a business portfolio (business name, your name, work email) → Settings → Business info. Business verification (GST / incorporation) can wait: unverified, Vera can start conversations with about 250 people a day and use 2 numbers, which is enough for a pilot.

## 2. App (10 min)
developers.facebook.com → My Apps → Create app → use case "Connect with customers through WhatsApp" (or Other → Business) → name "Vera Mobilisation", pick the portfolio → WhatsApp → API Setup. This creates the WhatsApp Business Account. Optional: send "Hello World" from the free test number to your own phone.

## 3. Your number (15 min + name review)
API Setup → Add phone number (or WhatsApp Manager → Phone numbers). Display name clearly tied to the business ("Vera", "Vera by <company>"), category Professional services, number with +91, verify by SMS or call. Do not open the WhatsApp app on this number afterwards.

## 4. Permanent token (10 min)
business.facebook.com → Settings → Users → System users → Add "vera-n8n", role **Admin** → Assign assets: the app (full control) and the WhatsApp account (full control) → Generate new token: app "Vera Mobilisation", expiry Never, permissions whatsapp_business_messaging + whatsapp_business_management (+ business_management if offered). Copy it once into a password manager. Never paste it in chat or email.

## 5. Values to collect
| Value | Where | Secret |
|---|---|---|
| Phone number ID | App → WhatsApp → API Setup | no |
| WhatsApp Business Account ID | same page | no |
| App secret | App settings → Basic | yes: server `.env` only |
| Access token | step 4 | yes: secure form and n8n credential only |

## 6. Payment (5 min)
WhatsApp Manager (or Settings → Billing & payments) → add a card in INR. Only messages Vera starts are charged.

## 6b. Done through the API (by Claude, with the token in the environment's secure store)
Register the number (`POST /{phone-number-id}/register` with a 6-digit PIN you choose and keep); subscribe the app to the WhatsApp account (`POST /{waba-id}/subscribed_apps`); submit the templates in `n8n/mobilise/messages.mjs` (`TEMPLATES`); send a test message.

## 7. Receiving messages (needs the server)
1. Server `.env`: `VERA_WA_APP_SECRET`, `VERA_WA_VERIFY_TOKEN` (any long random text), `VERA_WA_PHONE_NUMBER_ID`.
2. n8n credential "WhatsApp Cloud API token": Header Auth, name `Authorization`, value `Bearer <token>`.
3. Import and publish the workflows (README → Deploying).
4. App → WhatsApp → Configuration → Webhook: callback `https://<n8n>/webhook/vera/mob/wa`, verify token = `VERA_WA_VERIFY_TOKEN` → Verify and save → subscribe the `messages` field.
5. App settings → Basic: privacy policy URL, then App mode → Live.

## 8. End-to-end check
Set up a test site with your own number as contractor → "Show me" → tap → area lists → reply to the labour camp list with a photo captioned "3" → one reply "Filed: LC-03" within about 2 minutes → send *status* → gap list.
