<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use Illuminate\Http\Request;

class CustomerOrderController extends Controller
{
    public function history(Request $request)
    {
        $orders = Order::query()
            ->with(['market:id,name,code', 'items', 'assignedDriver.user:id,name'])
            ->where('customer_user_id', $request->user()->id)
            ->latest()
            ->paginate(20);

        $orders->setCollection($orders->getCollection()->map(fn (Order $order) => $this->serialize($order)));

        return response()->json($orders);
    }

    public function receipt(Request $request, Order $order)
    {
        abort_unless((int) $order->customer_user_id === (int) $request->user()->id || $request->user()->hasRole('admin'), 403);

        return response()->json($this->serialize($order->load(['market:id,name,code,address', 'items'])));
    }

    private function serialize(Order $order): array
    {
        return [
            'id' => $order->id,
            'code' => $order->code,
            'status' => $order->status,
            'created_at' => $order->created_at?->toDateTimeString(),
            'delivered_at' => $order->delivered_at?->toDateTimeString(),
            'market' => $order->market,
            'total' => $order->total,
            'receipt' => [
                'number' => $order->receipt_number,
                'issued_at' => $order->created_at?->toDateTimeString(),
                'subtotal' => $order->subtotal,
                'discount_total' => $order->discount_total,
                'total' => $order->total,
                'payment' => [
                    'method' => $order->payment_method,
                    'status' => $order->payment_status,
                    'reference' => $order->payment_reference,
                    'amount' => $order->payment_amount,
                    'paid_at' => $order->paid_at?->toDateTimeString(),
                    'failed_at' => $order->payment_failed_at?->toDateTimeString(),
                    'failure_reason' => $order->payment_failure_reason,
                    'refunded_amount' => $order->refunded_amount,
                    'refunded_at' => $order->refunded_at?->toDateTimeString(),
                ],
                'items' => $order->items->map(fn ($item) => [
                    'name' => $item->name,
                    'qty' => $item->qty,
                    'unit_price' => $item->unit_price,
                    'line_total' => $item->line_total,
                    'combo_offer' => $item->combo_offer,
                    'removed_ingredients' => $item->removed_ingredients ?? [],
                ])->values(),
            ],
            'refund_summary' => [
                'status' => $order->refund_status,
                'reason' => $order->refund_reason,
                'requested_at' => $order->refund_requested_at?->toDateTimeString(),
            ],
            'rating_summary' => [
                'rating' => $order->customer_rating,
                'feedback' => $order->customer_feedback,
            ],
            'actions' => [
                'can_cancel' => in_array($order->status, ['MARKET_PENDING', 'MARKET_ACCEPTED', 'READY_FOR_PICKUP'], true),
                'can_rate' => $order->status === 'DELIVERED',
                'can_reorder' => $order->items->isNotEmpty(),
                'can_request_refund' => $order->status === 'DELIVERED' && $order->refund_status !== 'pending',
            ],
        ];
    }
}
