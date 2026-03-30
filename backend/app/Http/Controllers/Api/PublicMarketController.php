<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Market;
use App\Models\MarketPublicClick;
use App\Models\PromoCode;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class PublicMarketController extends Controller
{
    protected function applyFeaturedOrdering($query)
    {
        if (Market::hasFeaturedColumns()) {
            $query
                ->orderByDesc('is_featured')
                ->orderBy('featured_sort_order')
                ->orderBy('name');
        }

        return $query;
    }

    public function markets()
    {
        $markets = $this->applyFeaturedOrdering(Market::query())
            ->where('is_active', true)
            ->withCount([
                'items as active_items_count' => function ($query) {
                    $query->where('is_active', true);
                },
                'orders as rating_count' => function ($query) {
                    $query->whereNotNull('customer_rating');
                },
            ])
            ->withAvg([
                'orders as average_rating' => function ($query) {
                    $query->whereNotNull('customer_rating');
                },
            ], 'customer_rating')
            ->with([
                'items' => function ($query) {
                    $query
                        ->where('is_active', true)
                        ->select([
                            'id',
                            'market_id',
                            'name',
                            'sku',
                            'price',
                            'discount_type',
                            'discount_value',
                            'stock_qty',
                        ])
                        ->orderByDesc('stock_qty')
                        ->orderBy('name');
                },
                'promoCodes' => function ($query) {
                    $query
                        ->activeApplicable()
                        ->latest()
                        ->limit(1);
                },
            ])
            ->get();

        return $markets->map(fn (Market $market) => $this->serializeMarket($market))->values();
    }

    public function market(Market $market)
    {
        abort_unless($market->is_active, 404);

        $market
            ->loadCount([
                'items as active_items_count' => function ($query) {
                    $query->where('is_active', true);
                },
                'orders as rating_count' => function ($query) {
                    $query->whereNotNull('customer_rating');
                },
            ])
            ->loadAvg([
                'orders as average_rating' => function ($query) {
                    $query->whereNotNull('customer_rating');
                },
            ], 'customer_rating')
            ->load([
                'promoCodes' => function ($query) {
                    $query
                        ->activeApplicable()
                        ->latest()
                        ->limit(1);
                },
            ]);

        return $this->serializeMarket($market);
    }

    public function items(Request $request, Market $market)
    {
        abort_unless($market->is_active, 404);

        $query = $market->items()
            ->where('is_active', true)
            ->select([
                'id',
                'market_id',
                'name',
                'sku',
                'price',
                'discount_type',
                'discount_value',
                'is_active',
                'stock_qty',
            ])
            ->orderBy('name');

        if ($request->filled('q')) {
            $search = mb_strtolower(trim((string) $request->query('q')));
            $query->where(function (Builder $builder) use ($search) {
                $builder
                    ->whereRaw('LOWER(name) LIKE ?', ["%{$search}%"])
                    ->orWhereRaw('LOWER(sku) LIKE ?', ["%{$search}%"]);
            });
        }

        return $query->get();
    }

    public function activePromo(Market $market)
    {
        abort_unless($market->is_active, 404);

        $promo = $market->promoCodes()
            ->activeApplicable()
            ->orderByDesc('id')
            ->first();

        if (!$promo) {
            return null;
        }

        return [
            'id' => $promo->id,
            'code' => $promo->code,
            'type' => $promo->type,
            'value' => $promo->value,
            'is_active' => (bool) $promo->is_active,
        ];
    }

    public function validatePromo(Request $request, Market $market)
    {
        abort_unless($market->is_active, 404);

        $data = $request->validate([
            'code' => ['required', 'string', 'max:50'],
            'subtotal' => ['required', 'numeric', 'min:0'],
        ]);

        $subtotal = (float) $data['subtotal'];
        $promo = $this->resolvePromoCode($market, $data['code']);

        if (!$promo) {
            return response()->json([
                'valid' => false,
                'message' => 'Promo code is invalid for this market.',
                'discount_total' => 0,
                'total' => $subtotal,
            ]);
        }

        $discountTotal = $this->calculateDiscount($promo, $subtotal);

        return response()->json([
            'valid' => true,
            'promo' => [
                'id' => $promo->id,
                'code' => $promo->code,
                'type' => $promo->type,
                'value' => $promo->value,
                'is_active' => (bool) $promo->is_active,
            ],
            'discount_total' => $discountTotal,
            'total' => max(0, $subtotal - $discountTotal),
        ]);
    }

    public function trackClick(Request $request, Market $market)
    {
        abort_unless($market->is_active, 404);

        $data = $request->validate([
            'source' => ['nullable', 'string', 'max:80'],
            'visitor_key' => ['nullable', 'string', 'max:120'],
        ]);

        MarketPublicClick::create([
            'market_id' => $market->id,
            'user_id' => $request->user()?->id,
            'visitor_key' => $data['visitor_key'] ?? null,
            'source' => $data['source'] ?? 'public-card',
        ]);

        return response()->json(['tracked' => true]);
    }

    private function serializeMarket(Market $market): array
    {
        $activePromo = $market->promoCodes->first();
        $featuredBadge = $market->hasActiveBadge() ? $market->featured_badge : null;

        return [
            'id' => $market->id,
            'name' => $market->name,
            'code' => $market->code,
            'address' => $market->address,
            'category' => $market->category,
            'lat' => Market::hasCoordinateColumns() && $market->lat !== null ? (float) $market->lat : null,
            'lng' => Market::hasCoordinateColumns() && $market->lng !== null ? (float) $market->lng : null,
            'is_active' => (bool) $market->is_active,
            'is_open_now' => $market->is_open_now,
            'opens_at' => $market->opens_at,
            'closes_at' => $market->closes_at,
            'is_featured' => Market::hasFeaturedColumns() ? $market->isFeatureLive() : false,
            'featured_badge' => $featuredBadge,
            'featured_headline' => Market::hasFeaturedColumns() ? $market->featured_headline : null,
            'featured_copy' => Market::hasFeaturedColumns() ? $market->featured_copy : null,
            'badge_expires_at' => $featuredBadge ? optional($market->badge_expires_at)?->toDateTimeString() : null,
            'logo_url' => $market->logo_url,
            'cover_url' => $market->cover_url,
            'minimum_order' => (float) ($market->minimum_order ?? 0),
            'delivery_eta_minutes' => $market->delivery_eta_minutes ? (int) $market->delivery_eta_minutes : null,
            'active_items_count' => (int) ($market->active_items_count ?? 0),
            'average_rating' => $market->average_rating !== null ? round((float) $market->average_rating, 2) : null,
            'rating_count' => (int) ($market->rating_count ?? 0),
            'active_promo' => $activePromo ? [
                'id' => $activePromo->id,
                'code' => $activePromo->code,
                'type' => $activePromo->type,
                'value' => $activePromo->value,
                'is_active' => (bool) $activePromo->is_active,
            ] : null,
            'item_preview' => $market->relationLoaded('items')
                ? $market->items->take(4)->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'name' => $item->name,
                        'sku' => $item->sku,
                        'price' => $item->price,
                        'discount_type' => $item->discount_type,
                        'discount_value' => $item->discount_value,
                        'stock_qty' => $item->stock_qty,
                    ];
                })->values()
                : [],
        ];
    }

    private function resolvePromoCode(Market $market, string $code): ?PromoCode
    {
        $normalizedCode = mb_strtoupper(trim($code));

        return PromoCode::query()
            ->whereRaw('UPPER(code) = ?', [$normalizedCode])
            ->where(function ($query) use ($market) {
                $query
                    ->where('market_id', $market->id)
                    ->orWhereNull('market_id');
            })
            ->activeApplicable()
            ->orderByRaw('CASE WHEN market_id = ? THEN 0 ELSE 1 END', [$market->id])
            ->latest()
            ->first();
    }

    private function calculateDiscount(PromoCode $promo, float $subtotal): float
    {
        if ($subtotal <= 0) {
            return 0.0;
        }

        $value = (float) $promo->value;

        if ($promo->type === 'percent') {
            return min($subtotal, round($subtotal * ($value / 100), 2));
        }

        return min($subtotal, round($value, 2));
    }
}
