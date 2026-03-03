<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Market;
use App\Models\User;
use Illuminate\Support\Facades\Storage;

class MarketController extends Controller
{
    public function index(Request $request)
    {
        // admin list all
        return Market::with('owner:id,name,email')->latest()->get();
    }

    public function myMarkets(Request $request)
    {
        $user = $request->user();

        if ($user->hasRole('admin')) {
            return Market::with('owner:id,name,email')->latest()->get();
        }

        $owned = Market::where('owner_user_id', $user->id);

        $staff = Market::whereHas('users', function ($q) use ($user) {
            $q->where('users.id', $user->id);
        });

        return $owned->union($staff)->get();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:markets,code'],
            'owner_user_id' => ['required', 'exists:users,id'],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $market = Market::create([
            'name' => $data['name'],
            'code' => $data['code'],
            'owner_user_id' => $data['owner_user_id'],
            'address' => $data['address'] ?? null,
            'is_active' => $data['is_active'] ?? true,
        ]);

        // owner role
        $owner = User::find($data['owner_user_id']);
        if ($owner && !$owner->hasRole('owner')) {
            $owner->assignRole('owner');
        }

        return response()->json($market->load('owner:id,name,email'), 201);
    }

    public function update(Request $request, Market $market)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['sometimes', 'string', 'max:50', 'unique:markets,code,' . $market->id],
            'address' => ['nullable', 'string', 'max:255'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        $market->update($data);
        return $market->load('owner:id,name,email');
    }

    public function assignOwner(Request $request, Market $market)
    {
        $data = $request->validate([
            'owner_user_id' => ['required', 'exists:users,id'],
        ]);

        $market->update(['owner_user_id' => $data['owner_user_id']]);

        $owner = User::find($data['owner_user_id']);
        if ($owner && !$owner->hasRole('owner')) {
            $owner->assignRole('owner');
        }

        return $market->load('owner:id,name,email');
    }
    public function uploadLogo(Request $request, Market $market)
    {
        $request->validate([
            'logo' => ['required', 'image', 'max:2048'], 
        ]);

        $path = $request->file('logo')->store('market-logos', 'public');

        if ($market->logo_path) {
            Storage::disk('public')->delete($market->logo_path);
        }

        $market->update(['logo_path' => $path]);

        return response()->json([
            'id' => $market->id,
            'logo_url' => Storage::disk('public')->url($path),
            'logo_path' => $path,
        ]);
    }
    public function staff(Market $market)
{
    return $market->users()->select('users.id','users.name','users.email')
        ->withPivot('role')
        ->get();
}

public function addStaff(Request $request, Market $market)
{
    $data = $request->validate([
        'user_id' => ['required','exists:users,id'],
        'role' => ['nullable','in:staff,owner'],
    ]);

    $market->users()->syncWithoutDetaching([
        // prevent removing current owner
        (int)$data['user_id'] => ['role' => $data['role'] ?? 'staff'],
    ]);

    return response()->json(['message' => 'Staff added']);
}

public function removeStaff(Request $request, Market $market, $userId)
{
    // prevent removing current owner
    if ((int)$market->owner_user_id === (int)$userId) {
        return response()->json(['message' => 'Cannot remove market owner'], 422);
    }

    $market->users()->detach((int)$userId);

    return response()->json(['message' => 'Staff removed']);
        // prevent removing current owner
}
}