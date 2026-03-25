<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\Market;
use App\Models\Order;
use App\Models\RoutePlan;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    public function summary(Request $request)
    {
        $from = $request->query('from', now()->subDays(7)->toDateString());
        $to = $request->query('to', now()->toDateString());

        $orders = Order::query()
            ->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59']);

        $total = (clone $orders)->count();
        $delivered = (clone $orders)->where('status','DELIVERED')->count();
        $failed = (clone $orders)->where('status','FAILED')->count();
        $cancelled = (clone $orders)->where('status','CANCELLED')->count();

        $routes = RoutePlan::query()
            ->whereBetween('route_date', [$from, $to])
            ->count();

        $onTime = Order::query()
            ->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59'])
            ->where('status', 'DELIVERED')
            ->whereNotNull('promised_at')
            ->whereColumn('delivered_at', '<=', 'promised_at')
            ->count();

        $deliveredWithPromise = Order::query()
            ->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59'])
            ->where('status', 'DELIVERED')
            ->whereNotNull('promised_at')
            ->count();

        $trend = collect(range(0, 6))->map(function (int $offset) use ($to) {
            $day = now()->parse($to)->subDays(6 - $offset)->toDateString();
            $dailyOrders = Order::query()
                ->whereBetween('created_at', [$day.' 00:00:00', $day.' 23:59:59']);

            return [
                'date' => $day,
                'total' => (clone $dailyOrders)->count(),
                'delivered' => (clone $dailyOrders)->where('status', 'DELIVERED')->count(),
                'cancelled' => (clone $dailyOrders)->where('status', 'CANCELLED')->count(),
            ];
        })->values();

        $byMarket = Market::query()
            ->select('markets.id', 'markets.name', 'markets.code')
            ->get()
            ->map(function (Market $market) use ($from, $to) {
                $orders = Order::query()
                    ->where('market_id', $market->id)
                    ->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59']);

                return [
                    'market_id' => $market->id,
                    'market_name' => $market->name,
                    'market_code' => $market->code,
                    'orders' => (clone $orders)->count(),
                    'delivered' => (clone $orders)->where('status', 'DELIVERED')->count(),
                    'revenue' => (float) (clone $orders)->sum('total'),
                ];
            })
            ->sortByDesc('orders')
            ->values()
            ->take(8)
            ->values();

        $byDriver = Driver::query()
            ->with('user:id,name')
            ->get()
            ->map(function (Driver $driver) use ($from, $to) {
                $orders = Order::query()
                    ->where('assigned_driver_id', $driver->id)
                    ->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59']);

                return [
                    'driver_id' => $driver->id,
                    'driver_name' => $driver->user?->name ?? "Driver #{$driver->id}",
                    'delivered' => (clone $orders)->where('status', 'DELIVERED')->count(),
                    'failed' => (clone $orders)->where('status', 'FAILED')->count(),
                    'assigned' => (clone $orders)->whereIn('status', ['ASSIGNED', 'PICKED_UP', 'DELIVERED'])->count(),
                    'avg_rating' => round((float) (clone $orders)->whereNotNull('customer_rating')->avg('customer_rating'), 2),
                ];
            })
            ->sortByDesc('delivered')
            ->values()
            ->take(8)
            ->values();

        $funnel = [
            'market_pending' => (clone $orders)->where('status', 'MARKET_PENDING')->count(),
            'ready_for_pickup' => (clone $orders)->where('status', 'READY_FOR_PICKUP')->count(),
            'offered' => (clone $orders)->where('status', 'OFFERED')->count(),
            'assigned' => (clone $orders)->where('status', 'ASSIGNED')->count(),
            'picked_up' => (clone $orders)->where('status', 'PICKED_UP')->count(),
            'delivered' => $delivered,
        ];

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'orders' => [
                'total' => $total,
                'delivered' => $delivered,
                'failed' => $failed,
                'cancelled' => $cancelled,
            ],
            'routes_planned' => $routes,
            'on_time_rate' => $deliveredWithPromise > 0 ? round(($onTime / $deliveredWithPromise) * 100, 1) : null,
            'trend' => $trend,
            'by_market' => $byMarket,
            'by_driver' => $byDriver,
            'funnel' => $funnel,
        ]);
    }
}
