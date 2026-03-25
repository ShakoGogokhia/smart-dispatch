<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Market;

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
        $markets = $this->applyFeaturedOrdering(Market::query())
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
                        ->where('is_active', true)
                        ->latest()
                        ->limit(1);
                },
            ])
            ->orderBy('name')
            ->get();

        return $markets->map(function (Market $market) {
            $activePromo = $market->promoCodes->first();

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
                'active_items_count' => (int) ($market->active_items_count ?? 0),
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
            'active_items_count' => (int) ($market->active_items_count ?? 0),
        ];
    }

    // GET /api/public/markets/{market}/items
    public function items(Market $market)
    {
        abort_unless($market->is_active, 404);

        // Assuming you have Item model + items table with market_id
        return $market->items()
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
            ->orderBy('name')
            ->get();
    }

    // GET /api/public/markets/{market}/active-promo  (optional)
    public function activePromo(Market $market)
    {
        abort_unless($market->is_active, 404);

        // If you have promo_codes table/model relation
        // return first active promo for market
        $promo = $market->promoCodes()
            ->where('is_active', true)
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
}
