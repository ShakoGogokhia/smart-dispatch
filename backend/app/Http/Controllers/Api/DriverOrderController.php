<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderDriverDecline;
use App\Models\OrderEvent;
use App\Models\RoutePlan;
use App\Models\RouteStop;
use App\Services\AppNotificationService;
use App\Services\DriverEarningsService;
use App\Services\OrderDispatchService;
use Illuminate\Http\Request;

class DriverOrderController extends Controller
{
    public function __construct(
        private OrderDispatchService $dispatchService,
        private DriverEarningsService $driverEarningsService,
        private AppNotificationService $notifications,
    )
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
            'driver' => $driver->load(['vehicle', 'activeShift', 'latestPing', 'transactions' => fn ($query) => $query->latest()->limit(10)]),
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

        $this->notifications->notifyOrderUpdate(
            $order->fresh('market'),
            'Driver assigned',
            "{$driver->user?->name} accepted {$order->code}.",
            'driver.assigned',
        );

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

        $data = $request->validate([
            'proof_note' => ['nullable', 'string'],
            'proof_photo_url' => ['nullable', 'url'],
            'proof_signature_name' => ['nullable', 'string', 'max:255'],
        ]);

        $order->loadMissing('market');

        $order->update([
            'delivered_at' => now(),
            'status' => 'DELIVERED',
            'proof_of_delivery_note' => $data['proof_note'] ?? $order->proof_of_delivery_note,
            'proof_of_delivery_photo_url' => $data['proof_photo_url'] ?? $order->proof_of_delivery_photo_url,
            'proof_of_delivery_signature_name' => $data['proof_signature_name'] ?? $order->proof_of_delivery_signature_name,
        ]);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'ORDER_DELIVERED',
            'payload' => [
                'driver_id' => $driver->id,
                'proof_note' => $data['proof_note'] ?? null,
                'proof_photo_url' => $data['proof_photo_url'] ?? null,
                'proof_signature_name' => $data['proof_signature_name'] ?? null,
            ],
        ]);

        $this->notifications->notifyOrderUpdate(
            $order->fresh('market'),
            'Order delivered',
            "{$order->code} was delivered with proof of delivery attached.",
            'order.delivered',
        );

        $earningTransaction = $this->driverEarningsService->creditDeliveredOrder($order->fresh('market'), $driver->fresh());

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'DRIVER_EARNING_CREDITED',
            'payload' => [
                'driver_id' => $driver->id,
                'amount' => $earningTransaction->amount,
                'distance_km' => $earningTransaction->distance_km,
                'weather_multiplier' => $earningTransaction->weather_multiplier,
                'weather_condition' => $earningTransaction->weather_condition,
            ],
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
