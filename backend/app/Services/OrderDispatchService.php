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
    public const OFFER_TIMEOUT_SECONDS = 300;

    /** A busy driver only gets the next offer when this close (km) to the current customer. */
    public const NEXT_OFFER_RADIUS_KM = 0.5;

    /**
     * Status an unassigned order goes back to when an offer is declined or times out:
     * READY_FOR_PICKUP once the market has prepared it, MARKET_ACCEPTED while it's still being prepared.
     */
    public static function waitingStatus(Order $order): string
    {
        return $order->ready_for_pickup_at ? 'READY_FOR_PICKUP' : 'MARKET_ACCEPTED';
    }

    /** Orders are offered as soon as the market accepts them, so the driver can head over while it's prepared. */
    public function offerOrder(Order $order, ?int $excludeDriverId = null): ?Order
    {
        if ($order->assigned_driver_id || !in_array($order->status, ['READY_FOR_PICKUP', 'MARKET_ACCEPTED'], true)) {
            return $order->fresh(['assignedDriver.user', 'offeredDriver.user']);
        }

        $candidate = $this->pickCandidate($order, $excludeDriverId);

        if (!$candidate) {
            $order->update([
                'offered_driver_id' => null,
                'offer_sent_at' => null,
                'status' => self::waitingStatus($order),
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
            ->whereIn('status', ['MARKET_ACCEPTED', 'READY_FOR_PICKUP', 'OFFERED'])
            ->get()
            ->each(function (Order $order) {
                $currentOfferedDriverId = $order->offered_driver_id;
                $shouldReplaceOffer = !$order->offered_driver_id
                    || !$order->offer_sent_at
                    || $order->offer_sent_at->lt(now()->subSeconds(self::OFFER_TIMEOUT_SECONDS))
                    || !$this->isDriverAvailable($order->offered_driver_id);

                if ($shouldReplaceOffer) {
                    if ($order->status === 'OFFERED') {
                        $order->update([
                            'offered_driver_id' => null,
                            'offer_sent_at' => null,
                            'status' => self::waitingStatus($order),
                        ]);
                    }

                    $this->offerOrder($order->fresh(), $currentOfferedDriverId);
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
            ->get()
            ->filter(fn (Driver $driver) => $this->canReceiveNewOffer($driver, $order))
            ->values();

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

    /**
     * One job at a time: a driver with no active delivery can get offers; a driver who is delivering
     * only gets the next offer once the current order is picked up and they're within
     * NEXT_OFFER_RADIUS_KM of that customer. Never more than one pending offer per driver.
     */
    public function canReceiveNewOffer(Driver $driver, ?Order $forOrder = null): bool
    {
        $hasOtherPendingOffer = Order::query()
            ->where('offered_driver_id', $driver->id)
            ->where('status', 'OFFERED')
            ->when($forOrder, fn ($query) => $query->whereKeyNot($forOrder->id))
            ->exists();
        if ($hasOtherPendingOffer) {
            return false;
        }

        $active = $driver->assignedOrders()->whereIn('status', ['ASSIGNED', 'PICKED_UP'])->get();
        if ($active->isEmpty()) {
            return true;
        }

        if ($active->count() > 1) {
            return false;
        }

        $current = $active->first();
        $ping = $driver->latestPing;
        if ($current->status !== 'PICKED_UP' || !$ping || $current->dropoff_lat === null || $current->dropoff_lng === null) {
            return false;
        }

        return $this->distanceKm((float) $ping->lat, (float) $ping->lng, (float) $current->dropoff_lat, (float) $current->dropoff_lng)
            <= self::NEXT_OFFER_RADIUS_KM;
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
