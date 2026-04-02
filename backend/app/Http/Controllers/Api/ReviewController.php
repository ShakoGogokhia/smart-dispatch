<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\ProductReview;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function index(Item $item)
    {
        if (!ProductReview::tableExists()) {
            return collect();
        }

        return $item->reviews()
            ->with('user:id,name')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (ProductReview $review) => [
                'id' => $review->id,
                'rating' => $review->rating,
                'comment' => $review->comment,
                'created_at' => $review->created_at?->toDateTimeString(),
                'user' => $review->user ? [
                    'id' => $review->user->id,
                    'name' => $review->user->name,
                ] : null,
            ])
            ->values();
    }

    public function store(Request $request, Item $item)
    {
        if (!ProductReview::tableExists()) {
            return response()->json([
                'message' => 'Reviews are unavailable until product review migrations are run.',
            ], 503);
        }

        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'comment' => ['nullable', 'string', 'max:1000'],
            'order_id' => ['nullable', 'exists:orders,id'],
        ]);

        $review = ProductReview::create([
            'item_id' => $item->id,
            'market_id' => $item->market_id,
            'user_id' => $request->user()->id,
            'order_id' => $data['order_id'] ?? null,
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ]);

        return response()->json([
            'id' => $review->id,
            'rating' => $review->rating,
            'comment' => $review->comment,
            'created_at' => $review->created_at?->toDateTimeString(),
        ], 201);
    }
}
