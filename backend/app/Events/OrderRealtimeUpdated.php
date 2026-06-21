<?php

namespace App\Events;

use App\Models\Order;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Foundation\Events\Dispatchable;
use Illuminate\Queue\SerializesModels;

class OrderRealtimeUpdated implements ShouldBroadcastNow
{
    use Dispatchable, SerializesModels;

    public function __construct(public Order $order, public string $eventType = 'order.updated')
    {
    }

    public function broadcastOn(): array
    {
        return [
            new PrivateChannel("orders.{$this->order->id}"),
            new Channel('dispatch'),
        ];
    }

    public function broadcastAs(): string
    {
        return $this->eventType;
    }

    public function broadcastWith(): array
    {
        return [
            'id' => $this->order->id,
            'code' => $this->order->code,
            'status' => $this->order->status,
            'estimated_delivery_at' => $this->order->estimated_delivery_at?->toDateTimeString(),
            'assigned_driver_id' => $this->order->assigned_driver_id,
            'offered_driver_id' => $this->order->offered_driver_id,
        ];
    }
}
