<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Market;
use App\Models\PromoCode;
use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

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
                            'image_paths',
                            'combo_offers',
                            'price',
                            'discount_type',
                        'discount_value',
                        'stock_qty',
                        'is_promoted',
                        'promotion_starts_at',
                        'promotion_ends_at',
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
                'featured_theme' => Market::hasFeaturedColumns() ? ($market->featured_theme ?? null) : null,
                'logo_url' => $market->logo_url,
                'banner_url' => $market->banner_url,
                'image_url' => $market->image_url,
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
                        'item_kind' => $item->item_kind ?: 'regular',
                        'image_url' => $item->image_url,
                        'image_urls' => $this->resolveImageUrls($item),
                        'combo_offers' => $item->combo_offers ?? [],
                        'price' => $item->price,
                        'discount_type' => $item->discount_type,
                        'discount_value' => $item->discount_value,
                        'stock_qty' => $item->stock_qty,
                        'is_promoted' => (bool) ($item->is_promoted ?? false),
                        'promotion_ends_at' => $item->promotion_ends_at?->toDateTimeString(),
                    ];
                })->values(),
            ];
        });
    }

    // GET /api/public/discovery-items
    public function discoveryItems()
    {
        $orderCounts = DB::table('order_items')
            ->select('item_id', DB::raw('SUM(qty) as ordered_qty'))
            ->whereNotNull('item_id')
            ->groupBy('item_id');

        $query = Item::query()
            ->where('is_active', true)
            ->whereHas('market', function ($marketQuery) {
                $marketQuery->where('is_active', true);
            })
            ->with([
                'market:id,name,code,is_active',
            ])
            ->leftJoinSub($orderCounts, 'order_counts', function ($join) {
                $join->on('items.id', '=', 'order_counts.item_id');
            })
            ->select([
                'items.id',
                'items.market_id',
                'items.name',
                'items.sku',
                'items.category',
                'items.price',
                'items.discount_type',
                'items.discount_value',
                'items.stock_qty',
                'items.image_url',
                'items.image_path',
                'items.image_paths',
                'items.combo_offers',
                DB::raw('COALESCE(order_counts.ordered_qty, 0) as ordered_qty'),
            ]);

        if (ProductReview::tableExists()) {
            $query
                ->withCount('reviews')
                ->withAvg('reviews', 'rating');
        }

        $items = $query->get();

        $serializedItems = $items->map(function (Item $item) {
            return $this->serializeDiscoveryItem($item);
        })->values();

        $popularItems = $serializedItems
            ->filter(fn (array $item) => ($item['ordered_qty'] ?? 0) > 0)
            ->sortByDesc('ordered_qty')
            ->sortByDesc(fn (array $item) => $item['review_summary']['count'] ?? 0)
            ->take(10)
            ->values();

        if ($popularItems->isEmpty()) {
            $popularItems = $serializedItems
                ->shuffle()
                ->take(10)
                ->values();
        }

        $comboItems = $serializedItems
            ->filter(fn (array $item) => !empty($item['combo_offers']))
            ->sortByDesc('ordered_qty')
            ->take(10)
            ->values();

        $discountedItems = $serializedItems
            ->filter(function (array $item) {
                $discountType = $item['discount_type'] ?? 'none';
                $discountValue = (float) ($item['discount_value'] ?? 0);

                return $discountType !== 'none' && $discountValue > 0;
            })
            ->sortByDesc('ordered_qty')
            ->take(10)
            ->values();

        return response()->json([
            'popular' => $popularItems,
            'combo' => $comboItems,
            'discounted' => $discountedItems,
        ]);
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
            'featured_theme' => Market::hasFeaturedColumns() ? ($market->featured_theme ?? null) : null,
            'logo_url' => $market->logo_url,
            'banner_url' => $market->banner_url,
            'image_url' => $market->image_url,
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
                'image_paths',
                'variants',
                'availability_schedule',
                'ingredients',
                'combo_offers',
                'low_stock_threshold',
                'is_promoted',
                'promotion_starts_at',
                'promotion_ends_at',
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
                    'item_kind' => $item->item_kind ?: 'regular',
                    'category' => $item->category,
                    'image_url' => $item->image_url,
                    'image_urls' => $this->resolveImageUrls($item),
                    'variants' => $item->variants,
                    'availability_schedule' => $item->availability_schedule,
                    'ingredients' => $item->ingredients ?? [],
                    'combo_offers' => $item->combo_offers ?? [],
                    'price' => $item->price,
                    'discount_type' => $item->discount_type,
                    'discount_value' => $item->discount_value,
                    'is_active' => (bool) $item->is_active,
                    'is_promoted' => (bool) ($item->is_promoted ?? false),
                    'promotion_ends_at' => $item->promotion_ends_at?->toDateTimeString(),
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

    private function resolveImageUrls($item): array
    {
        $urls = [];

        foreach (($item->image_paths ?? []) as $path) {
            if (is_string($path) && $path !== '') {
                $urls[] = url(Storage::disk('public')->url($path));
            }
        }

        if ($urls === [] && $item->image_path) {
            $urls[] = url(Storage::disk('public')->url($item->image_path));
        }

        $rawImageUrl = method_exists($item, 'getRawOriginal')
            ? $item->getRawOriginal('image_url')
            : $item->image_url;

        if (is_string($rawImageUrl) && trim($rawImageUrl) !== '') {
            $urls[] = trim($rawImageUrl);
        }

        return collect($urls)->filter()->unique()->values()->all();
    }

    private function serializeDiscoveryItem(Item $item): array
    {
        $reviewCount = ProductReview::tableExists() ? (int) ($item->reviews_count ?? 0) : 0;
        $reviewAverage = ProductReview::tableExists() && $item->reviews_avg_rating !== null
            ? round((float) $item->reviews_avg_rating, 1)
            : null;

        return [
            'id' => $item->id,
            'market_id' => $item->market_id,
            'market' => $item->market ? [
                'id' => $item->market->id,
                'name' => $item->market->name,
                'code' => $item->market->code,
            ] : null,
            'name' => $item->name,
            'sku' => $item->sku,
            'item_kind' => $item->item_kind ?: 'regular',
            'category' => $item->category,
            'image_url' => $item->image_url,
            'image_urls' => $this->resolveImageUrls($item),
            'combo_offers' => $item->combo_offers ?? [],
            'price' => $item->price,
            'discount_type' => $item->discount_type,
            'discount_value' => $item->discount_value,
            'stock_qty' => $item->stock_qty,
            'is_promoted' => (bool) ($item->is_promoted ?? false),
            'promotion_ends_at' => $item->promotion_ends_at?->toDateTimeString(),
            'ordered_qty' => (int) ($item->ordered_qty ?? 0),
            'review_summary' => [
                'count' => $reviewCount,
                'average' => $reviewAverage,
            ],
        ];
    }
}
