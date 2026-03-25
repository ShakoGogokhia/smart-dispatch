<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\Order;
use Carbon\Carbon;
use Illuminate\Support\Collection;

class RouteOptimizerService
{
    /**
     * Returns plan structure:
     * [
     *   ['driver_id' => 1, 'order_ids' => [5,9,2], 'stops' => [ ['order_id'=>5,'sequence'=>1], ... ] ],
     *   ...
     * ]
     */
    public function buildSuggestion(Collection $drivers, Collection $orders): array
    {
        if ($drivers->isEmpty()) {
            return [];
        }

        $sortedOrders = $orders
            ->sortBy([
                fn (Order $order) => $this->priorityRank($order),
                fn (Order $order) => $this->timeWindowRank($order),
                fn (Order $order) => $order->created_at?->timestamp ?? 0,
            ])
            ->values();

        $assigned = [];
        foreach ($drivers as $d) {
            $maxStops = (int) ($d->vehicle?->max_stops ?? 30);
            $capacity = (float) ($d->vehicle?->capacity ?? 100);
            $assigned[$d->id] = [
                'driver_id' => $d->id,
                'max_stops' => $maxStops,
                'capacity' => $capacity,
                'orders' => [],
                'size' => 0.0,
                'driver' => $d,
            ];
        }

        foreach ($sortedOrders as $order) {
            $bestDriverId = null;
            $bestScore = INF;

            foreach ($assigned as $driverId => $bucket) {
                if (count($bucket['orders']) >= $bucket['max_stops']) {
                    continue;
                }

                if (($bucket['size'] + (float) ($order->size ?? 1)) > $bucket['capacity']) {
                    continue;
                }

                $score = $this->scoreAssignment($bucket, $order);
                if ($score < $bestScore) {
                    $bestScore = $score;
                    $bestDriverId = $driverId;
                }
            }

            if ($bestDriverId !== null) {
                $assigned[$bestDriverId]['orders'][] = $order;
                $assigned[$bestDriverId]['size'] += (float) ($order->size ?? 1);
            }
        }

        $result = [];
        foreach ($assigned as $driverId => $bucket) {
            /** @var Order[] $bucketOrders */
            $bucketOrders = $bucket['orders'];

            $sequence = $this->nearestNeighborSequence($bucketOrders, $bucket['driver']);
            [$distanceKm, $durationMin, $stops] = $this->buildStopMetrics($sequence, $bucket['driver']);

            $result[] = [
                'driver_id' => $driverId,
                'order_ids' => collect($sequence)->pluck('id')->values()->all(),
                'total_size' => round($bucket['size'], 2),
                'planned_distance_km' => round($distanceKm, 2),
                'planned_duration_min' => $durationMin,
                'stops' => $stops,
            ];
        }

        return $result;
    }

    private function scoreAssignment(array $bucket, Order $order): float
    {
        /** @var Driver $driver */
        $driver = $bucket['driver'];
        $currentLat = (float) ($driver->latestPing->lat ?? $order->pickup_lat ?? $order->dropoff_lat);
        $currentLng = (float) ($driver->latestPing->lng ?? $order->pickup_lng ?? $order->dropoff_lng);

        if (!empty($bucket['orders'])) {
            /** @var Order $lastOrder */
            $lastOrder = end($bucket['orders']);
            $currentLat = (float) $lastOrder->dropoff_lat;
            $currentLng = (float) $lastOrder->dropoff_lng;
        }

        $pickupLat = (float) ($order->pickup_lat ?? $order->dropoff_lat);
        $pickupLng = (float) ($order->pickup_lng ?? $order->dropoff_lng);
        $dropoffLat = (float) $order->dropoff_lat;
        $dropoffLng = (float) $order->dropoff_lng;

        $distanceToPickup = $this->haversineKm($currentLat, $currentLng, $pickupLat, $pickupLng);
        $deliveryDistance = $this->haversineKm($pickupLat, $pickupLng, $dropoffLat, $dropoffLng);
        $priorityBoost = max(0, 6 - (int) ($order->priority ?? 3)) * 2.8;
        $timeWindowPenalty = $this->timeWindowPenalty($order);
        $loadPenalty = count($bucket['orders']) * 2.4;
        $capacityPenalty = (($bucket['size'] + (float) ($order->size ?? 1)) / max(1, $bucket['capacity'])) * 8;
        $readyPenalty = $this->readyTimePenalty($order);

        return $distanceToPickup + $deliveryDistance + $timeWindowPenalty + $loadPenalty + $capacityPenalty + $readyPenalty - $priorityBoost;
    }

