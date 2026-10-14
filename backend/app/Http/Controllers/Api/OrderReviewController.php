<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpFoundation\Response;

/**
 * "Rate your order": after delivery the customer can rate each item, the market and the courier in one go.
 * Item and market ratings become regular reviews (shown on the storefront); the courier rating is stored
 * on the order (customer_rating), which driver analytics already average.
 */
class OrderReviewController extends Controller
{
    public function show(Request $request, Order $order)
    {
        $this->authorizeCustomer($request, $order);

        return response()->json($this->payload($request, $order));
    }

    public function store(Request $request, Order $order)
    {
        $this->authorizeCustomer($request, $order);

        if ($order->status !== 'DELIVERED') {
            return response()->json(['message' => 'You can rate an order once it has been delivered.'], 422);
        }

        if (! ProductReview::tableExists()) {
            return response()->json(['message' => 'Reviews are unavailable until product review migrations are run.'], 503);
        }

        $data = $request->validate([
            'items' => ['array'],
            'items.*.item_id' => ['required', 'integer'],
            'items.*.rating' => ['required', 'integer', 'min:1', 'max:5'],
            'items.*.comment' => ['nullable', 'string', 'max:1000'],
            'market' => ['nullable', 'array'],
            'market.rating' => ['required_with:market', 'integer', 'min:1', 'max:5'],
            'market.comment' => ['nullable', 'string', 'max:1000'],
            'driver' => ['nullable', 'array'],
            'driver.rating' => ['required_with:driver', 'integer', 'min:1', 'max:5'],
            'driver.comment' => ['nullable', 'string', 'max:1000'],
        ]);

        $orderItemIds = $order->items()->whereNotNull('item_id')->pluck('item_id')->map(fn ($id) => (int) $id)->all();
        foreach ($data['items'] ?? [] as $index => $entry) {
            if (! in_array((int) $entry['item_id'], $orderItemIds, true)) {
                throw ValidationException::withMessages([
                    "items.{$index}.item_id" => 'You can only rate items that were in this order.',
                ]);
            }
        }

        if (! empty($data['driver']) && ! $order->assigned_driver_id) {
            throw ValidationException::withMessages(['driver' => 'This order had no courier to rate.']);
        }

        if (empty($data['items']) && empty($data['market']) && empty($data['driver'])) {
            throw ValidationException::withMessages(['items' => 'Rate at least one item, the market or the courier.']);
        }

        $userId = $request->user()->id;

        DB::transaction(function () use ($data, $order, $userId) {
            foreach ($data['items'] ?? [] as $entry) {
                ProductReview::updateOrCreate(
                    ['user_id' => $userId, 'item_id' => (int) $entry['item_id']],
                    [
                        'market_id' => $order->market_id,
                        'order_id' => $order->id,
                        'rating' => $entry['rating'],
                        'comment' => $entry['comment'] ?? null,
                    ],
                );
            }

            if (! empty($data['market'])) {
                ProductReview::updateOrCreate(
                    ['user_id' => $userId, 'market_id' => $order->market_id, 'item_id' => null],
                    [
                        'order_id' => $order->id,
                        'rating' => $data['market']['rating'],
                        'comment' => $data['market']['comment'] ?? null,
                    ],
                );
            }

            if (! empty($data['driver'])) {
                $order->update([
                    'customer_rating' => $data['driver']['rating'],
                    'customer_feedback' => $data['driver']['comment'] ?? null,
                ]);

                OrderEvent::create([
                    'order_id' => $order->id,
                    'type' => 'CUSTOMER_RATED',
                    'payload' => [
                        'rating' => $data['driver']['rating'],
                        'feedback' => $data['driver']['comment'] ?? null,
                    ],
                ]);
            }
        });

        return response()->json($this->payload($request, $order->fresh()));
    }

    private function authorizeCustomer(Request $request, Order $order): void
    {
        abort_unless((int) $order->customer_user_id === (int) $request->user()->id, Response::HTTP_FORBIDDEN, 'Only the customer who placed this order can rate it.');
    }

    private function payload(Request $request, Order $order): array
    {
        $order->loadMissing(['market:id,name,slug', 'items.item:id,name,image_url,image_path,image_paths', 'assignedDriver.user:id,name']);
        $userId = $request->user()->id;
        $hasReviews = ProductReview::tableExists();

        $itemIds = $order->items->pluck('item_id')->filter()->unique()->values();
        $itemReviews = $hasReviews
            ? ProductReview::query()->where('user_id', $userId)->whereIn('item_id', $itemIds)->get()->keyBy('item_id')
            : collect();
        $marketReview = $hasReviews && $order->market_id
            ? ProductReview::query()->where('user_id', $userId)->where('market_id', $order->market_id)->whereNull('item_id')->first()
            : null;

        $items = $order->items
            ->filter(fn ($line) => $line->item_id)
            ->unique('item_id')
            ->map(function ($line) use ($itemReviews) {
                $review = $itemReviews->get($line->item_id);

                return [
                    'item_id' => (int) $line->item_id,
                    'name' => $line->item?->name ?? $line->name,
                    'image_url' => $line->item?->image_url,
                    'review' => $review ? ['rating' => (int) $review->rating, 'comment' => $review->comment] : null,
                ];
            })
            ->values();

        $driver = $order->assignedDriver;
        $driverReview = $order->customer_rating
            ? ['rating' => (int) $order->customer_rating, 'comment' => $order->customer_feedback]
            : null;

        $allItemsReviewed = $items->every(fn ($item) => $item['review'] !== null);

        return [
            'order_id' => $order->id,
            'code' => $order->code,
            'can_review' => $order->status === 'DELIVERED',
            'is_complete' => $allItemsReviewed && $marketReview !== null && ($driver === null || $driverReview !== null),
            'items' => $items,
            'market' => $order->market ? [
                'id' => $order->market->id,
                'name' => $order->market->name,
                'slug' => $order->market->slug,
                'review' => $marketReview ? ['rating' => (int) $marketReview->rating, 'comment' => $marketReview->comment] : null,
            ] : null,
            'driver' => $driver ? [
                'id' => $driver->id,
                'name' => $driver->user?->name,
                'review' => $driverReview,
            ] : null,
        ];
    }
}
