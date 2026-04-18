# Smart Dispatch

Smart Dispatch is a multi-app delivery and dispatch workspace built as a test/demo project.

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
- Cart and checkout flow
- Order lifecycle from creation to delivery
- Driver offer, accept, decline, pickup, and delivery flow
- Driver payout preview and delivery earnings
- Market item and promo management
- Admin user and driver management
- Live dispatch and route-related views
- Notification support
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

This repository is currently a test/demo workspace. Add your preferred license here before publishing publicly if needed.
