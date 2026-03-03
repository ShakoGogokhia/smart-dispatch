<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Shift;
use Illuminate\Http\Request;

class ShiftController extends Controller
{
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

        return response()->json($shift, 201);
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

        return response()->json($shift);
    }
}