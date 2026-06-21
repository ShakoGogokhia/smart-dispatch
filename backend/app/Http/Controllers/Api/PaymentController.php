<?php

namespace App\Http\Controllers\Api;

use App\Events\OrderRealtimeUpdated;
use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Services\AppNotificationService;
use App\Services\AuditLogService;
use App\Services\PaymentSimulationService;
use Illuminate\Http\Request;

class PaymentController extends Controller
{
    public function __construct(
        private PaymentSimulationService $payments,
        private AppNotificationService $notifications,
        private AuditLogService $audit,
    ) {
    }

    public function simulate(Request $request, Order $order)
    {
        abort_unless($this->canAccessOrder($request, $order), 403);

        $data = $request->validate([
            'method' => ['required', 'string', 'in:mock_card,cash_on_delivery'],
            'force_fail' => ['nullable', 'boolean'],
        ]);

        $updated = $this->payments->simulate($order, $data['method'], (bool) ($data['force_fail'] ?? false));

        $this->audit->record('payment.simulated', $request, $updated, [
            'method' => $data['method'],
            'payment_status' => $updated->payment_status,
        ]);
        $this->notifications->notifyOrderUpdate(
            $updated->fresh('market'),
            'Payment updated',
            "{$updated->code} payment is {$updated->payment_status}.",
            'payment.updated',
        );
        broadcast(new OrderRealtimeUpdated($updated, 'payment.updated'))->toOthers();

        return response()->json($this->paymentPayload($updated));
    }

    public function refund(Request $request, Order $order)
    {
        abort_unless($request->user()->hasRole('admin'), 403);

        $data = $request->validate([
            'amount' => ['nullable', 'numeric', 'min:0.01'],
        ]);

        $updated = $this->payments->refund($order, isset($data['amount']) ? (float) $data['amount'] : null);

        $this->audit->record('payment.refunded', $request, $updated, [
            'amount' => $updated->refunded_amount,
        ]);
        $this->notifications->notifyOrderUpdate(
            $updated->fresh('market'),
            'Refund processed',
            "{$updated->code} refund was processed.",
            'payment.refunded',
        );
        broadcast(new OrderRealtimeUpdated($updated, 'payment.refunded'))->toOthers();

        return response()->json($this->paymentPayload($updated));
    }

    private function canAccessOrder(Request $request, Order $order): bool
    {
        $user = $request->user();

        if ($user->hasRole('admin')) {
            return true;
        }

        return (int) $order->customer_user_id === (int) $user->id;
    }

    private function paymentPayload(Order $order): array
    {
        return [
            'order_id' => $order->id,
            'code' => $order->code,
            'payment_method' => $order->payment_method,
            'payment_status' => $order->payment_status,
            'payment_reference' => $order->payment_reference,
            'payment_amount' => $order->payment_amount,
            'paid_at' => $order->paid_at?->toDateTimeString(),
            'payment_failed_at' => $order->payment_failed_at?->toDateTimeString(),
            'payment_failure_reason' => $order->payment_failure_reason,
            'refunded_amount' => $order->refunded_amount,
            'refunded_at' => $order->refunded_at?->toDateTimeString(),
        ];
    }
}
