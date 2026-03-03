<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\LocationPing;
use Illuminate\Http\Request;

class TrackingController extends Controller
{
    public function ping(Request $request)
    {
        $driver = $request->user()->driver;

        if (!$driver) {
            return response()->json(['message' => 'User is not a driver'], 422);
        }

        $data = $request->validate([
            'lat' => ['required','numeric'],
            'lng' => ['required','numeric'],
            'speed' => ['nullable','numeric'],
            'heading' => ['nullable','numeric'],
        ]);

        $ping = LocationPing::create([
            'driver_id' => $driver->id,
            ...$data,
        ]);

        // Later: broadcast DriverLocationUpdated event here

        return response()->json($ping, 201);
    }
}