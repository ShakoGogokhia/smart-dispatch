<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Market;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\ProductReview;
use App\Models\PromoCode;
use App\Models\WorkflowApproval;
use Illuminate\Http\Request;

class MarketDashboardController extends Controller
{
    public function show(Request $request, Market $market)
    {
        $from = $request->query('from', now()->startOfDay()->toDateString());
        $to = $request->query('to', now()->toDateString());

        $orders = Order::query()
            ->where('market_id', $market->id)
            ->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59']);

        $lowStock = Item::query()
            ->where('market_id', $market->id)
            ->whereColumn('stock_qty', '<=', 'low_stock_threshold')
            ->orderBy('stock_qty')
            ->get();

        $topItems = OrderItem::query()
            ->selectRaw('item_id, name, SUM(qty) as qty_sold, SUM(line_total) as revenue')
            ->whereHas('order', fn ($query) => $query
                ->where('market_id', $market->id)
                ->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59']))
            ->groupBy('item_id', 'name')
            ->orderByDesc('qty_sold')
            ->limit(8)
            ->get();

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'market' => [
                'id' => $market->id,
                'name' => $market->name,
                'code' => $market->code,
                'operating_status' => $market->operatingStatus(),
            ],
            'summary' => [
                'orders' => (clone $orders)->count(),
                'revenue' => (float) (clone $orders)->sum('total'),
                'pending_orders' => (clone $orders)->whereIn('status', ['MARKET_PENDING', 'MARKET_ACCEPTED'])->count(),
                'ready_orders' => (clone $orders)->where('status', 'READY_FOR_PICKUP')->count(),
                'delivered_orders' => (clone $orders)->where('status', 'DELIVERED')->count(),
                'low_stock_count' => $lowStock->count(),
                'pending_approvals' => WorkflowApproval::query()
                    ->where('market_id', $market->id)
                    ->where('status', 'pending')
                    ->count(),
            ],
            'top_items' => $topItems,
            'stock_warnings' => $lowStock->map(fn (Item $item) => [
                'id' => $item->id,
                'name' => $item->name,
                'sku' => $item->sku,
                'stock_qty' => $item->stock_qty,
                'low_stock_threshold' => $item->low_stock_threshold,
                'is_active' => (bool) $item->is_active,
            ])->values(),
            'promo_performance' => PromoCode::query()
                ->where('market_id', $market->id)
                ->latest()
                ->limit(8)
                ->get(['id', 'code', 'type', 'value', 'uses', 'max_uses', 'is_active']),
            'rating_trends' => [
                'market_average' => ProductReview::query()->where('market_id', $market->id)->whereNull('item_id')->avg('rating'),
                'market_count' => ProductReview::query()->where('market_id', $market->id)->whereNull('item_id')->count(),
                'item_average' => ProductReview::query()->where('market_id', $market->id)->whereNotNull('item_id')->avg('rating'),
                'item_count' => ProductReview::query()->where('market_id', $market->id)->whereNotNull('item_id')->count(),
            ],
        ]);
    }
}
