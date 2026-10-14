<?php

namespace App\Services;

use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;

/**
 * Only customers who actually received an order can review:
 * - a market, after any delivered order from it;
 * - an item, after a delivered order that contained it.
 */
class ReviewEligibilityService
{
    public function deliveredOrders(User $user, int $marketId): Builder
    {
        return Order::query()
            ->where('customer_user_id', $user->id)
            ->where('market_id', $marketId)
            ->where('status', 'DELIVERED');
    }

    public function canReviewMarket(User $user, int $marketId): bool
    {
        return $this->deliveredOrders($user, $marketId)->exists();
    }

    public function canReviewItem(User $user, int $marketId, int $itemId): bool
    {
        return in_array($itemId, $this->reviewableItemIds($user, $marketId), true);
    }

    /** @return int[] ids of items the user received in delivered orders from this market */
    public function reviewableItemIds(User $user, int $marketId): array
    {
        return OrderItem::query()
            ->whereIn('order_id', $this->deliveredOrders($user, $marketId)->select('id'))
            ->whereNotNull('item_id')
            ->distinct()
            ->pluck('item_id')
            ->map(fn ($id) => (int) $id)
            ->values()
            ->all();
    }
}
