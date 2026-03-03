<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RoutePlan;
use App\Models\RouteStop;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ReoptimizeController extends Controller
{
    // POST /api/routes/{routePlan}/reoptimize
    public function reoptimize(RoutePlan $routePlan)
    {
        return DB::transaction(function () use ($routePlan) {

            $stops = RouteStop::with('order')
                ->where('route_plan_id', $routePlan->id)
                ->orderBy('sequence')
                ->get();

            $done = $stops->whereIn('status', ['DONE'])->values();
            $pending = $stops->where('status', 'PENDING')->values();

            // nearest neighbor reorder pending only
            $orderedPending = $this->nearestNeighbor($pending->all());

            // rewrite sequences: DONE keep same relative order first, then pending
            $seq = 1;

            foreach ($done as $s) {
                $s->update(['sequence' => $seq++]);
            }

            foreach ($orderedPending as $s) {
                $s->update(['sequence' => $seq++]);
            }

            return response()->json($routePlan->fresh()->load('stops.order'));
        });
    }

    private function nearestNeighbor(array $stops): array
    {
        if (count($stops) <= 2) return $stops;

        $remaining = $stops;
        $current = array_shift($remaining);
        $path = [$current];

        while (!empty($remaining)) {
            $bestIdx = 0;
            $bestDist = INF;

            foreach ($remaining as $idx => $candidate) {
                $dist = $this->haversineKm(
                    (float)$current->order->dropoff_lat, (float)$current->order->dropoff_lng,
                    (float)$candidate->order->dropoff_lat, (float)$candidate->order->dropoff_lng
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