<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\RoutePlan;
use App\Models\RouteStop;
use Illuminate\Http\Request;

class OrderEventController extends Controller
{
    public function store(Request $request, Order $order)
    {
        $driver = $request->user()->driver;

        if (!$driver) {
            return response()->json(['message' => 'User is not a driver'], 422);
        }

        $data = $request->validate([
            'type' => ['required','string'], // arrived, picked_up, delivered, failed
            'payload' => ['nullable','array'],
        ]);

        $type = strtoupper($data['type']);
        $payload = $data['payload'] ?? [];

        // Map event -> order status
        $statusMap = [
            'ARRIVED' => null,          // optional: keep status same
            'PICKED_UP' => 'PICKED_UP',
            'DELIVERED' => 'DELIVERED',
            'FAILED' => 'FAILED',
        ];

        if (!array_key_exists($type, $statusMap)) {
            return response()->json(['message' => 'Invalid event type'], 422);
        }

        // Save event
        OrderEvent::create([
            'order_id' => $order->id,
            'type' => $type,
            'payload' => $payload,
        ]);

        // Update order status if needed
        $newStatus = $statusMap[$type];
        if ($newStatus) {
            $order->update(['status' => $newStatus]);
        }

        // Update route stop status for today's route if exists
        $today = now()->toDateString();

        $route = RoutePlan::query()
            ->where('driver_id', $driver->id)
            ->where('route_date', $today)
            ->latest('id')
            ->first();

        if ($route) {
            $stop = RouteStop::query()
                ->where('route_plan_id', $route->id)
                ->where('order_id', $order->id)
                ->first();

            if ($stop) {
                if ($type === 'DELIVERED') $stop->update(['status' => 'DONE']);
                if ($type === 'FAILED') $stop->update(['status' => 'SKIPPED']);
            }
        }

        // Later: broadcast OrderStatusChanged event here

        return response()->json([
            'ok' => true,
            'order' => $order->fresh(),
        ], 201);
    }
}