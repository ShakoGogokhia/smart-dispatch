<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Market;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class UsersController extends Controller
{
    public function index()
    {
        return User::query()
            ->with('roles:name')
            ->select('id', 'name', 'email', 'language')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'language' => $user->language,
                'roles' => $user->getRoleNames()->values(),
            ])
            ->values();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'email', 'max:255', 'unique:users,email'],
            'language' => ['nullable', 'string', 'in:en,ka'],
            'password' => ['required', 'string', 'min:6'],
            'roles' => ['required', 'array', 'min:1'],
            'roles.*' => ['string', Rule::in(['admin', 'owner', 'staff', 'customer', 'driver'])],
        ]);

        $user = User::create([
            'name' => $data['name'],
            'email' => $data['email'],
            'language' => $data['language'] ?? 'en',
            'password' => $data['password'],
        ]);
        $user->syncRoles($data['roles']);

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'language' => $user->language,
            'roles' => $user->getRoleNames()->values(),
        ], 201);
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'email' => ['sometimes', 'email', 'max:255', Rule::unique('users', 'email')->ignore($user->id)],
            'language' => ['sometimes', 'string', 'in:en,ka'],
            'password' => ['nullable', 'string', 'min:6'],
            'roles' => ['sometimes', 'array', 'min:1'],
            'roles.*' => ['string', Rule::in(['admin', 'owner', 'staff', 'customer', 'driver'])],
        ]);

        $updates = [];
        if (array_key_exists('name', $data)) {
            $updates['name'] = $data['name'];
        }
        if (array_key_exists('email', $data)) {
            $updates['email'] = $data['email'];
        }
        if (array_key_exists('language', $data)) {
            $updates['language'] = $data['language'];
        }
        if (!empty($data['password'])) {
            $updates['password'] = $data['password'];
        }

        if ($updates) {
            $user->update($updates);
        }

        if (array_key_exists('roles', $data)) {
            $user->syncRoles($data['roles']);
        }

        return response()->json([
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'language' => $user->language,
            'roles' => $user->getRoleNames()->values(),
        ]);
    }

    public function owners()
    {
        return User::query()
            ->with('roles:name')
            ->select('id','name','email', 'language')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'language' => $user->language,
                'roles' => $user->getRoleNames()->values(),
            ])
            ->values();
    }

    public function assignable(Market $market)
    {
        return User::query()
            ->select('id', 'name', 'email', 'language')
            ->orderBy('name')
            ->get()
            ->map(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'language' => $user->language,
                'roles' => $user->getRoleNames()->values(),
                'is_owner' => (int) $market->owner_user_id === (int) $user->id,
            ])
            ->values();
    }
}
