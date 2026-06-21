<?php

namespace App\Services;

use App\Models\Order;
use Illuminate\Support\Str;

class PaymentSimulationService
{
    public function simulate(Order $order, string $method, bool $forceFail = false): Order
    {
        if ($order->payment_status === 'paid') {
            return $order;
        }

        if ($method === 'cash_on_delivery') {
            $order->update([
                'payment_method' => 'cash_on_delivery',
                'payment_status' => 'pending',
                'payment_amount' => $order->total,
                'payment_reference' => 'COD-' . Str::upper(Str::random(8)),
                'payment_failed_at' => null,
                'payment_failure_reason' => null,
            ]);

            return $order->fresh();
        }

        if ($forceFail) {
            $order->update([
                'payment_method' => $method,
                'payment_status' => 'failed',
                'payment_amount' => $order->total,
                'payment_reference' => 'FAIL-' . Str::upper(Str::random(8)),
                'payment_failed_at' => now(),
                'payment_failure_reason' => 'Mock payment failure requested.',
                'paid_at' => null,
            ]);

            return $order->fresh();
        }

        $order->update([
            'payment_method' => $method,
            'payment_status' => 'paid',
            'payment_amount' => $order->total,
            'payment_reference' => 'PAY-' . Str::upper(Str::random(10)),
            'paid_at' => now(),
            'payment_failed_at' => null,
            'payment_failure_reason' => null,
        ]);

        return $order->fresh();
    }

    public function refund(Order $order, ?float $amount = null): Order
    {
        $refundAmount = round($amount ?? (float) $order->total, 2);

        $order->update([
            'payment_status' => 'refunded',
            'refund_status' => 'approved',
            'refunded_amount' => $refundAmount,
            'refunded_at' => now(),
        ]);

        return $order->fresh();
    }
}
