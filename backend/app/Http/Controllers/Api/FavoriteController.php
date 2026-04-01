<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Favorite;
use Illuminate\Http\Request;

class FavoriteController extends Controller
{
    public function index(Request $request)
    {
        $favorites = $request->user()
            ->favorites()
            ->with([
                'market:id,name,code',
                'item:id,market_id,name,sku,category,image_url,price',
            ])
            ->latest()
            ->get();

        return response()->json([
            'markets' => $favorites->filter(fn (Favorite $favorite) => $favorite->market)->map(fn (Favorite $favorite) => [
                'id' => $favorite->market->id,
                'name' => $favorite->market->name,
                'code' => $favorite->market->code,
            ])->values(),
            'items' => $favorites->filter(fn (Favorite $favorite) => $favorite->item)->map(fn (Favorite $favorite) => [
                'id' => $favorite->item->id,
                'market_id' => $favorite->item->market_id,
                'name' => $favorite->item->name,
                'sku' => $favorite->item->sku,
                'category' => $favorite->item->category,
                'image_url' => $favorite->item->image_url,
                'price' => $favorite->item->price,
            ])->values(),
        ]);
    }

    public function toggle(Request $request)
    {
        $data = $request->validate([
            'market_id' => ['nullable', 'exists:markets,id'],
            'item_id' => ['nullable', 'exists:items,id'],
        ]);

        abort_if(empty($data['market_id']) && empty($data['item_id']), 422, 'Select a market or item to favorite');

        $favorite = Favorite::query()->where('user_id', $request->user()->id);

        if (!empty($data['market_id'])) {
            $favorite->where('market_id', $data['market_id']);
        }

        if (!empty($data['item_id'])) {
            $favorite->where('item_id', $data['item_id']);
        }

        $existing = $favorite->first();

        if ($existing) {
            $existing->delete();

            return response()->json([
                'favorited' => false,
            ]);
        }

        Favorite::create([
            'user_id' => $request->user()->id,
            'market_id' => $data['market_id'] ?? null,
            'item_id' => $data['item_id'] ?? null,
        ]);

        return response()->json([
            'favorited' => true,
        ], 201);
    }
}
