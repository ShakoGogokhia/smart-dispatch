<?php

namespace App\Services;

use App\Models\Driver;
use App\Models\DriverTransaction;
use App\Models\Order;
use Illuminate\Support\Facades\DB;

class DriverEarningsService
{
    private const BASE_FEE = 3.50;
    private const PER_KM_RATE = 0.90;

    public function creditDeliveredOrder(Order $order, Driver $driver): DriverTransaction
    {
        return DB::transaction(function () use ($order, $driver) {
            $existing = DriverTransaction::query()
                ->where('driver_id', $driver->id)
                ->where('order_id', $order->id)
                ->where('type', 'delivery_earning')
                ->first();

            if ($existing) {
                return $existing;
            }

            $distanceKm = $this->calculateDistanceKm($order);
            $weatherMultiplier = $this->weatherMultiplier($order->weather_condition);
            $amount = round((self::BASE_FEE + ($distanceKm * self::PER_KM_RATE)) * $weatherMultiplier, 2);

            $transaction = DriverTransaction::create([
                'driver_id' => $driver->id,
                'order_id' => $order->id,
                'type' => 'delivery_earning',
                'amount' => $amount,
                'distance_km' => $distanceKm,
                'weather_multiplier' => $weatherMultiplier,
                'weather_condition' => $order->weather_condition,
                'description' => sprintf('Delivery earning for %s', $order->code),
            ]);

            $driver->increment('balance', $amount);
            $driver->increment('total_earned', $amount);

            $order->forceFill([
                'driver_distance_km' => $distanceKm,
                'driver_weather_multiplier' => $weatherMultiplier,
                'driver_earning_amount' => $amount,
            ])->save();

            return $transaction;
        });
    }

    public function calculateDistanceKm(Order $order): float
    {
        $pickupLat = (float) ($order->pickup_lat ?? $order->market?->lat ?? $order->dropoff_lat);
        $pickupLng = (float) ($order->pickup_lng ?? $order->market?->lng ?? $order->dropoff_lng);
        $dropoffLat = (float) $order->dropoff_lat;
        $dropoffLng = (float) $order->dropoff_lng;

        return round($this->haversineKm($pickupLat, $pickupLng, $dropoffLat, $dropoffLng), 2);
    }

    public function weatherMultiplier(?string $condition): float
    {
        return match (strtolower((string) $condition)) {
            'rain' => 1.15,
            'snow' => 1.30,
            'storm' => 1.45,
            'fog' => 1.10,
            default => 1.00,
        };
    }

    private function haversineKm(float $lat1, float $lng1, float $lat2, float $lng2): float
    {
        $earthRadiusKm = 6371;
        $dLat = deg2rad($lat2 - $lat1);
        $dLng = deg2rad($lng2 - $lng1);
        $a = sin($dLat / 2) ** 2
            + cos(deg2rad($lat1)) * cos(deg2rad($lat2)) * sin($dLng / 2) ** 2;

        return 2 * $earthRadiusKm * asin(min(1, sqrt($a)));
    }
}
