<?php

namespace Database\Seeders;

use App\Models\Driver;
use App\Models\Favorite;
use App\Models\Item;
use App\Models\Market;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductReview;
use App\Models\PromoCode;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Storage;

/**
 * Fills the storefront with realistic markets of every type: groceries, restaurants,
 * electronics, auto parts and more, with photos, deals (1+1, % and fixed), combos,
 * specifications, promo codes, VIP badges, reviews and a month of delivered orders.
 *
 * Data lives in database/seeders/data/demo-catalog.json and photos in
 * database/seeders/demo-media (see demo-media/CREDITS.md). Safe to run repeatedly.
 *
 *   php artisan db:seed --class=DemoCatalogSeeder
 */
class DemoCatalogSeeder extends Seeder
{
    private const PASSWORD = '123456';

    private const LOGO_COLORS = ['#2563eb', '#dc2626', '#16a34a', '#9333ea', '#ea580c', '#0891b2', '#db2777', '#4f46e5', '#ca8a04', '#0d9488', '#be123c', '#475569'];

    public function run(): void
    {
        mt_srand(2026);

        $catalog = json_decode(File::get(database_path('seeders/data/demo-catalog.json')), true, flags: JSON_THROW_ON_ERROR);
        $customers = $this->customers($catalog['customers']);
        $driver = Driver::query()->first();

        foreach ($catalog['markets'] as $index => $data) {
            $market = $this->market($data, $index);
            $items = $this->items($market, $data);
            $this->promoCodes($market, $data['promos'] ?? []);
            $orders = $this->orderHistory($market, $items, $customers, $driver);
            $this->reviews($market, $items, $customers, $orders, $catalog['review_comments']);
        }

        $this->favorites($customers[0]);
    }

    /** @return User[] customer@test.com first, then the extra demo customers. */
    private function customers(array $extra): array
    {
        $users = [User::firstOrCreate(['email' => 'customer@test.com'], ['name' => 'Customer User', 'password' => self::PASSWORD])];

        foreach ($extra as $data) {
            $users[] = User::firstOrCreate(['email' => $data['email']], ['name' => $data['name'], 'password' => self::PASSWORD]);
        }

        foreach ($users as $user) {
            $user->syncRoles(['customer']);
        }

        return $users;
    }

    private function market(array $data, int $index): Market
    {
        $owner = User::firstOrCreate(
            ['email' => $data['owner']['email']],
            ['name' => $data['owner']['name'], 'password' => self::PASSWORD],
        );
        if (!$owner->hasRole('owner')) {
            $owner->assignRole('owner');
        }

        $featured = $data['featured'] ?? null;
        $hours = $data['hours'] ?? 'always';

        $market = Market::updateOrCreate(['code' => $data['code']], [
            'name' => $data['name'],
            'market_type' => $data['type'],
            'owner_user_id' => $owner->id,
            'address' => $data['address'],
            'lat' => $data['lat'],
            'lng' => $data['lng'],
            'is_active' => true,
            'approval_status' => 'approved',
            'is_featured' => $featured !== null,
            'featured_badge' => $featured['badge'] ?? null,
            'featured_headline' => $featured['headline'] ?? null,
            'featured_copy' => $featured['copy'] ?? null,
            'featured_theme' => $featured['theme'] ?? null,
            'promotion_starts_at' => $featured ? now()->subDays(5) : null,
            'promotion_ends_at' => $featured ? now()->addDays(25) : null,
            'delivery_slots' => $data['delivery_slots'] ?? [],
            'uses_operating_schedule' => is_array($hours),
            'operating_hours' => is_array($hours) ? $this->weekHours($hours['open'], $hours['close']) : [],
            'is_manually_closed' => isset($data['manual_close']),
            'manual_close_comment' => $data['manual_close'] ?? null,
            'logo_path' => $this->logo($data['code'], $data['name'], self::LOGO_COLORS[$index % count(self::LOGO_COLORS)]),
            'banner_path' => $this->media("banners/{$data['code']}.jpg"),
        ]);

        $market->users()->syncWithoutDetaching([$owner->id => ['role' => 'owner']]);

        return $market;
    }

