<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Market;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Database\Eloquent\Collection;

class MarketController extends Controller
{
    protected function applyFeaturedOrdering($query)
    {
        if (Market::hasFeaturedColumns()) {
            $query->orderByDesc('is_featured');
        }

        return $query;
    }

    protected function featuredAttributes(array $data): array
    {
        if (!Market::hasFeaturedColumns()) {
            return [];
        }

        return [
            'is_featured' => $data['is_featured'] ?? false,
            'featured_badge' => $data['featured_badge'] ?? null,
            'featured_headline' => $data['featured_headline'] ?? null,
            'featured_copy' => $data['featured_copy'] ?? null,
        ];
    }

    public function index(Request $request)
    {
        return $this->serializeMarkets(
            $this->applyFeaturedOrdering(
                Market::with('owner:id,name,email')
                ->withCount(['items as active_items_count' => function ($query) {
                    $query->where('is_active', true);
                }])
                ->with(['promoCodes' => function ($query) {
                    $query
                        ->activeApplicable()
                        ->latest()
                        ->limit(1);
                }])
            )
                ->latest()
                ->get()
        );
    }

    public function myMarkets(Request $request)
    {
        $user = $request->user();

        if ($user->hasRole('admin')) {
            return $this->index($request);
        }

        $owned = Market::where('owner_user_id', $user->id);

        $staff = Market::whereHas('users', function ($q) use ($user) {
            $q->where('users.id', $user->id);
        });

        $markets = $this->applyFeaturedOrdering(Market::query())
            ->whereIn('id', $owned->pluck('id')->merge($staff->pluck('id'))->unique())
            ->with('owner:id,name,email')
            ->withCount(['items as active_items_count' => function ($query) {
                $query->where('is_active', true);
            }])
            ->with(['promoCodes' => function ($query) {
                $query
                    ->activeApplicable()
                    ->latest()
                    ->limit(1);
            }])
            ->orderBy('name')
            ->get();

        return $this->serializeMarkets($markets);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'code' => ['required', 'string', 'max:50', 'unique:markets,code'],
            'owner_user_id' => ['required', 'exists:users,id'],
            'address' => ['nullable', 'string', 'max:255'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'is_active' => ['nullable', 'boolean'],
            'is_featured' => ['nullable', 'boolean'],
            'featured_badge' => ['nullable', 'string', 'max:40'],
            'featured_headline' => ['nullable', 'string', 'max:120'],
            'featured_copy' => ['nullable', 'string', 'max:255'],
            'delivery_slots' => ['nullable', 'array'],
        ]);

        $market = Market::create([
            'name' => $data['name'],
            'code' => $data['code'],
            'owner_user_id' => $data['owner_user_id'],
            'address' => $data['address'] ?? null,
            'lat' => $data['lat'] ?? null,
            'lng' => $data['lng'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'delivery_slots' => $data['delivery_slots'] ?? [],
            ...$this->featuredAttributes($data),
        ]);

        // owner role
        $owner = User::find($data['owner_user_id']);
        if ($owner && !$owner->hasRole('owner')) {
            $owner->assignRole('owner');
        }

        return response()->json($this->serializeMarket($market->load('owner:id,name,email')), 201);
    }

    public function update(Request $request, Market $market)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['sometimes', 'string', 'max:50', 'unique:markets,code,' . $market->id],
            'address' => ['nullable', 'string', 'max:255'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'featured_badge' => ['nullable', 'string', 'max:40'],
            'featured_headline' => ['nullable', 'string', 'max:120'],
            'featured_copy' => ['nullable', 'string', 'max:255'],
            'delivery_slots' => ['nullable', 'array'],
        ]);

        $market->update([
            ...collect($data)->except(['is_featured', 'featured_badge', 'featured_headline', 'featured_copy'])->all(),
            ...$this->featuredAttributes($data),
        ]);
        return $this->serializeMarket(
            $market
                ->load([
                    'owner:id,name,email',
                    'promoCodes' => function ($query) {
                        $query
                            ->activeApplicable()
                            ->latest()
                            ->limit(1);
                    },
                ])
                ->loadCount(['items as active_items_count' => function ($query) {
                    $query->where('is_active', true);
                }])
        );
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

        return $this->serializeMarket($market->load('owner:id,name,email'));
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

    protected function serializeMarkets(Collection $markets)
    {
        return $markets->map(fn (Market $market) => $this->serializeMarket($market));
    }

    protected function serializeMarket(Market $market): array
    {
        $activePromo = $market->promoCodes
            ? $market->promoCodes->first()
            : $market->promoCodes()->activeApplicable()->latest()->first();

        return [
            'id' => $market->id,
            'name' => $market->name,
            'code' => $market->code,
            'address' => $market->address,
            'lat' => $market->lat !== null ? (float) $market->lat : null,
            'lng' => $market->lng !== null ? (float) $market->lng : null,
            'is_active' => (bool) $market->is_active,
            'is_featured' => Market::hasFeaturedColumns() ? (bool) $market->is_featured : false,
            'featured_badge' => Market::hasFeaturedColumns() ? $market->featured_badge : null,
            'featured_headline' => Market::hasFeaturedColumns() ? $market->featured_headline : null,
            'featured_copy' => Market::hasFeaturedColumns() ? $market->featured_copy : null,
            'owner_user_id' => $market->owner_user_id,
            'owner' => $market->owner,
            'logo_path' => $market->logo_path,
            'logo_url' => $market->logo_url,
            'delivery_slots' => $market->delivery_slots ?? [],
            'approval_status' => $market->approval_status ?? 'approved',
            'active_items_count' => (int) ($market->active_items_count ?? 0),
            'active_promo' => $activePromo ? [
                'id' => $activePromo->id,
                'code' => $activePromo->code,
                'type' => $activePromo->type,
                'value' => $activePromo->value,
                'is_active' => (bool) $activePromo->is_active,
            ] : null,
        ];
    }
}
