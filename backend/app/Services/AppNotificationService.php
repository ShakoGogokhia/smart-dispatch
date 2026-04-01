<?php

namespace App\Services;

use App\Models\AppNotification;
use App\Models\Market;
use App\Models\Order;
use App\Models\User;
use Illuminate\Support\Collection;

class AppNotificationService
{
    public function sendToUser(int $userId, string $type, string $title, string $message, ?array $payload = null): void
    {
        AppNotification::create([
            'user_id' => $userId,
            'type' => $type,
            'title' => $title,
            'message' => $message,
            'payload' => $payload,
        ]);
    }

    public function sendToUsers(iterable $userIds, string $type, string $title, string $message, ?array $payload = null): void
    {
        collect($userIds)
            ->filter()
            ->unique()
            ->each(fn (int $userId) => $this->sendToUser($userId, $type, $title, $message, $payload));
    }

    public function notifyOrderUpdate(Order $order, string $title, string $message, string $type = 'order.update'): void
    {
        $order->loadMissing(['market.owner', 'assignedDriver.user']);

        $recipients = collect([
            $order->customer_user_id,
            $order->market?->owner_user_id,
            $order->assignedDriver?->user?->id,
        ]);

        $this->sendToUsers($recipients, $type, $title, $message, [
            'order_id' => $order->id,
            'order_code' => $order->code,
            'market_id' => $order->market_id,
        ]);
    }

    public function notifyMarketTeam(Market $market, string $type, string $title, string $message, ?array $payload = null): void
    {
        $market->loadMissing('users:id');

        $recipients = $market->users->pluck('id')
            ->push($market->owner_user_id)
            ->filter()
            ->unique();

        $this->sendToUsers($recipients, $type, $title, $message, $payload);
    }

    public function notifyAdmins(string $type, string $title, string $message, ?array $payload = null): void
    {
        $adminIds = User::role('admin')->pluck('id');
        $this->sendToUsers($adminIds, $type, $title, $message, $payload);
    }
}
