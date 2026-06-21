# Smart Dispatch

Smart Dispatch is a multi-app delivery and dispatch workspace built as a test/demo project.

## Author

Created by **Shako Gogokhia**.

It combines:
- a Laravel API backend
- a React + Vite web app
- an Expo React Native mobile app

The project simulates a small delivery ecosystem where customers can place orders, markets can manage items and promos, drivers can accept deliveries, and admins can oversee users, routes, and operations.

## Project Status

This is a test project for development, learning, feature experiments, and workflow prototyping.

It is not intended to be treated as a production-ready system. Some parts are intentionally lightweight and optimized for iteration rather than hardened deployment.

## Main Features

- Customer registration and login
- Saved customer profile data for checkout autofill
- Public market browsing
- Public order tracking by order code
- Cart and checkout flow
- Customer order history, receipts, reorder, refund, and rating flows
- Order lifecycle from creation to delivery
- Driver offer, accept, decline, pickup, and delivery flow
- Driver shift earnings dashboard and transaction history
- Driver payout preview and delivery earnings
- Market item and promo management
- Market owner dashboard with revenue, top items, ratings, promo usage, approvals, and stock warnings
- Inventory alerts with out-of-stock hiding tools
- Dispatch console with assignment reasoning, offer timeout, driver capacity, distance, and decline visibility
- Admin user and driver management
- Live dispatch and route-related views
- Notification center with filters and mark-all-read support
- Demo scenario generator for realistic local data
- Web and mobile interfaces connected to the same backend

## Tech Stack

### Backend
- PHP 8.2+
- Laravel 12
- Laravel Sanctum
- Spatie Laravel Permission
- SQLite by default for local development

### Web
- React 19
- TypeScript
- Vite
- TanStack Query
- Axios

### Mobile
- Expo
- React Native
- TypeScript
- React Navigation
- TanStack Query

## Repository Structure

```text
smart-dispatch/
  backend/   Laravel API and database
  web/       React web application
  mobile/    Expo mobile application
```

## Local Setup

### 1. Backend

```bash
cd backend
composer install
copy .env.example .env
php artisan key:generate
php artisan migrate
php artisan db:seed
npm install
php artisan serve
```

### 2. Web

```bash
cd web
npm install
npm run dev
```

### 3. Mobile

```bash
cd mobile
npm install
copy .env.example .env
npx expo start
```

## Demo Accounts

After running `php artisan db:seed`, the default local accounts are:

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@test.com` | `123456` |
| Customer | `customer@test.com` | `123456` |
| Market owner | `owner@test.com` | `123456` |
| Driver | `driver@test.com` | `123456` |

Admins can also open **Demo scenario** in the web app to create fresh demo markets, lifecycle orders, low-stock items, driver pings, route stops, reviews, and notifications.

## New Demo Flows

- Public tracking: open `/track` or `/track/{orderCode}` in the web app.
- Customer history: sign in as a customer and open **Order history**.
- Driver earnings: sign in as the driver and open **Earnings**.
- Market dashboard: sign in as an owner/admin, select a market, then open **Dashboard**.
- Inventory alerts: open a market and use **Inventory alerts**.
- Dispatch insights: open **Dispatch** to inspect candidate drivers and assignment reasoning.
- Notifications: open **Notifications** to filter unread/order/driver/market messages and mark them read.
- Payments: customer order history can simulate mock-card or cash-on-delivery payment states.
- Support: open **Support** for customer issues, replies, and internal/admin handling.
- Approvals and audit: admins can open **Approvals** and **Audit logs**.

## Realtime, Uploads, And CI

- Backend events are broadcast for order and notification updates. By default `BROADCAST_CONNECTION=log` keeps local setup simple; configure Laravel Reverb or Pusher-compatible credentials to enable WebSocket delivery.
- Driver proof-of-delivery photos are stored on the public filesystem disk. Run `php artisan storage:link` if local uploaded files are not visible in the browser.
- GitHub Actions checks are included for backend tests, web build, mobile lint, and mobile TypeScript.

## Notes

- The backend uses SQLite in local development.
- If you pull new changes that include database updates, run `php artisan migrate` again.
- Some seeded/demo accounts may exist depending on your local database seeders.

## Why This Exists

This repository is mainly for:
- testing product ideas
- experimenting with delivery workflows
- building UI/UX flows for customer, driver, market, and admin roles
- trying backend and frontend integrations quickly

## Production Notice

Before using something like this in production, you would still want to review:
- authentication hardening
- validation and permissions
- error handling
- environment management
- logging and monitoring
- deployment setup
- test coverage
- security review

## License

This repository uses a custom license by **Shako Gogokhia**.

See [LICENSE](./LICENSE) for the full terms.

## Attribution

Please keep visible credit to **Shako Gogokhia** as the original author of this project.

You can also find authorship details in [AUTHORS.md](./AUTHORS.md) and [NOTICE.md](./NOTICE.md).
