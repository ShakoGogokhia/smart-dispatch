<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\RoutePlan;
use Illuminate\Http\Request;

class DriverRouteController extends Controller
{
    public function today(Request $request)
    {
        $driver = $request->user()->driver;

        if (!$driver) {
            return response()->json(['message' => 'User is not a driver'], 422);
        }

        $today = now()->toDateString();

        $route = RoutePlan::query()
            ->with(['stops.order'])
            ->where('driver_id', $driver->id)
            ->where('route_date', $today)
            ->latest('id')
            ->first();

        return response()->json([
            'date' => $today,
            'route' => $route,
        ]);
    }
}