    private function nearestNeighborSequence(array $orders, Driver $driver): array
    {
        if (count($orders) <= 2) {
            return $orders;
        }

        $remaining = $orders;
        $currentLat = (float) ($driver->latestPing->lat ?? $orders[0]->pickup_lat ?? $orders[0]->dropoff_lat);
        $currentLng = (float) ($driver->latestPing->lng ?? $orders[0]->pickup_lng ?? $orders[0]->dropoff_lng);
        $firstIndex = 0;
        $firstScore = INF;

        foreach ($remaining as $idx => $candidate) {
            $score = $this->haversineKm(
                $currentLat,
                $currentLng,
                (float) ($candidate->pickup_lat ?? $candidate->dropoff_lat),
                (float) ($candidate->pickup_lng ?? $candidate->dropoff_lng),
            ) + $this->timeWindowPenalty($candidate);

            if ($score < $firstScore) {
                $firstScore = $score;
                $firstIndex = $idx;
            }
        }

        $current = $remaining[$firstIndex];
        array_splice($remaining, $firstIndex, 1);
        $path = [$current];

        while (!empty($remaining)) {
            $bestIdx = 0;
            $bestDist = INF;

            foreach ($remaining as $idx => $candidate) {
                $dist = $this->haversineKm(
                    (float)$current->dropoff_lat, (float)$current->dropoff_lng,
                    (float)($candidate->pickup_lat ?? $candidate->dropoff_lat), (float)($candidate->pickup_lng ?? $candidate->dropoff_lng)
                ) + $this->timeWindowPenalty($candidate);

                if ($dist < $bestDist) {
                    $bestDist = $dist;
                    $bestIdx = $idx;
                }
            }

            $current = $remaining[$bestIdx];
            array_splice($remaining, $bestIdx, 1);
            $path[] = $current;
        }

        return $path;
    }

    private function buildStopMetrics(array $orders, Driver $driver): array
    {
        $distanceKm = 0.0;
        $durationMin = 0;
        $currentLat = (float) ($driver->latestPing->lat ?? $orders[0]->pickup_lat ?? $orders[0]->dropoff_lat ?? 0);
        $currentLng = (float) ($driver->latestPing->lng ?? $orders[0]->pickup_lng ?? $orders[0]->dropoff_lng ?? 0);
        $cursor = now();
        $stops = [];

        foreach ($orders as $idx => $order) {
            $pickupLat = (float) ($order->pickup_lat ?? $order->dropoff_lat);
            $pickupLng = (float) ($order->pickup_lng ?? $order->dropoff_lng);
            $dropoffLat = (float) $order->dropoff_lat;
            $dropoffLng = (float) $order->dropoff_lng;

            $legToPickup = $this->haversineKm($currentLat, $currentLng, $pickupLat, $pickupLng);
            $legToDropoff = $this->haversineKm($pickupLat, $pickupLng, $dropoffLat, $dropoffLng);
            $distanceKm += $legToPickup + $legToDropoff;
            $durationMin += (int) round(($legToPickup + $legToDropoff) * 3.2 + 6);
            $cursor = $cursor->copy()->addMinutes((int) round(($legToPickup + $legToDropoff) * 3.2 + 6));

            if ($order->time_window_start instanceof Carbon && $cursor->lt($order->time_window_start)) {
                $waitMinutes = $cursor->diffInMinutes($order->time_window_start);
                $durationMin += $waitMinutes;
                $cursor = $order->time_window_start->copy();
            }

            $stops[] = [
                'order_id' => $order->id,
                'sequence' => $idx + 1,
                'eta' => $cursor->toDateTimeString(),
                'status' => 'PENDING',
                'dispatch_score' => round($this->priorityRank($order) + $this->timeWindowPenalty($order), 2),
            ];

            $currentLat = $dropoffLat;
            $currentLng = $dropoffLng;
        }

        return [$distanceKm, $durationMin, $stops];
    }

    private function priorityRank(Order $order): int
    {
        return max(1, (int) ($order->priority ?? 3));
    }

    private function timeWindowRank(Order $order): int
    {
        return (int) ($order->time_window_end?->timestamp ?? PHP_INT_MAX);
    }

    private function timeWindowPenalty(Order $order): float
    {
        if (!$order->time_window_end) {
            return 0.0;
        }

        $minutes = now()->diffInMinutes($order->time_window_end, false);

        if ($minutes >= 90) {
            return 0.0;
        }

        if ($minutes <= 0) {
            return 22.0;
        }

        return (90 - $minutes) / 4;
    }

    private function readyTimePenalty(Order $order): float
    {
        if (in_array($order->status, ['READY_FOR_PICKUP', 'ASSIGNED', 'PICKED_UP'], true)) {
            return 0.0;
        }

        if ($order->ready_for_pickup_at) {
            return max(0, now()->diffInMinutes($order->ready_for_pickup_at, false));
        }

        if ($order->market_accepted_at) {
            return max(0, 18 - now()->diffInMinutes($order->market_accepted_at));
        }

        return 10.0;
    }

    private function haversineKm(float $lat1, float $lon1, float $lat2, float $lon2): float
    {
        $R = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLon = deg2rad($lon2 - $lon1);

        $a = sin($dLat/2) * sin($dLat/2) +
            cos(deg2rad($lat1)) * cos(deg2rad($lat2)) *
            sin($dLon/2) * sin($dLon/2);

        $c = 2 * atan2(sqrt($a), sqrt(1-$a));
        return $R * $c;
    }
}
