<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\LocationPing;
use App\Models\Order;
use App\Models\RoutePlan;
use Illuminate\Http\Request;

class LiveController extends Controller
{
    public function locations(Request $request)
    {
        $minutes = (int) ($request->query('minutes', 10));
        $since = now()->subMinutes(max(1, min($minutes, 120)));

        $pings = LocationPing::query()
            ->where('created_at', '>=', $since)
            ->orderByDesc('id')
            ->get()
            ->groupBy('driver_id')
            ->map(fn ($rows) => $rows->first())
            ->values();

        return response()->json([
            'since' => $since->toDateTimeString(),
            'locations' => $pings,
        ]);
    }

    public function routes(Request $request)
    {
        $date = $request->query('date', now()->toDateString());

        $routes = RoutePlan::query()
            ->with(['driver.user', 'driver.latestPing', 'stops.order'])
            ->where('route_date', $date)
            ->latest('id')
            ->get();

        return response()->json($routes);
    }

    public function alerts()
    {
        $late = Order::query()
            ->with(['market:id,name,code', 'assignedDriver.user:id,name'])
            ->whereIn('status', ['MARKET_PENDING', 'MARKET_ACCEPTED', 'READY_FOR_PICKUP', 'OFFERED', 'ASSIGNED', 'PICKED_UP'])
            ->where(function ($query) {
                $query
                    ->where('created_at', '<', now()->subHours(2))
                    ->orWhere(function ($inner) {
                        $inner
                            ->whereNotNull('promised_at')
                            ->where('promised_at', '<', now());
                    });
            })
            ->latest('id')
            ->take(50)
            ->get();

        $idleDrivers = Driver::query()
            ->with(['user:id,name', 'latestPing'])
            ->whereIn('status', ['ONLINE', 'ON_ROUTE'])
            ->get()
            ->filter(fn (Driver $driver) => $driver->latestPing && $driver->latestPing->created_at?->lt(now()->subMinutes(20)))
            ->values();

        $staleTracking = Driver::query()
            ->with(['user:id,name', 'latestPing'])
            ->whereIn('status', ['ONLINE', 'ON_ROUTE'])
            ->get()
            ->filter(fn (Driver $driver) => !$driver->latestPing || $driver->latestPing->created_at?->lt(now()->subMinutes(8)))
            ->values();

        return response()->json([
            'late_orders' => $late,
            'idle_drivers' => $idleDrivers,
            'stale_tracking' => $staleTracking,
        ]);
    }

    public function history(Request $request)
    {
        $driverId = $request->integer('driver_id');
        $minutes = max(5, min(180, $request->integer('minutes', 60)));
        $since = now()->subMinutes($minutes);

        $history = LocationPing::query()
            ->when($driverId, fn ($query) => $query->where('driver_id', $driverId))
            ->where('created_at', '>=', $since)
            ->orderBy('created_at')
            ->get()
            ->groupBy('driver_id')
            ->map(fn ($rows, $id) => [
                'driver_id' => (int) $id,
                'points' => $rows->map(fn (LocationPing $ping) => [
                    'lat' => $ping->lat,
                    'lng' => $ping->lng,
                    'created_at' => $ping->created_at?->toDateTimeString(),
                ])->values(),
            ])
            ->values();

        return response()->json([
            'since' => $since->toDateTimeString(),
            'history' => $history,
        ]);
    }
}
