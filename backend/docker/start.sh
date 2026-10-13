#!/bin/sh
set -e

if [ -z "$APP_KEY" ]; then
  export APP_KEY="base64:$(head -c 32 /dev/urandom | base64)"
fi

rm -f "$DB_DATABASE"
touch "$DB_DATABASE"

php artisan config:cache
php artisan route:cache
php artisan migrate --force
php artisan db:seed --force
php artisan storage:link || true

exec php artisan serve --host=0.0.0.0 --port="$PORT"
