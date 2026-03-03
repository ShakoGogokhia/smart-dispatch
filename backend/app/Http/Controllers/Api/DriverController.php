<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Driver;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class DriverController extends Controller
{
    public function index()
    {
        return response()->json(
            Driver::query()->with(['user','vehicle'])->latest()->get()
        );
    }

    // creates driver user + driver record (MVP)
    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required','string','max:255'],
            'email' => ['required','email','max:255','unique:users,email'],
            'password' => ['required','string','min:6'],
            'vehicle_id' => ['nullable','exists:vehicles,id'],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'password' => Hash::make($data['password']),
        ]);

        $driver = Driver::create([
            'user_id' => $user->id,
            'vehicle_id' => $data['vehicle_id'] ?? null,
            'status' => 'OFFLINE',
        ]);

        return response()->json($driver->load(['user','vehicle']), 201);
    }

    public function updateStatus(Request $request, Driver $driver)
    {
        $data = $request->validate([
            'status' => ['required','string'],
        ]);

        $allowed = ['OFFLINE','ONLINE','ON_ROUTE','BREAK'];
        if (!in_array($data['status'], $allowed, true)) {
            return response()->json(['message' => 'Invalid driver status'], 422);
        }

        $driver->update(['status' => $data['status']]);

        return response()->json($driver->load(['user','vehicle']));
    }
}