# TripShare

TripShare is a private carpool fuel-expense ledger for a vehicle owner. Passengers are owner-managed contacts: they never create accounts or access the app. The Next.js PWA and native Expo app share one authenticated tRPC API, Drizzle/PostgreSQL database, and integer-paise accounting library.

## Features

- Owner accounts with Better Auth email/password sessions
- Private groups with vehicle, average mileage, normal one-way distance, and tracking start date
- Contact-only group members with active/inactive status
- One-way and return journeys with explicit attendance
- Backend-only local petrol and diesel pricing from the trip's selected state and district
- Clear manual price fallback when the live-price source is unavailable or malformed
- Immutable journey snapshots of distance, mileage, petrol price, source, total cost, and participant shares
- Manual partial payments by UPI, cash, bank transfer, or other method
- Responsive Next.js PWA and genuine Expo Router native screens with light/dark support

## Local setup

Requirements: Node.js, pnpm 11, and PostgreSQL.

1. Copy or fill the existing `.env` files without committing secrets.
2. Set these server values in `apps/web/.env`:

   ```dotenv
   NODE_ENV=development
   BETTER_AUTH_SECRET=replace-with-at-least-32-random-characters
   BETTER_AUTH_URL=http://localhost:3001
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/tripshare
   GOOGLE_CLIENT_ID=your-google-web-client-id
   GOOGLE_CLIENT_SECRET=your-google-web-client-secret
   ```

3. Set `EXPO_PUBLIC_SERVER_URL=http://YOUR-LAN-IP:3001` in `apps/native/.env` for a physical device. Android emulators commonly use `http://10.0.2.2:3001`.
4. Install and migrate:

   ```bash
   pnpm install
   pnpm --filter @TripShare/db db:migrate
   ```

5. Run `pnpm dev:web` and, separately, `pnpm dev:native`.

The generated migrations are in `packages/db/src/migrations`. Current petrol/diesel prices are read server-side from MyPetrolPrice; no fuel API key is required. If that source is unavailable, journey entry clearly offers a manual price instead.

Authentication uses Google OAuth only. A partner receives read-only access when the email saved on their person record matches their Google account email.

For Google OAuth, create a Web application credential in Google Cloud and register these authorized redirect URIs:

```text
http://localhost:3001/api/auth/callback/google
https://tripshare.ashtonmths.dev/api/auth/callback/google
```

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` in the Vercel Production environment, then redeploy. The Google button is available on both sign-in and account creation screens.

The Expo project uses EAS Build and EAS Update with `development`, `preview`, and `production` channels. The production EAS environment must contain:

```text
EXPO_PUBLIC_SERVER_URL=https://tripshare.ashtonmths.dev
```

Publish compatible JavaScript and asset changes with:

```bash
cd apps/native
pnpm dlx eas-cli@latest update --channel production --environment production --message "Describe the update"
```

Native dependency or Expo SDK changes require a new store build rather than an OTA update.

## Accounting model

Fuel cost is `(distance km / mileage km/l) × petrol price`. Calculations use paise, round the total once, and distribute any remainder one paise at a time so participant shares always equal the saved total. Each journey copies the group mileage and current/manual petrol price into its own row. Later vehicle or fuel-price changes therefore cannot rewrite history.

Balances are `journey shares − recorded payments`. Overpayments are retained as credit (a negative balance), and partial payments reduce the balance immediately.

## Verification

```bash
pnpm check-types
pnpm exec biome check .
pnpm --filter @TripShare/shared test
pnpm --filter @TripShare/db db:generate
pnpm --filter web build
pnpm build
pnpm --filter native check-types
```

Database deployment checks require a reachable `DATABASE_URL`; schema generation does not.
