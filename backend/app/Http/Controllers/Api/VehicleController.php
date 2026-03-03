<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Vehicle;
use Illuminate\Http\Request;

class VehicleController extends Controller
{
    public function index()
    {
        return response()->json(Vehicle::query()->latest()->get());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required','string','max:255'],
            'type' => ['nullable','string','max:50'],
            'capacity' => ['nullable','numeric','min:0'],
            'max_stops' => ['nullable','integer','min:1','max:500'],
        ]);

        $vehicle = Vehicle::create($data);

        return response()->json($vehicle, 201);
    }
}