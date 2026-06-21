<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Market;
use Illuminate\Http\Request;

class InventoryAlertController extends Controller
{
    public function index(Market $market)
    {
        return response()->json([
            'market_id' => $market->id,
            'alerts' => Item::query()
                ->where('market_id', $market->id)
                ->whereColumn('stock_qty', '<=', 'low_stock_threshold')
                ->orderBy('stock_qty')
                ->get()
                ->map(fn (Item $item) => [
                    'id' => $item->id,
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'stock_qty' => $item->stock_qty,
                    'low_stock_threshold' => $item->low_stock_threshold,
                    'is_active' => (bool) $item->is_active,
                    'severity' => $item->stock_qty <= 0 ? 'out' : 'low',
                ])
                ->values(),
        ]);
    }

    public function hideOutOfStock(Request $request, Market $market)
    {
        $updated = Item::query()
            ->where('market_id', $market->id)
            ->where('stock_qty', '<=', 0)
            ->update(['is_active' => false]);

        return response()->json([
            'message' => 'Out-of-stock items hidden.',
            'updated' => $updated,
        ]);
    }
}
