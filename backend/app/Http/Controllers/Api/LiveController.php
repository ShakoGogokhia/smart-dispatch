<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LocationPing;
use App\Models\Order;
use App\Models\RoutePlan;
use Illuminate\Http\Request;

class LiveController extends Controller
{
    // GET /api/live/locations?minutes=10
    public function locations(Request $request)
    {
        $minutes = (int) ($request->query('minutes', 10));
        $since = now()->subMinutes(max(1, min($minutes, 120)));

        // latest ping per driver within window
        $pings = LocationPing::query()
            ->where('created_at', '>=', $since)
            ->orderByDesc('id')
            ->get()
            ->groupBy('driver_id')
            ->map(fn($rows) => $rows->first())
            ->values();

        return response()->json([
            'since' => $since->toDateTimeString(),
            'locations' => $pings,
        ]);
    }

    // GET /api/live/routes?date=YYYY-MM-DD
    public function routes(Request $request)
    {
        $date = $request->query('date', now()->toDateString());

        $routes = RoutePlan::query()
            ->with(['driver.user','stops.order'])
            ->where('route_date', $date)
            ->latest('id')
            ->get();

        return response()->json($routes);
    }

    // GET /api/live/alerts
    public function alerts()
    {
        // MVP: "late" means PLANNED/ASSIGNED for > 2 hours
        $late = Order::query()
            ->whereIn('status', ['PLANNED','ASSIGNED'])
            ->where('created_at', '<', now()->subHours(2))
            ->latest('id')
            ->take(50)
            ->get();

        return response()->json([
            'late_orders' => $late,
        ]);
    }
}
