<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Market;
use App\Models\PromoCode;
use App\Models\ProductReview;
use Illuminate\Http\Request;

class PublicMarketController extends Controller
{
    protected function applyFeaturedOrdering($query)
    {
        if (Market::hasFeaturedColumns()) {
            $query->orderByDesc('is_featured');
        }

        return $query;
    }

    // GET /api/public/markets
    public function markets()
    {
        $marketsQuery = $this->applyFeaturedOrdering(Market::query())
            ->where('is_active', true)
            ->withCount(['items as active_items_count' => function ($query) {
                $query->where('is_active', true);
            }])
            ->with([
                'items' => function ($query) {
                    $query
                        ->where('is_active', true)
                        ->select([
                            'id',
                            'market_id',
                            'name',
                            'sku',
                            'image_url',
                            'image_path',
                            'combo_offers',
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
            ->orderBy('name');

        if (ProductReview::tableExists()) {
            $marketsQuery
                ->withCount('reviews')
                ->withAvg('reviews', 'rating');
        }

        $markets = $marketsQuery->get();

        return $markets->map(function (Market $market) {
            $activePromo = $market->promoCodes->first();
            $reviewCount = ProductReview::tableExists() ? (int) ($market->reviews_count ?? 0) : 0;
            $reviewAverage = ProductReview::tableExists() && $market->reviews_avg_rating !== null
                ? round((float) $market->reviews_avg_rating, 1)
                : null;

            return [
                'id' => $market->id,
                'name' => $market->name,
                'code' => $market->code,
                'address' => $market->address,
                'lat' => $market->lat !== null ? (float) $market->lat : null,
                'lng' => $market->lng !== null ? (float) $market->lng : null,
                'is_active' => (bool) $market->is_active,
                'is_featured' => Market::hasFeaturedColumns() ? (bool) $market->is_featured : false,
                'featured_badge' => Market::hasFeaturedColumns() ? $market->featured_badge : null,
                'featured_headline' => Market::hasFeaturedColumns() ? $market->featured_headline : null,
                'featured_copy' => Market::hasFeaturedColumns() ? $market->featured_copy : null,
                'logo_url' => $market->logo_url,
                'delivery_slots' => $market->delivery_slots ?? [],
                'active_items_count' => (int) ($market->active_items_count ?? 0),
                'review_summary' => [
                    'count' => $reviewCount,
                    'average' => $reviewAverage,
                ],
                'active_promo' => $activePromo ? [
                    'id' => $activePromo->id,
                    'code' => $activePromo->code,
                    'type' => $activePromo->type,
                    'value' => $activePromo->value,
                    'is_active' => (bool) $activePromo->is_active,
                ] : null,
                'item_preview' => $market->items->take(4)->map(function ($item) {
                    return [
                        'id' => $item->id,
                        'name' => $item->name,
                        'sku' => $item->sku,
                        'image_url' => $item->image_url,
                        'combo_offers' => $item->combo_offers ?? [],
                        'price' => $item->price,
                        'discount_type' => $item->discount_type,
                        'discount_value' => $item->discount_value,
                        'stock_qty' => $item->stock_qty,
                    ];
                })->values(),
            ];
        });
    }

    // GET /api/public/markets/{market}
    public function market(Market $market)
    {
        abort_unless($market->is_active, 404);

        $market->loadCount(['items as active_items_count' => function ($query) {
            $query->where('is_active', true);
        }]);

        if (ProductReview::tableExists()) {
            $market->loadCount('reviews')->loadAvg('reviews', 'rating');
        }

        $reviewCount = ProductReview::tableExists() ? (int) ($market->reviews_count ?? 0) : 0;
        $reviewAverage = ProductReview::tableExists() && $market->reviews_avg_rating !== null
            ? round((float) $market->reviews_avg_rating, 1)
            : null;

        return [
            'id' => $market->id,
            'name' => $market->name,
            'code' => $market->code,
            'address' => $market->address,
            'lat' => $market->lat !== null ? (float) $market->lat : null,
            'lng' => $market->lng !== null ? (float) $market->lng : null,
            'is_active' => (bool) $market->is_active,
            'is_featured' => Market::hasFeaturedColumns() ? (bool) $market->is_featured : false,
            'featured_badge' => Market::hasFeaturedColumns() ? $market->featured_badge : null,
            'featured_headline' => Market::hasFeaturedColumns() ? $market->featured_headline : null,
            'featured_copy' => Market::hasFeaturedColumns() ? $market->featured_copy : null,
            'logo_url' => $market->logo_url,
            'delivery_slots' => $market->delivery_slots ?? [],
            'active_items_count' => (int) ($market->active_items_count ?? 0),
            'review_summary' => [
                'count' => $reviewCount,
                'average' => $reviewAverage,
            ],
        ];
    }

    // GET /api/public/markets/{market}/items
    public function items(Market $market)
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
                'category',
                'image_url',
                'image_path',
                'variants',
                'availability_schedule',
                'ingredients',
                'combo_offers',
                'low_stock_threshold',
            ])
            ->orderBy('name');

        if (ProductReview::tableExists()) {
            $query
                ->withCount('reviews')
                ->withAvg('reviews', 'rating');
        }

        return $query
            ->get()
            ->map(function ($item) {
                $reviewCount = ProductReview::tableExists() ? (int) ($item->reviews_count ?? 0) : 0;
                $reviewAverage = ProductReview::tableExists() && $item->reviews_avg_rating !== null
                    ? round((float) $item->reviews_avg_rating, 1)
                    : null;

                return [
                    'id' => $item->id,
                    'market_id' => $item->market_id,
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'category' => $item->category,
                    'image_url' => $item->image_url,
                    'variants' => $item->variants,
                    'availability_schedule' => $item->availability_schedule,
                    'ingredients' => $item->ingredients ?? [],
                    'combo_offers' => $item->combo_offers ?? [],
                    'price' => $item->price,
                    'discount_type' => $item->discount_type,
                    'discount_value' => $item->discount_value,
                    'is_active' => (bool) $item->is_active,
                    'stock_qty' => $item->stock_qty,
                    'low_stock_threshold' => $item->low_stock_threshold,
                    'is_low_stock' => $item->stock_qty <= $item->low_stock_threshold,
                    'review_summary' => [
                        'count' => $reviewCount,
                        'average' => $reviewAverage,
                    ],
                ];
            });
    }

    // GET /api/public/markets/{market}/active-promo  (optional)
    public function activePromo(Market $market)
    {
        abort_unless($market->is_active, 404);

        // If you have promo_codes table/model relation
        // return first active promo for market
        $promo = $market->promoCodes()
            ->activeApplicable()
            ->orderByDesc('id')
            ->first();

        if (!$promo) return null;

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
