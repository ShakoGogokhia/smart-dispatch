<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\Order;
use App\Models\RoutePlan;
use App\Models\RouteStop;
use App\Models\Shift;
use App\Services\RouteOptimizerService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class PlanningController extends Controller
{
    public function run(Request $request, RouteOptimizerService $optimizer)
    {
        $data = $request->validate([
            'date' => ['nullable','date'], // default today
        ]);

        $date = isset($data['date']) ? \Carbon\Carbon::parse($data['date'])->toDateString() : now()->toDateString();

        // active drivers = drivers with ACTIVE shift (today or not ended)
        $drivers = Driver::query()
            ->with('vehicle')
            ->whereHas('user')
            ->whereIn('status', ['ONLINE','ON_ROUTE','OFFLINE']) // allow OFFLINE for testing
            ->whereHas('shifts', function ($q) {
                $q->where('status', 'ACTIVE');
            })
            ->get();

        // unassigned orders
        $orders = Order::query()
            ->whereIn('status', ['NEW','PLANNED'])
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();

        $suggestion = $optimizer->buildSuggestion($drivers, $orders);

        return response()->json([
            'date' => $date,
            'drivers_count' => $drivers->count(),
            'orders_count' => $orders->count(),
            'suggestion' => $suggestion,
        ]);
    }

    public function commit(Request $request, RouteOptimizerService $optimizer)
    {
        $data = $request->validate([
            'date' => ['nullable','date'],
        ]);

        $date = isset($data['date']) ? \Carbon\Carbon::parse($data['date'])->toDateString() : now()->toDateString();

        $drivers = Driver::query()
            ->with('vehicle')
            ->whereHas('shifts', function ($q) {
                $q->where('status', 'ACTIVE');
            })
            ->get();

        $orders = Order::query()
            ->whereIn('status', ['NEW','PLANNED'])
            ->orderByDesc('priority')
            ->orderBy('id')
            ->get();

        $suggestion = $optimizer->buildSuggestion($drivers, $orders);

        return DB::transaction(function () use ($date, $suggestion) {

            $created = [];

            foreach ($suggestion as $plan) {
                if (empty($plan['stops'])) continue;

                $route = RoutePlan::create([
                    'driver_id' => $plan['driver_id'],
                    'route_date' => $date,
                    'status' => 'PLANNED',
                ]);

                foreach ($plan['stops'] as $stop) {
                    RouteStop::create([
                        'route_plan_id' => $route->id,
                        'order_id' => $stop['order_id'],
                        'sequence' => $stop['sequence'],
                        'status' => 'PENDING',
                    ]);
                }

                // mark orders assigned
                Order::whereIn('id', collect($plan['stops'])->pluck('order_id')->all())
                    ->update(['status' => 'ASSIGNED']);

                $created[] = $route->load(['stops.order']);
            }

            return response()->json([
                'date' => $date,
                'routes_created' => count($created),
                'routes' => $created,
            ], 201);
        });
    }
}