    private function weekHours(string $open, string $close): array
    {
        return collect(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'])
            ->map(fn (string $day) => ['day' => $day, 'enabled' => true, 'open' => $open, 'close' => $close])
            ->all();
    }

    /** @return array<string, Item> keyed by SKU */
    private function items(Market $market, array $data): array
    {
        $items = [];

        foreach ($data['items'] as $row) {
            $items[$row['sku']] = $this->item($market, $row, [
                'item_kind' => 'regular',
                'ingredients' => isset($row['ingredients'])
                    ? array_map(fn (array $i) => ['name' => $i[0], 'removable' => $i[1]], $row['ingredients'])
                    : null,
                'combo_offers' => null,
            ]);
        }

        // Upsell offers on regular items ("make it a meal") need the other items to exist first.
        foreach ($data['items'] as $row) {
            if (!empty($row['offers'])) {
                $items[$row['sku']]->update([
                    'combo_offers' => array_map(fn (array $offer) => $this->comboOffer($offer['name'], $offer['description'], $offer['price'], $offer['items'], $items), $row['offers']),
                ]);
            }
        }

        foreach ($data['combos'] ?? [] as $row) {
            $items[$row['sku']] = $this->item($market, $row, [
                'item_kind' => 'combo',
                'ingredients' => null,
                'combo_offers' => [$this->comboOffer($row['name'], $row['description'], $row['price'], $row['items'], $items)],
            ]);
        }

        return $items;
    }

    private function item(Market $market, array $row, array $extra): Item
    {
        $image = $this->media("items/{$row['sku']}.jpg");
        $discount = $row['discount'] ?? null;
        $promoted = (bool) ($row['promoted'] ?? false);

        return Item::updateOrCreate(['market_id' => $market->id, 'sku' => $row['sku']], [
            'name' => $row['name'],
            'category' => $row['category'],
            'price' => $row['price'],
            'discount_type' => $discount[0] ?? 'none',
            'discount_value' => $discount[1] ?? 0,
            'multi_buy' => isset($row['multi_buy']) && $market->supportsFeature('multi_buy')
                ? ['buy' => $row['multi_buy'][0], 'get' => $row['multi_buy'][1]]
                : null,
            'specs' => isset($row['specs']) && $market->supportsFeature('specs')
                ? array_map(fn (array $s) => ['label' => $s[0], 'value' => $s[1]], $row['specs'])
                : null,
            'variants' => isset($row['variants'])
                ? array_map(fn (array $v) => ['name' => $v[0], 'value' => $v[1], 'price_delta' => $v[2]], $row['variants'])
                : null,
            'stock_qty' => $row['stock'] ?? 50,
            'low_stock_threshold' => $row['low'] ?? 5,
            'show_stock_quantity' => true,
            'is_active' => true,
            'is_promoted' => $promoted,
            'promotion_starts_at' => $promoted ? now()->subDays(2) : null,
            'promotion_ends_at' => $promoted ? now()->addDays(12) : null,
            'image_path' => $image,
            'image_paths' => $image ? [$image] : null,
            ...$extra,
        ]);
    }

    /** Same shape ItemController::normalizeComboOffers() stores. */
    private function comboOffer(string $name, ?string $description, float $price, array $skus, array $items): array
    {
        $included = collect($skus)->map(fn (string $sku) => $items[$sku] ?? null)->filter()->values();

        return [
            'name' => $name,
            'description' => $description,
            'combo_price' => round($price, 2),
            'item_ids' => $included->pluck('id')->all(),
            'items' => $included->map(fn (Item $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'sku' => $item->sku,
                'ingredients' => $item->ingredients ?? [],
            ])->all(),
        ];
    }

    private function promoCodes(Market $market, array $promos): void
    {
        foreach ($promos as $promo) {
            PromoCode::updateOrCreate(['market_id' => $market->id, 'code' => $promo['code']], [
                'type' => $promo['type'],
                'value' => $promo['value'],
                'starts_at' => now()->subDays(3),
                'ends_at' => now()->addDays(60),
                'max_uses' => $promo['max_uses'],
                'is_active' => true,
            ]);
        }

        PromoCode::updateOrCreate(['market_id' => null, 'code' => 'WELCOME15'], [
            'type' => 'percent',
            'value' => 15,
            'starts_at' => now()->subDays(3),
            'ends_at' => now()->addDays(90),
            'max_uses' => 1000,
            'is_active' => true,
        ]);
    }

    /**
     * A few delivered orders per market over the last month so "Popular" rails,
     * dashboards and customer order history have real numbers.
     *
     * @return Order[]
     */
    private function orderHistory(Market $market, array $items, array $customers, ?Driver $driver): array
    {
        if (Order::where('market_id', $market->id)->where('code', 'like', 'SD-%')->exists()) {
            return Order::where('market_id', $market->id)->where('code', 'like', 'SD-%')->get()->all();
        }

        $regular = array_values(array_filter($items, fn (Item $item) => $item->item_kind !== 'combo' && $item->stock_qty > 0));
        $orders = [];

        for ($n = 0; $n < mt_rand(4, 7); $n++) {
            $customer = $customers[mt_rand(0, count($customers) - 1)];
            // The first order lands today so dashboards (which default to today) have numbers.
            $deliveredAt = $n === 0 ? now()->subMinutes(mt_rand(20, 180)) : now()->subDays(mt_rand(1, 30))->subMinutes(mt_rand(0, 600));
            $lines = collect(array_rand(array_flip(array_keys($regular)), min(count($regular), mt_rand(1, 3))))
                ->map(function ($key) use ($regular) {
                    $item = $regular[$key];
                    $qty = mt_rand(1, 3);
                    $unit = (float) $item->price;

                    return ['item' => $item, 'qty' => $qty, 'unit' => $unit, 'total' => $unit * $item->paidQuantity($qty)];
                });
            $subtotal = round($lines->sum('total'), 2);
            $nextId = (int) Order::max('id') + 1;

            $order = Order::create([
                'market_id' => $market->id,
                'customer_user_id' => $customer->id,
                'assigned_driver_id' => $driver?->id,
                'code' => 'SD-' . str_pad((string) (10000 + $nextId), 6, '0', STR_PAD_LEFT),
                'receipt_number' => 'RCT-' . $deliveredAt->format('Ymd') . '-' . str_pad((string) $nextId, 5, '0', STR_PAD_LEFT),
                'pickup_lat' => $market->lat,
                'pickup_lng' => $market->lng,
                'dropoff_lat' => 41.69 + mt_rand(0, 60) / 1000,
                'dropoff_lng' => 44.74 + mt_rand(0, 80) / 1000,
                'pickup_address' => $market->address,
                'dropoff_address' => mt_rand(1, 120) . ' ' . ['Pekini Ave', 'Chavchavadze Ave', 'Kostava St', 'Paliashvili St', 'Tsinamdzghvrishvili St'][mt_rand(0, 4)] . ', Tbilisi',
                'customer_name' => $customer->name,
                'customer_phone' => '+995 555 ' . mt_rand(100, 999) . ' ' . mt_rand(100, 999),
                'priority' => 2,
                'size' => 2,
                'subtotal' => $subtotal,
                'discount_total' => 0,
                'total' => $subtotal,
                'status' => 'DELIVERED',
                'market_accepted_at' => $deliveredAt->copy()->subMinutes(45),
                'ready_for_pickup_at' => $deliveredAt->copy()->subMinutes(30),
                'accepted_at' => $deliveredAt->copy()->subMinutes(25),
                'picked_up_at' => $deliveredAt->copy()->subMinutes(15),
                'delivered_at' => $deliveredAt,
                'estimated_delivery_at' => $deliveredAt,
                'promised_at' => $deliveredAt->copy()->addMinutes(10),
                'customer_rating' => mt_rand(4, 5),
            ]);
            // Timestamps are not mass assignable; backdate them so history spreads over the month.
            $order->forceFill(['created_at' => $deliveredAt->copy()->subMinutes(50), 'updated_at' => $deliveredAt])->saveQuietly();

            foreach ($lines as $line) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'item_id' => $line['item']->id,
                    'name' => $line['item']->name,
                    'sku' => $line['item']->sku,
                    'qty' => $line['qty'],
                    'unit_price' => $line['unit'],
                    'line_total' => $line['total'],
                ]);
            }

