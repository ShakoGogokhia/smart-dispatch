<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\LocationPing;
use App\Models\Order;
use App\Models\OrderDriverDecline;
use App\Models\OrderEvent;
use Illuminate\Support\Collection;

class OrderDispatchService
{
    public function offerOrder(Order $order, ?int $excludeDriverId = null): ?Order
    {
        if ($order->assigned_driver_id || $order->status !== 'READY_FOR_PICKUP') {
            return $order->fresh(['assignedDriver.user', 'offeredDriver.user']);
        }

        $candidate = $this->pickCandidate($order, $excludeDriverId);

        if (!$candidate) {
            $order->update([
                'offered_driver_id' => null,
                'offer_sent_at' => null,
                'status' => 'READY_FOR_PICKUP',
            ]);

            return $order->fresh(['assignedDriver.user', 'offeredDriver.user']);
        }

        $order->update([
            'offered_driver_id' => $candidate->id,
            'offer_sent_at' => now(),
            'status' => 'OFFERED',
        ]);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'DRIVER_OFFERED',
            'payload' => [
                'driver_id' => $candidate->id,
                'driver_name' => $candidate->user?->name,
            ],
        ]);

        return $order->fresh(['assignedDriver.user', 'offeredDriver.user']);
    }

    public function refreshPendingOrders(): void
    {
        Order::query()
            ->whereNull('assigned_driver_id')
            ->whereIn('status', ['READY_FOR_PICKUP', 'OFFERED'])
            ->get()
            ->each(function (Order $order) {
                $shouldReplaceOffer = !$order->offered_driver_id
                    || !$order->offer_sent_at
                    || $order->offer_sent_at->lt(now()->subMinutes(5))
                    || !$this->isDriverAvailable($order->offered_driver_id);

                if ($shouldReplaceOffer) {
                    $this->offerOrder($order, $shouldReplaceOffer ? $order->offered_driver_id : null);
                }
            });
    }

    protected function pickCandidate(Order $order, ?int $excludeDriverId = null): ?Driver
    {
        $declinedDriverIds = OrderDriverDecline::query()
            ->where('order_id', $order->id)
            ->pluck('driver_id')
            ->all();

        $drivers = Driver::query()
            ->with(['user:id,name', 'activeShift', 'latestPing'])
            ->whereIn('status', ['ONLINE', 'ON_ROUTE'])
            ->whereHas('activeShift')
            ->when($excludeDriverId, fn ($query) => $query->where('id', '!=', $excludeDriverId))
            ->when($declinedDriverIds, fn ($query) => $query->whereNotIn('id', $declinedDriverIds))
            ->get();

        if ($drivers->isEmpty()) {
            return null;
        }

        $withDistance = $drivers->map(function (Driver $driver) use ($order) {
            $distance = null;
            $pickupLat = (float) ($order->pickup_lat ?? $order->dropoff_lat);
            $pickupLng = (float) ($order->pickup_lng ?? $order->dropoff_lng);
            if ($driver->latestPing) {
                $distance = $this->distanceKm(
                    (float) $driver->latestPing->lat,
                    (float) $driver->latestPing->lng,
                    $pickupLat,
                    $pickupLng,
                );
            }

            $capacity = (float) ($driver->vehicle?->capacity ?? 100);
            $activeLoad = (float) $driver->assignedOrders()->whereIn('status', ['ASSIGNED', 'PICKED_UP'])->sum('size');
            $remainingCapacity = max(0, $capacity - $activeLoad);

            return [
                'driver' => $driver,
                'distance' => $distance,
                'assigned_count' => $driver->assignedOrders()->whereIn('status', ['ASSIGNED', 'PICKED_UP'])->count(),
                'remaining_capacity' => $remainingCapacity,
                'time_window_penalty' => $order->time_window_end ? max(0, 60 - now()->diffInMinutes($order->time_window_end, false)) : 0,
            ];
        });

        $nearby = $withDistance
            ->filter(fn (array $candidate) => $candidate['remaining_capacity'] >= (float) ($order->size ?? 1))
            ->filter(fn (array $candidate) => $candidate['distance'] !== null && $candidate['distance'] <= 8)
            ->sortBy([
                ['time_window_penalty', 'desc'],
                ['assigned_count', 'asc'],
                ['distance', 'asc'],
            ]);

        if ($nearby->isNotEmpty()) {
            return $nearby->first()['driver'];
        }

        $fallback = $withDistance
            ->filter(fn (array $candidate) => $candidate['remaining_capacity'] >= (float) ($order->size ?? 1))
            ->sortBy([
            ['time_window_penalty', 'desc'],
            ['assigned_count', 'asc'],
            ['distance', 'asc'],
        ]);

        return $fallback->first()['driver'] ?? null;
    }

    protected function isDriverAvailable(int $driverId): bool
    {
        return Driver::query()
            ->whereKey($driverId)
            ->whereIn('status', ['ONLINE', 'ON_ROUTE'])
            ->whereHas('activeShift')
            ->exists();
    }

    protected function distanceKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadius = 6371;

        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);

        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        $c = 2 * atan2(sqrt($a), sqrt(1 - $a));

        return $earthRadius * $c;
    }
}
