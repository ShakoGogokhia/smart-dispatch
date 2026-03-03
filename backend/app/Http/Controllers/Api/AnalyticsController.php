<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\RoutePlan;
use Illuminate\Http\Request;

class AnalyticsController extends Controller
{
    // GET /api/analytics/summary?from=YYYY-MM-DD&to=YYYY-MM-DD
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

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'orders' => [
                'total' => $total,
                'delivered' => $delivered,
                'failed' => $failed,
                'cancelled' => $cancelled,
            ],
            'routes_planned' => $routes,
        ]);
    }
}