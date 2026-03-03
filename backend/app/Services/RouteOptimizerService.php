<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\Order;
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

        // 1) assign orders to drivers (round robin with max stops)
        $assigned = [];
        foreach ($drivers as $d) {
            $maxStops = (int) ($d->vehicle?->max_stops ?? 30);
            $assigned[$d->id] = [
                'driver_id' => $d->id,
                'max_stops' => $maxStops,
                'orders' => [],
            ];
        }

        $driverIds = $drivers->pluck('id')->values();
        $i = 0;

        foreach ($orders as $order) {
            // Find next driver who still has free stops
            $attempts = 0;
            while ($attempts < $driverIds->count()) {
                $driverId = $driverIds[$i % $driverIds->count()];
                $i++;
                $attempts++;

                if (count($assigned[$driverId]['orders']) < $assigned[$driverId]['max_stops']) {
                    $assigned[$driverId]['orders'][] = $order;
                    break;
                }
            }
        }

        // 2) order stops per driver (nearest neighbor by dropoff coords)
        $result = [];
        foreach ($assigned as $driverId => $bucket) {
            /** @var Order[] $bucketOrders */
            $bucketOrders = $bucket['orders'];

            $sequence = $this->nearestNeighborSequence($bucketOrders);

            $result[] = [
                'driver_id' => $driverId,
                'order_ids' => collect($sequence)->pluck('id')->values()->all(),
                'stops' => collect($sequence)->values()->map(function ($o, $idx) {
                    return [
                        'order_id' => $o->id,
                        'sequence' => $idx + 1,
                    ];
                })->all(),
            ];
        }

        return $result;
    }

    private function nearestNeighborSequence(array $orders): array
    {
        if (count($orders) <= 2) return $orders;

        // start with first order (simple)
        $remaining = $orders;
        $current = array_shift($remaining);
        $path = [$current];

        while (!empty($remaining)) {
            $bestIdx = 0;
            $bestDist = INF;

            foreach ($remaining as $idx => $candidate) {
                $dist = $this->haversineKm(
                    (float)$current->dropoff_lat, (float)$current->dropoff_lng,
                    (float)$candidate->dropoff_lat, (float)$candidate->dropoff_lng
                );

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