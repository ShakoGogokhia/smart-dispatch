<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Market;
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
            ->map(fn (ProductReview $review) => $this->serializeReview($review))
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
            ...$this->serializeReview($review),
        ], 201);
    }

    public function marketIndex(Market $market)
    {
        abort_unless($market->is_active, 404);

        if (!ProductReview::tableExists()) {
            return collect();
        }

        return $market->reviews()
            ->with('user:id,name')
            ->latest()
            ->limit(20)
            ->get()
            ->map(fn (ProductReview $review) => $this->serializeReview($review))
            ->values();
    }

    public function storeMarket(Request $request, Market $market)
    {
        abort_unless($market->is_active, 404);

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
            'item_id' => null,
            'market_id' => $market->id,
            'user_id' => $request->user()->id,
            'order_id' => $data['order_id'] ?? null,
            'rating' => $data['rating'],
            'comment' => $data['comment'] ?? null,
        ]);

        return response()->json([
            ...$this->serializeReview($review),
        ], 201);
    }

    private function serializeReview(ProductReview $review): array
    {
        return [
            'id' => $review->id,
            'rating' => $review->rating,
            'comment' => $review->comment,
            'created_at' => $review->created_at?->toDateTimeString(),
            'user' => $review->user ? [
                'id' => $review->user->id,
                'name' => $review->user->name,
            ] : null,
        ];
    }
}
