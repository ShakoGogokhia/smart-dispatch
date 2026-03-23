<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderDriverDecline;
use App\Models\OrderEvent;
use App\Models\RoutePlan;
use App\Models\RouteStop;
use App\Services\OrderDispatchService;
use Illuminate\Http\Request;

class DriverOrderController extends Controller
{
    public function __construct(private OrderDispatchService $dispatchService)
    {
    }

    public function feed(Request $request)
    {
        $driver = $request->user()->driver;

        if (!$driver) {
            return response()->json(['message' => 'User is not a driver'], 422);
        }

        $offered = Order::query()
            ->with(['market', 'items', 'customer', 'assignedDriver.user', 'assignedDriver.latestPing'])
            ->where('offered_driver_id', $driver->id)
            ->where('status', 'OFFERED')
            ->latest()
            ->get();

        $assigned = Order::query()
            ->with(['market', 'items', 'customer', 'assignedDriver.user', 'assignedDriver.latestPing'])
            ->where('assigned_driver_id', $driver->id)
            ->whereIn('status', ['ASSIGNED', 'PICKED_UP'])
            ->latest()
            ->get();

        return response()->json([
            'driver' => $driver->load(['vehicle', 'activeShift', 'latestPing']),
            'offered_orders' => $offered,
            'assigned_orders' => $assigned,
        ]);
    }

    public function accept(Request $request, Order $order)
    {
        $driver = $request->user()->driver;

        if (!$driver) {
            return response()->json(['message' => 'User is not a driver'], 422);
        }

        if ((int) $order->offered_driver_id !== (int) $driver->id) {
            return response()->json(['message' => 'This order is not currently offered to you'], 422);
        }

        $order->update([
            'assigned_driver_id' => $driver->id,
            'offered_driver_id' => null,
            'offer_sent_at' => null,
            'accepted_at' => now(),
            'status' => 'ASSIGNED',
        ]);

        $driver->update(['status' => 'ON_ROUTE']);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'DRIVER_ACCEPTED',
            'payload' => [
                'driver_id' => $driver->id,
                'driver_name' => $driver->user?->name,
            ],
        ]);

        $route = RoutePlan::firstOrCreate(
            [
                'driver_id' => $driver->id,
                'route_date' => now()->toDateString(),
            ],
            [
                'status' => 'ACTIVE',
                'planned_distance_km' => 0,
                'planned_duration_min' => 0,
            ],
        );

        if (!$route->stops()->where('order_id', $order->id)->exists()) {
            RouteStop::create([
                'route_plan_id' => $route->id,
                'order_id' => $order->id,
                'sequence' => ($route->stops()->max('sequence') ?? 0) + 1,
                'status' => 'ASSIGNED',
            ]);
        }

        return response()->json($order->fresh(['market', 'items', 'customer', 'assignedDriver.user']));
    }

    public function decline(Request $request, Order $order)
    {
        $driver = $request->user()->driver;

        if (!$driver) {
            return response()->json(['message' => 'User is not a driver'], 422);
        }

        if ((int) $order->offered_driver_id !== (int) $driver->id) {
            return response()->json(['message' => 'This order is not currently offered to you'], 422);
        }

        OrderDriverDecline::updateOrCreate(
            ['order_id' => $order->id, 'driver_id' => $driver->id],
            ['declined_at' => now()],
        );

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'DRIVER_DECLINED',
            'payload' => [
                'driver_id' => $driver->id,
                'driver_name' => $driver->user?->name,
            ],
        ]);

        $order->update([
            'offered_driver_id' => null,
            'offer_sent_at' => null,
            'status' => 'READY_FOR_PICKUP',
        ]);

        $this->dispatchService->offerOrder($order, $driver->id);

        return response()->json($order->fresh(['market', 'items', 'customer', 'offeredDriver.user']));
    }

    public function pickedUp(Request $request, Order $order)
    {
        $driver = $request->user()->driver;

        if (!$driver || (int) $order->assigned_driver_id !== (int) $driver->id) {
            return response()->json(['message' => 'This order is not assigned to you'], 422);
        }

        $order->update([
            'picked_up_at' => now(),
            'status' => 'PICKED_UP',
        ]);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'ORDER_PICKED_UP',
            'payload' => ['driver_id' => $driver->id],
        ]);

        $order->load('assignedDriver.user');

        return response()->json($order);
    }

    public function delivered(Request $request, Order $order)
    {
        $driver = $request->user()->driver;

        if (!$driver || (int) $order->assigned_driver_id !== (int) $driver->id) {
            return response()->json(['message' => 'This order is not assigned to you'], 422);
        }

        $order->update([
            'delivered_at' => now(),
            'status' => 'DELIVERED',
        ]);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'ORDER_DELIVERED',
            'payload' => ['driver_id' => $driver->id],
        ]);

        RouteStop::query()
            ->where('order_id', $order->id)
            ->update(['status' => 'DELIVERED']);

        if (!$driver->assignedOrders()->whereIn('status', ['ASSIGNED', 'PICKED_UP'])->exists()) {
            $driver->update(['status' => 'ONLINE']);
        }

        $this->dispatchService->refreshPendingOrders();

        return response()->json($order->fresh(['market', 'items', 'customer', 'assignedDriver.user']));
    }
}
