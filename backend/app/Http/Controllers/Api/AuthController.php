<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rules\Password;

class AuthController extends Controller
{
    protected function serializeUser(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'phone' => $user->phone,
            'address' => $user->address,
            'profile_photo_url' => $user->profile_photo_url,
            'language' => $user->language,
            'roles' => $user->getRoleNames()->values(),
        ];
    }

    public function register(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'phone' => ['nullable', 'string', 'max:50'],
            'address' => ['nullable', 'string', 'max:255'],
            'language' => ['nullable', 'string', 'in:en,ka'],
            'password' => ['required', 'confirmed', Password::min(6)],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'phone' => $data['phone'] ?? null,
            'address' => $data['address'] ?? null,
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
        $hasDriverTransactions = Schema::hasTable('driver_transactions');
        $hasAppNotifications = Schema::hasTable('app_notifications');

        $driverRelations = [
            'driver.vehicle',
            'driver.activeShift',
            'driver.latestPing',
        ];

        if ($hasDriverTransactions) {
            $driverRelations['driver.transactions'] = fn ($query) => $query->latest()->limit(10);
        }

        $u = $request->user()->load($driverRelations);

        $unreadNotifications = 0;

        if ($hasAppNotifications) {
            $unreadNotifications = $u->appNotifications()->whereNull('read_at')->count();
        }

        return response()->json([
            'id' => $u->id,
            'name' => $u->name,
            'email' => $u->email,
            'phone' => $u->phone,
            'address' => $u->address,
            'profile_photo_url' => $u->profile_photo_url,
            'language' => $u->language,
            'roles' => $u->getRoleNames()->values(),
            'permissions' => $this->permissionsForRoles($u->getRoleNames()->values()->all()),
            'notification_summary' => [
                'unread' => $unreadNotifications,
            ],
            'driver' => $u->driver ? [
                'id' => $u->driver->id,
                'status' => $u->driver->status,
                'balance' => $u->driver->balance,
                'total_earned' => $u->driver->total_earned,
                'vehicle' => $u->driver->vehicle,
                'active_shift' => $u->driver->activeShift,
                'latest_ping' => $u->driver->latestPing,
                'transactions' => $hasDriverTransactions ? $u->driver->transactions : [],
            ] : null,
        ]);
    }

    private function permissionsForRoles(array $roles): array
    {
        $matrix = [
            'admin' => ['manage_users', 'manage_markets', 'review_approvals', 'manage_refunds', 'view_analytics'],
            'owner' => ['manage_market_items', 'request_promos', 'request_badges', 'view_market_orders'],
            'staff' => ['manage_market_items', 'view_market_orders'],
            'customer' => ['place_orders', 'favorite_items', 'rate_orders', 'request_refunds'],
            'driver' => ['accept_orders', 'upload_proof', 'view_route'],
        ];

        return collect($roles)
            ->flatMap(fn (string $role) => $matrix[$role] ?? [])
            ->unique()
            ->values()
            ->all();
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

    public function updateProfile(Request $request)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'phone' => ['sometimes', 'nullable', 'string', 'max:50'],
            'address' => ['sometimes', 'nullable', 'string', 'max:255'],
            'current_password' => ['nullable', 'required_with:password', 'current_password'],
            'password' => ['nullable', 'confirmed', Password::min(6)],
        ]);

        $user = $request->user();
        $updates = [];

        if (array_key_exists('name', $data)) {
            $updates['name'] = trim((string) $data['name']);
        }

        if (array_key_exists('phone', $data)) {
            $updates['phone'] = trim((string) ($data['phone'] ?? '')) ?: null;
        }

        if (array_key_exists('address', $data)) {
            $updates['address'] = trim((string) ($data['address'] ?? '')) ?: null;
        }

        if (!empty($data['password'])) {
            $updates['password'] = $data['password'];
        }

        if ($updates) {
            $user->update($updates);
        }

        return response()->json([
            'user' => $this->serializeUser($user->fresh()),
        ]);
    }

    public function uploadProfilePhoto(Request $request)
    {
        $request->validate([
            'photo' => ['required', 'image', 'max:2048'],
        ]);

        $user = $request->user();
        $path = $request->file('photo')->store('profile-photos', 'public');
        $oldUrl = $user->profile_photo_url;

        if ($oldUrl) {
            $publicPath = parse_url($oldUrl, PHP_URL_PATH);
            $storagePrefix = '/storage/';

            if (is_string($publicPath) && str_starts_with($publicPath, $storagePrefix)) {
                Storage::disk('public')->delete(substr($publicPath, strlen($storagePrefix)));
            }
        }

        $user->forceFill([
            'profile_photo_url' => Storage::disk('public')->url($path),
        ])->save();

        return response()->json([
            'user' => $this->serializeUser($user->fresh()),
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
