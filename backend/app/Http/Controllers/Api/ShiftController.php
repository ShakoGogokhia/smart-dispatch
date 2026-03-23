<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use Illuminate\Http\Request;
use App\Services\OrderDispatchService;

class ShiftController extends Controller
{
    public function __construct(private OrderDispatchService $dispatchService)
    {
    }

    public function start(Request $request)
    {
        $user = $request->user();
        $driver = $user->driver;

        if (!$driver) {
            return response()->json(['message' => 'User is not a driver'], 422);
        }

        $active = Shift::where('driver_id', $driver->id)->where('status', 'ACTIVE')->first();
        if ($active) {
            return response()->json(['message' => 'Shift already active', 'shift' => $active], 422);
        }

        $shift = Shift::create([
            'driver_id' => $driver->id,
            'started_at' => now(),
            'status' => 'ACTIVE',
        ]);

        $driver->update(['status' => 'ONLINE']);
        $this->dispatchService->refreshPendingOrders();

        return response()->json($shift->load('driver'), 201);
    }

    public function end(Request $request)
    {
        $user = $request->user();
        $driver = $user->driver;

        if (!$driver) {
            return response()->json(['message' => 'User is not a driver'], 422);
        }

        $shift = Shift::where('driver_id', $driver->id)->where('status', 'ACTIVE')->first();
        if (!$shift) {
            return response()->json(['message' => 'No active shift'], 422);
        }

        $shift->update([
            'ended_at' => now(),
            'status' => 'ENDED',
        ]);

        $driver->update(['status' => 'OFFLINE']);
        $this->dispatchService->refreshPendingOrders();

        return response()->json($shift->load('driver'));
    }
}
