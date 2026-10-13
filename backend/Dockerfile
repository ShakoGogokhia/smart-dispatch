# Free demo deployment (Render). SQLite lives inside the container and is
# re-created + seeded on every start, so the public demo resets itself.
FROM php:8.4-cli

COPY --from=mlocati/php-extension-installer:2.7 /usr/bin/install-php-extensions /usr/local/bin/
RUN apt-get update && apt-get install -y --no-install-recommends unzip git \
    && install-php-extensions zip intl bcmath gd pcntl \
    && rm -rf /var/lib/apt/lists/*
COPY --from=composer:2.8 /usr/bin/composer /usr/bin/composer

WORKDIR /app
COPY composer.json composer.lock ./
RUN composer install --no-dev --no-scripts --no-autoloader --prefer-dist --no-interaction

COPY . .
RUN composer dump-autoload --optimize --no-dev \
    && chmod +x docker/start.sh

ENV APP_ENV=production \
    APP_DEBUG=false \
    DB_CONNECTION=sqlite \
    DB_DATABASE=/app/database/database.sqlite \
    LOG_CHANNEL=stderr \
    PHP_CLI_SERVER_WORKERS=4 \
    PORT=8000

EXPOSE 8000
CMD ["docker/start.sh"]