            $orders[] = $order;
        }

        return $orders;
    }

    private function reviews(Market $market, array $items, array $customers, array $orders, array $comments): void
    {
        if (ProductReview::where('market_id', $market->id)->exists()) {
            return;
        }

        $regular = array_values(array_filter($items, fn (Item $item) => $item->item_kind !== 'combo'));

        for ($n = 0; $n < mt_rand(4, 8); $n++) {
            $rating = [5, 5, 5, 4, 4, 3][mt_rand(0, 5)];
            $pool = $comments[(string) $rating];
            $order = $orders[$n] ?? null;

            $review = ProductReview::create([
                'market_id' => $market->id,
                'item_id' => $n % 3 === 0 ? null : $regular[mt_rand(0, count($regular) - 1)]->id,
                'user_id' => $order?->customer_user_id ?? $customers[mt_rand(0, count($customers) - 1)]->id,
                'order_id' => $order?->id,
                'rating' => $rating,
                'comment' => $pool[mt_rand(0, count($pool) - 1)],
            ]);
            $review->forceFill(['created_at' => now()->subDays(mt_rand(1, 28))])->saveQuietly();
        }
    }

    private function favorites(User $customer): void
    {
        foreach (['FRESH', 'SMOKE', 'DEDA'] as $code) {
            $market = Market::where('code', $code)->first();
            if ($market) {
                Favorite::firstOrCreate(['user_id' => $customer->id, 'market_id' => $market->id, 'item_id' => null]);
            }
        }
    }

    /** Copies a bundled photo to the public disk; returns its path or null if the photo is missing. */
    private function media(string $relative): ?string
    {
        $source = database_path("seeders/demo-media/{$relative}");
        if (!File::exists($source)) {
            return null;
        }

        $target = "demo/{$relative}";
        Storage::disk('public')->put($target, File::get($source));

        return $target;
    }

    /** Generates a simple round monogram logo as SVG. */
    private function logo(string $code, string $name, string $color): string
    {
        $words = preg_split('/[\s&]+/', preg_replace("/[^A-Za-z\s&]/", '', $name), -1, PREG_SPLIT_NO_EMPTY);
        $initials = strtoupper(substr($words[0] ?? 'S', 0, 1) . substr($words[1] ?? '', 0, 1));
        $svg = <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128"><rect width="128" height="128" rx="28" fill="{$color}"/><text x="64" y="64" dy=".35em" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="52" font-weight="700" fill="#fff">{$initials}</text></svg>
SVG;
        $path = "demo/logos/{$code}.svg";
        Storage::disk('public')->put($path, $svg);

        return $path;
    }
}
