<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        $query = $request->user()
            ->appNotifications();

        if ($request->query('status') === 'unread') {
            $query->whereNull('read_at');
        }

        if ($request->filled('type')) {
            $type = trim((string) $request->query('type'));
            $query->where('type', 'like', $type.'%');
        }

        return $query
            ->limit((int) $request->query('limit', 50))
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

    public function markAllRead(Request $request)
    {
        $updated = $request->user()
            ->appNotifications()
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        return response()->json([
            'updated' => $updated,
        ]);
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
