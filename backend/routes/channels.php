<?php

use App\Models\Order;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('users.{userId}', fn ($user, int $userId) => (int) $user->id === $userId);

Broadcast::channel('orders.{orderId}', function ($user, int $orderId) {
    $order = Order::find($orderId);

    if (!$order) {
        return false;
    }

    if ($user->hasRole('admin')) {
        return true;
    }

    if ((int) $order->customer_user_id === (int) $user->id) {
        return true;
    }

    if ($user->driver && in_array($user->driver->id, [$order->assigned_driver_id, $order->offered_driver_id], true)) {
        return true;
    }

    return false;
});
