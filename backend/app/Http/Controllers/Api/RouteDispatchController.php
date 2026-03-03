<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\RoutePlan;
use App\Models\RouteStop;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class RouteDispatchController extends Controller
{
    // POST /api/routes/{routePlan}/reassign-stop
    public function reassignStop(Request $request, RoutePlan $routePlan)
    {
        $data = $request->validate([
            'order_id' => ['required','exists:orders,id'],
            'to_driver_id' => ['required','exists:drivers,id'],
            'new_sequence' => ['nullable','integer','min:1'],
        ]);

        return DB::transaction(function () use ($routePlan, $data) {
            $stop = RouteStop::where('route_plan_id', $routePlan->id)
                ->where('order_id', $data['order_id'])
                ->firstOrFail();

            if (in_array($stop->status, ['DONE','SKIPPED'], true)) {
                return response()->json(['message' => 'Cannot move completed stop'], 422);
            }

            // Find or create target routePlan for that driver (same date)
            $targetRoute = RoutePlan::firstOrCreate(
                [
                    'driver_id' => $data['to_driver_id'],
                    'route_date' => $routePlan->route_date,
                ],
                [
                    'status' => 'PLANNED',
                ]
            );

            // Remove stop from old route
            $stop->delete();
            $this->normalizeSequences($routePlan->id);

            // Insert stop in target route
            $sequence = $data['new_sequence'] ?? (RouteStop::where('route_plan_id', $targetRoute->id)->max('sequence') ?? 0) + 1;

            // Shift existing sequences down if inserting in middle
            RouteStop::where('route_plan_id', $targetRoute->id)
                ->where('sequence', '>=', $sequence)
                ->increment('sequence');

            RouteStop::create([
                'route_plan_id' => $targetRoute->id,
                'order_id' => $data['order_id'],
                'sequence' => $sequence,
                'status' => 'PENDING',
            ]);

            return response()->json([
                'from_route' => $routePlan->load('stops.order'),
                'to_route' => $targetRoute->load('stops.order'),
            ]);
        });
    }

    // PATCH /api/routes/{routePlan}/stops/reorder
    public function reorder(Request $request, RoutePlan $routePlan)
    {
        $data = $request->validate([
            'stops' => ['required','array','min:1'],
            'stops.*.order_id' => ['required','exists:orders,id'],
            'stops.*.sequence' => ['required','integer','min:1'],
        ]);

        return DB::transaction(function () use ($routePlan, $data) {
            // only allow reorder of PENDING stops
            $stopIds = collect($data['stops'])->pluck('order_id')->all();

            $existing = RouteStop::where('route_plan_id', $routePlan->id)
                ->whereIn('order_id', $stopIds)
                ->get();

            foreach ($existing as $s) {
                if (in_array($s->status, ['DONE','SKIPPED'], true)) {
                    return response()->json(['message' => 'Cannot reorder completed stop(s)'], 422);
                }
            }

            foreach ($data['stops'] as $s) {
                RouteStop::where('route_plan_id', $routePlan->id)
                    ->where('order_id', $s['order_id'])
                    ->update(['sequence' => $s['sequence']]);
            }

            $this->normalizeSequences($routePlan->id);

            return response()->json($routePlan->fresh()->load('stops.order'));
        });
    }

    // DELETE /api/routes/{routePlan}/stops/{stop}
    public function removeStop(Request $request, RoutePlan $routePlan, RouteStop $stop)
    {
        if ($stop->route_plan_id !== $routePlan->id) {
            return response()->json(['message' => 'Stop not in route'], 422);
        }

        if (in_array($stop->status, ['DONE','SKIPPED'], true)) {
            return response()->json(['message' => 'Cannot remove completed stop'], 422);
        }

        return DB::transaction(function () use ($routePlan, $stop) {
            $orderId = $stop->order_id;
            $stop->delete();

            $this->normalizeSequences($routePlan->id);

            // Optional: if order was assigned only because of this stop, return it to PLANNED
            Order::where('id', $orderId)->where('status', 'ASSIGNED')->update(['status' => 'PLANNED']);

            return response()->json($routePlan->fresh()->load('stops.order'));
        });
    }

    private function normalizeSequences(int $routePlanId): void
    {
        $stops = RouteStop::where('route_plan_id', $routePlanId)->orderBy('sequence')->orderBy('id')->get();
        $seq = 1;
        foreach ($stops as $s) {
            if ($s->sequence !== $seq) {
                $s->update(['sequence' => $seq]);
            }
            $seq++;
        }
    }
}