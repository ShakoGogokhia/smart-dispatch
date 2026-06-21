<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\OrderDispatchService;

class OrderTrackingController extends Controller
{
    public function __construct(private OrderDispatchService $dispatchService)
    {
    }

    public function show(string $code)
    {
        $this->dispatchService->refreshPendingOrders();

        $order = Order::query()
            ->with([
                'market:id,name,code,address,lat,lng',
                'assignedDriver.user:id,name',
                'assignedDriver.latestPing',
                'events' => fn ($query) => $query->oldest(),
                'items',
            ])
            ->whereRaw('UPPER(code) = ?', [mb_strtoupper(trim($code))])
            ->firstOrFail();

        return response()->json([
            'id' => $order->id,
            'code' => $order->code,
            'status' => $order->status,
            'market' => $order->market,
            'dropoff_address' => $order->dropoff_address,
            'dropoff_lat' => $order->dropoff_lat,
            'dropoff_lng' => $order->dropoff_lng,
            'pickup_address' => $order->pickup_address,
            'pickup_lat' => $order->pickup_lat,
            'pickup_lng' => $order->pickup_lng,
            'created_at' => $order->created_at?->toDateTimeString(),
            'eta_summary' => [
                'estimated_delivery_at' => $order->estimated_delivery_at?->toDateTimeString(),
                'promised_at' => $order->promised_at?->toDateTimeString(),
                'is_late' => (bool) ($order->promised_at && !$order->delivered_at && now()->gt($order->promised_at)),
            ],
            'driver' => $order->assignedDriver ? [
                'id' => $order->assignedDriver->id,
                'name' => $order->assignedDriver->user?->name,
                'status' => $order->assignedDriver->status,
                'latest_ping' => $order->assignedDriver->latestPing && in_array($order->status, ['ASSIGNED', 'PICKED_UP'], true)
                    ? [
                        'lat' => $order->assignedDriver->latestPing->lat,
                        'lng' => $order->assignedDriver->latestPing->lng,
                        'updated_at' => $order->assignedDriver->latestPing->updated_at?->toDateTimeString(),
                    ]
                    : null,
            ] : null,
            'timeline' => $this->timeline($order),
            'events' => $order->events->map(fn ($event) => [
                'id' => $event->id,
                'type' => $event->type,
                'payload' => $event->payload,
                'created_at' => $event->created_at?->toDateTimeString(),
            ])->values(),
        ]);
    }

    private function timeline(Order $order): array
    {
        return [
            ['key' => 'created', 'label' => 'Order created', 'at' => $order->created_at?->toDateTimeString(), 'done' => true],
            ['key' => 'market_accepted', 'label' => 'Market accepted', 'at' => $order->market_accepted_at?->toDateTimeString(), 'done' => (bool) $order->market_accepted_at],
            ['key' => 'ready', 'label' => 'Ready for pickup', 'at' => $order->ready_for_pickup_at?->toDateTimeString(), 'done' => (bool) $order->ready_for_pickup_at],
            ['key' => 'accepted', 'label' => 'Driver assigned', 'at' => $order->accepted_at?->toDateTimeString(), 'done' => (bool) $order->accepted_at],
            ['key' => 'picked_up', 'label' => 'Picked up', 'at' => $order->picked_up_at?->toDateTimeString(), 'done' => (bool) $order->picked_up_at],
            ['key' => 'delivered', 'label' => 'Delivered', 'at' => $order->delivered_at?->toDateTimeString(), 'done' => (bool) $order->delivered_at],
        ];
    }
}
