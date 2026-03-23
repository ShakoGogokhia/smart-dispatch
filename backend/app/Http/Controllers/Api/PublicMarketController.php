<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Market;
use Illuminate\Http\Request;

class PublicMarketController extends Controller
{
    // GET /api/public/markets
    public function markets()
    {
        return Market::query()
            ->where('is_active', true)
            ->select(['id', 'name', 'code', 'address', 'is_active'])
            ->orderBy('name')
            ->get();
    }

    // GET /api/public/markets/{market}
    public function market(Market $market)
    {
        abort_unless($market->is_active, 404);

        return $market->only(['id', 'name', 'code', 'address', 'is_active']);
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
            'type' => $promo->discount_type,
            'value' => $promo->discount_value,
            'is_active' => $promo->is_active,
        ];
    }
}
