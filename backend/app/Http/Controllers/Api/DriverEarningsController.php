<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\DriverTransaction;
use App\Models\Order;
use Illuminate\Http\Request;

class DriverEarningsController extends Controller
{
    public function summary(Request $request)
    {
        $driver = $request->user()->driver;

        if (!$driver) {
            return response()->json(['message' => 'User is not a driver'], 422);
        }

        $from = $request->query('from', now()->subDays(6)->toDateString());
        $to = $request->query('to', now()->toDateString());

        $transactions = DriverTransaction::query()
            ->with('order:id,code,status,dropoff_address,delivered_at')
            ->where('driver_id', $driver->id)
            ->whereBetween('created_at', [$from.' 00:00:00', $to.' 23:59:59'])
            ->latest()
            ->get();

        $daily = collect(range(0, 6))->map(function (int $offset) use ($to, $driver) {
            $day = now()->parse($to)->subDays(6 - $offset)->toDateString();

            return [
                'date' => $day,
                'earnings' => (float) DriverTransaction::query()
                    ->where('driver_id', $driver->id)
                    ->whereBetween('created_at', [$day.' 00:00:00', $day.' 23:59:59'])
                    ->sum('amount'),
                'deliveries' => Order::query()
                    ->where('assigned_driver_id', $driver->id)
                    ->where('status', 'DELIVERED')
                    ->whereBetween('delivered_at', [$day.' 00:00:00', $day.' 23:59:59'])
                    ->count(),
            ];
        })->values();

        return response()->json([
            'range' => ['from' => $from, 'to' => $to],
            'driver' => $driver->load(['vehicle', 'activeShift']),
            'totals' => [
                'balance' => $driver->balance,
                'total_earned' => $driver->total_earned,
                'period_earnings' => round((float) $transactions->sum('amount'), 2),
                'period_deliveries' => $transactions->where('type', 'delivery_earning')->count(),
                'average_delivery_earning' => $transactions->count() ? round((float) $transactions->avg('amount'), 2) : 0,
            ],
            'daily' => $daily,
            'transactions' => $transactions->map(fn (DriverTransaction $transaction) => [
                'id' => $transaction->id,
                'type' => $transaction->type,
                'amount' => $transaction->amount,
                'distance_km' => $transaction->distance_km,
                'weather_multiplier' => $transaction->weather_multiplier,
                'weather_condition' => $transaction->weather_condition,
                'description' => $transaction->description,
                'created_at' => $transaction->created_at?->toDateTimeString(),
                'order' => $transaction->order,
                'payout_status' => 'available',
            ])->values(),
        ]);
    }
}
