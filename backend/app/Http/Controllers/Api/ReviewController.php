<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Market;
use App\Models\ProductReview;
use App\Services\ReviewEligibilityService;
use Illuminate\Http\Request;

class ReviewController extends Controller
{
    public function __construct(private readonly ReviewEligibilityService $eligibility)
    {
    }

    /** What the signed-in user may review in this market (drives the storefront review forms). */
    public function eligibility(Request $request, Market $market)
    {
        $user = $request->user();

        return response()->json([
            'can_review_market' => $this->eligibility->canReviewMarket($user, $market->id),
            'reviewable_item_ids' => $this->eligibility->reviewableItemIds($user, $market->id),
        ]);
    }

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

        if (! $this->eligibility->canReviewItem($request->user(), (int) $item->market_id, (int) $item->id)) {
            return response()->json([
                'message' => 'You can review this item after an order containing it has been delivered to you.',
            ], 403);
        }

        // One review per customer per item: posting again updates it.
        $review = ProductReview::updateOrCreate(
            ['user_id' => $request->user()->id, 'item_id' => $item->id],
            [
                'market_id' => $item->market_id,
                'order_id' => $data['order_id'] ?? null,
                'rating' => $data['rating'],
                'comment' => $data['comment'] ?? null,
            ],
        );

        return response()->json([
            ...$this->serializeReview($review->loadMissing('user:id,name')),
        ], $review->wasRecentlyCreated ? 201 : 200);
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

        if (! $this->eligibility->canReviewMarket($request->user(), $market->id)) {
            return response()->json([
                'message' => 'You can review this market after one of your orders from it has been delivered.',
            ], 403);
        }

        // One market review per customer: posting again updates it.
        $review = ProductReview::updateOrCreate(
            ['user_id' => $request->user()->id, 'market_id' => $market->id, 'item_id' => null],
            [
                'order_id' => $data['order_id'] ?? null,
                'rating' => $data['rating'],
                'comment' => $data['comment'] ?? null,
            ],
        );

        return response()->json([
            ...$this->serializeReview($review->loadMissing('user:id,name')),
        ], $review->wasRecentlyCreated ? 201 : 200);
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
