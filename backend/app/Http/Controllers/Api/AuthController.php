<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    protected function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'language' => $user->language,
            'roles' => $user->getRoleNames()->values(),
        ];
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'language' => ['nullable', 'string', 'in:en,ka'],
            'password' => ['required', 'confirmed', Password::min(6)],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'language' => $data['language'] ?? 'en',
            'password' => $data['password'],
        ]);

        $user->assignRole('customer');

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->serializeUser($user),
        ], 201);
    }

    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required'],
        ]);

        if (!Auth::attempt($credentials)) {
            return response()->json(['message' => 'Invalid credentials'], 401);
        }

        $user = $request->user();

        $token = $user->createToken('api-token')->plainTextToken;

        return response()->json([
            'token' => $token,
            'user' => $this->serializeUser($user),
        ]);
    }

    public function me(Request $request)
    {
        $u = $request->user()->load([
            'driver.vehicle',
            'driver.activeShift',
            'driver.latestPing',
        ]);

        return response()->json([
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'language' => $u->language,
            'roles' => $u->getRoleNames()->values(),
            'driver' => $u->driver ? [
                'id' => $u->driver->id,
                'status' => $u->driver->status,
                'vehicle' => $u->driver->vehicle,
                'active_shift' => $u->driver->activeShift,
                'latest_ping' => $u->driver->latestPing,
            ] : null,
        ]);
    }

    public function updateLanguage(Request $request)
    {
        $data = $request->validate([
            'language' => ['required', 'string', 'in:en,ka'],
        ]);

        $user = $request->user();
        $user->forceFill([
            'language' => $data['language'],
        ])->save();

        return response()->json([
            'language' => $user->language,
            'user' => $this->serializeUser($user),
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json([
            'message' => 'Logged out'
        ]);
    }
}
