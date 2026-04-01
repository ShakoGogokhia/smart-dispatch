<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return $request->user()
            ->appNotifications()
            ->limit(30)
            ->get()
            ->map(fn (AppNotification $notification) => [
                'id' => $notification->id,
                'type' => $notification->type,
                'title' => $notification->title,
                'message' => $notification->message,
                'payload' => $notification->payload,
                'read_at' => $notification->read_at?->toDateTimeString(),
                'created_at' => $notification->created_at?->toDateTimeString(),
            ])
            ->values();
    }

    public function markRead(Request $request, AppNotification $notification)
    {
        abort_unless((int) $notification->user_id === (int) $request->user()->id, 403);

        $notification->update([
            'read_at' => now(),
        ]);

        return response()->json([
            'id' => $notification->id,
            'read_at' => $notification->read_at?->toDateTimeString(),
        ]);
    }
}
