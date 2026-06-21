<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\Order;
use App\Models\OrderDriverDecline;
use App\Services\OrderDispatchService;

class DispatchInsightController extends Controller
{
    public function show(Order $order)
    {
        $drivers = Driver::query()
            ->with(['user:id,name', 'vehicle', 'activeShift', 'latestPing'])
            ->whereIn('status', ['ONLINE', 'ON_ROUTE'])
            ->get();

        $declinedIds = OrderDriverDecline::query()
            ->where('order_id', $order->id)
            ->pluck('driver_id')
            ->all();

        $candidates = $drivers->map(function (Driver $driver) use ($order, $declinedIds) {
            $distance = $driver->latestPing
                ? $this->distanceKm(
                    (float) $driver->latestPing->lat,
                    (float) $driver->latestPing->lng,
                    (float) ($order->pickup_lat ?? $order->dropoff_lat),
                    (float) ($order->pickup_lng ?? $order->dropoff_lng),
                )
                : null;
            $capacity = (float) ($driver->vehicle?->capacity ?? 100);
            $activeLoad = (float) $driver->assignedOrders()->whereIn('status', ['ASSIGNED', 'PICKED_UP'])->sum('size');
            $remainingCapacity = max(0, $capacity - $activeLoad);
            $reasons = [];

            if (!$driver->activeShift) {
                $reasons[] = 'No active shift';
            }
            if (in_array($driver->id, $declinedIds, true)) {
                $reasons[] = 'Already declined';
            }
            if ($remainingCapacity < (float) ($order->size ?? 1)) {
                $reasons[] = 'Insufficient capacity';
            }
            if ($distance === null) {
                $reasons[] = 'No recent location';
            }
            if ($distance !== null && $distance > 8) {
                $reasons[] = 'Outside nearby radius';
            }

            return [
                'driver_id' => $driver->id,
                'driver_name' => $driver->user?->name ?? "Driver #{$driver->id}",
                'status' => $driver->status,
                'distance_km' => $distance !== null ? round($distance, 2) : null,
                'active_assigned_orders' => $driver->assignedOrders()->whereIn('status', ['ASSIGNED', 'PICKED_UP'])->count(),
                'remaining_capacity' => $remainingCapacity,
                'declined' => in_array($driver->id, $declinedIds, true),
                'eligible' => $reasons === [],
                'reasons' => $reasons,
            ];
        })->sortBy([
            ['eligible', 'desc'],
            ['active_assigned_orders', 'asc'],
            ['distance_km', 'asc'],
        ])->values();

        return response()->json([
            'order' => $order->load(['market:id,name,code', 'offeredDriver.user:id,name', 'assignedDriver.user:id,name']),
            'offer_timeout_seconds' => OrderDispatchService::OFFER_TIMEOUT_SECONDS,
            'offer_expires_at' => $order->offer_sent_at?->copy()->addSeconds(OrderDispatchService::OFFER_TIMEOUT_SECONDS)->toDateTimeString(),
            'current_offer' => $order->offeredDriver ? [
                'driver_id' => $order->offeredDriver->id,
                'driver_name' => $order->offeredDriver->user?->name,
            ] : null,
            'declines' => OrderDriverDecline::query()
                ->with('driver.user:id,name')
                ->where('order_id', $order->id)
                ->latest('declined_at')
                ->get()
                ->map(fn (OrderDriverDecline $decline) => [
                    'driver_id' => $decline->driver_id,
                    'driver_name' => $decline->driver?->user?->name,
                    'declined_at' => $decline->declined_at?->toDateTimeString(),
                ])
                ->values(),
            'candidates' => $candidates,
            'suggested_driver' => $candidates->firstWhere('eligible', true),
        ]);
    }

    private function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2 + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return $earthRadius * (2 * atan2(sqrt($a), sqrt(1 - $a)));
    }
}
