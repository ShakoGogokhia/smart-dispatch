<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Market;
use App\Models\Item;

class ItemController extends Controller
{
    public function index(Market $market)
    {
        return $market->items()->latest()->get();
    }

    public function store(Request $request, Market $market)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['required', 'string', 'max:100'],
            'price' => ['required', 'numeric', 'min:0'],
            'discount_type' => ['nullable', 'in:none,percent,fixed'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'stock_qty' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $item = Item::create([
            'market_id' => $market->id,
            'name' => $data['name'],
            'sku' => $data['sku'],
            'price' => $data['price'],
            'discount_type' => $data['discount_type'] ?? 'none',
            'discount_value' => $data['discount_value'] ?? 0,
            'stock_qty' => $data['stock_qty'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
        ]);

        return response()->json($item, 201);
    }

    public function update(Request $request, Market $market, Item $item)
    {
        if ($item->market_id !== $market->id) {
            return response()->json(['message' => 'Item does not belong to market'], 400);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'sku' => ['sometimes', 'string', 'max:100'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'discount_type' => ['sometimes', 'in:none,percent,fixed'],
            'discount_value' => ['sometimes', 'numeric', 'min:0'],
            'stock_qty' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $item->update($data);
        return $item;
    }
}