<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Market;
use App\Models\MarketBadgeAudit;
use App\Models\User;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MarketController extends Controller
{
    protected function locationAttributes(array $data): array
    {
        if (!Market::hasCoordinateColumns()) {
            return [];
        }

        return [
            'lat' => $data['lat'] ?? null,
            'lng' => $data['lng'] ?? null,
        ];
    }

    protected function applyFeaturedOrdering($query)
    {
        if (Market::hasFeaturedColumns()) {
            $query
                ->orderByDesc('is_featured')
                ->orderBy('featured_sort_order')
                ->orderBy('name');
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
            'badge_expires_at' => $data['badge_expires_at'] ?? null,
            'featured_starts_at' => $data['featured_starts_at'] ?? null,
            'featured_ends_at' => $data['featured_ends_at'] ?? null,
            'featured_sort_order' => $data['featured_sort_order'] ?? 0,
        ];
    }

    protected function commercialAttributes(array $data): array
    {
        return [
            'category' => $data['category'] ?? null,
            'minimum_order' => $data['minimum_order'] ?? 0,
            'delivery_eta_minutes' => $data['delivery_eta_minutes'] ?? null,
            'opens_at' => $data['opens_at'] ?? null,
            'closes_at' => $data['closes_at'] ?? null,
        ];
    }

    protected function baseMarketQuery()
    {
        return $this->applyFeaturedOrdering(
            Market::with('owner:id,name,email')
                ->withCount([
                    'items as active_items_count' => function ($query) {
                        $query->where('is_active', true);
                    },
                    'orders as rating_count' => function ($query) {
                        $query->whereNotNull('customer_rating');
                    },
                    'publicClicks as public_clicks_count',
                ])
                ->withAvg([
                    'orders as average_rating' => function ($query) {
                        $query->whereNotNull('customer_rating');
                    },
                ], 'customer_rating')
                ->with([
                    'promoCodes' => function ($query) {
                        $query
                            ->activeApplicable()
                            ->latest()
                            ->limit(1);
                    },
                ])
        );
    }

    public function index(Request $request)
    {
        return $this->serializeMarkets(
            $this->baseMarketQuery()
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

        $staff = Market::whereHas('users', function ($query) use ($user) {
            $query->where('users.id', $user->id);
        });

        $markets = $this->baseMarketQuery()
            ->whereIn('id', $owned->pluck('id')->merge($staff->pluck('id'))->unique())
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
            'category' => ['nullable', 'string', 'max:80'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'is_active' => ['nullable', 'boolean'],
            'is_featured' => ['nullable', 'boolean'],
            'featured_badge' => ['nullable', 'string', 'max:40'],
            'featured_headline' => ['nullable', 'string', 'max:120'],
            'featured_copy' => ['nullable', 'string', 'max:255'],
            'minimum_order' => ['nullable', 'numeric', 'min:0'],
            'delivery_eta_minutes' => ['nullable', 'integer', 'min:1', 'max:720'],
            'featured_sort_order' => ['nullable', 'integer', 'min:0'],
            'badge_expires_at' => ['nullable', 'date'],
            'featured_starts_at' => ['nullable', 'date'],
            'featured_ends_at' => ['nullable', 'date', 'after_or_equal:featured_starts_at'],
            'opens_at' => ['nullable', 'date_format:H:i'],
            'closes_at' => ['nullable', 'date_format:H:i'],
        ]);

        $market = Market::create([
            'name' => $data['name'],
            'code' => $data['code'],
            'owner_user_id' => $data['owner_user_id'],
            'address' => $data['address'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            ...$this->locationAttributes($data),
            ...$this->commercialAttributes($data),
            ...$this->featuredAttributes($data),
        ]);

        $owner = User::find($data['owner_user_id']);
        if ($owner && !$owner->hasRole('owner')) {
            $owner->assignRole('owner');
        }

        $this->recordBadgeAudit($market, $request->user()?->id, 'created', null, $market->featured_badge, null, $market->badge_expires_at);

        return response()->json(
            $this->serializeMarket(
                $market
                    ->load('owner:id,name,email')
                    ->loadCount([
                        'items as active_items_count' => function ($query) {
                            $query->where('is_active', true);
                        },
                        'orders as rating_count' => function ($query) {
                            $query->whereNotNull('customer_rating');
                        },
                        'publicClicks as public_clicks_count',
                    ])
            ),
            201
        );
    }

    public function update(Request $request, Market $market)
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'code' => ['sometimes', 'string', 'max:50', 'unique:markets,code,' . $market->id],
            'address' => ['nullable', 'string', 'max:255'],
            'category' => ['nullable', 'string', 'max:80'],
            'lat' => ['nullable', 'numeric', 'between:-90,90'],
            'lng' => ['nullable', 'numeric', 'between:-180,180'],
            'is_active' => ['sometimes', 'boolean'],
            'is_featured' => ['sometimes', 'boolean'],
            'featured_badge' => ['nullable', 'string', 'max:40'],
            'featured_headline' => ['nullable', 'string', 'max:120'],
            'featured_copy' => ['nullable', 'string', 'max:255'],
            'minimum_order' => ['nullable', 'numeric', 'min:0'],
            'delivery_eta_minutes' => ['nullable', 'integer', 'min:1', 'max:720'],
            'featured_sort_order' => ['nullable', 'integer', 'min:0'],
            'badge_expires_at' => ['nullable', 'date'],
            'featured_starts_at' => ['nullable', 'date'],
            'featured_ends_at' => ['nullable', 'date', 'after_or_equal:featured_starts_at'],
            'opens_at' => ['nullable', 'date_format:H:i'],
            'closes_at' => ['nullable', 'date_format:H:i'],
        ]);

        $previousBadge = $market->featured_badge;
        $previousExpiry = $market->badge_expires_at;

        $market->update([
            ...collect($data)->except([
                'lat',
                'lng',
                'is_featured',
                'featured_badge',
                'featured_headline',
                'featured_copy',
                'badge_expires_at',
                'featured_starts_at',
                'featured_ends_at',
                'featured_sort_order',
                'minimum_order',
                'delivery_eta_minutes',
                'opens_at',
                'closes_at',
            ])->all(),
            ...$this->locationAttributes($data),
            ...$this->commercialAttributes($data),
            ...$this->featuredAttributes($data),
        ]);

        if ($previousBadge !== $market->featured_badge || optional($previousExpiry)->toDateTimeString() !== optional($market->badge_expires_at)->toDateTimeString()) {
            $this->recordBadgeAudit(
                $market,
                $request->user()?->id,
                'updated',
                $previousBadge,
                $market->featured_badge,
                $previousExpiry,
                $market->badge_expires_at
            );
        }

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
                ->loadCount([
                    'items as active_items_count' => function ($query) {
                        $query->where('is_active', true);
                    },
                    'orders as rating_count' => function ($query) {
                        $query->whereNotNull('customer_rating');
                    },
                    'publicClicks as public_clicks_count',
                ])
                ->loadAvg([
                    'orders as average_rating' => function ($query) {
                        $query->whereNotNull('customer_rating');
                    },
                ], 'customer_rating')
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

    public function uploadCover(Request $request, Market $market)
    {
        $request->validate([
            'cover' => ['required', 'image', 'max:4096'],
        ]);

        $path = $request->file('cover')->store('market-covers', 'public');

        if ($market->cover_path) {
            Storage::disk('public')->delete($market->cover_path);
        }

        $market->update(['cover_path' => $path]);

        return response()->json([
            'id' => $market->id,
            'cover_url' => Storage::disk('public')->url($path),
            'cover_path' => $path,
        ]);
    }

    public function reorderFeatured(Request $request)
    {
        $data = $request->validate([
            'market_ids' => ['required', 'array', 'min:1'],
            'market_ids.*' => ['integer', 'exists:markets,id'],
        ]);

        foreach (array_values($data['market_ids']) as $index => $marketId) {
            Market::whereKey($marketId)->update(['featured_sort_order' => $index + 1]);
        }

        return response()->json(['message' => 'Featured order updated']);
    }

    public function staff(Market $market)
    {
        return $market->users()->select('users.id', 'users.name', 'users.email')
            ->withPivot('role')
            ->get();
    }

    public function addStaff(Request $request, Market $market)
    {
        $data = $request->validate([
            'user_id' => ['required', 'exists:users,id'],
            'role' => ['nullable', 'in:staff,owner'],
        ]);

        $market->users()->syncWithoutDetaching([
            (int) $data['user_id'] => ['role' => $data['role'] ?? 'staff'],
        ]);

        return response()->json(['message' => 'Staff added']);
    }

    public function removeStaff(Request $request, Market $market, $userId)
    {
        if ((int) $market->owner_user_id === (int) $userId) {
            return response()->json(['message' => 'Cannot remove market owner'], 422);
        }

        $market->users()->detach((int) $userId);

        return response()->json(['message' => 'Staff removed']);
    }

    public function badgeAudits(Market $market)
    {
        return $market->badgeAudits()
            ->with('user:id,name,email')
            ->latest()
            ->get()
            ->map(function (MarketBadgeAudit $audit) {
                return [
                    'id' => $audit->id,
                    'action' => $audit->action,
                    'previous_badge' => $audit->previous_badge,
                    'next_badge' => $audit->next_badge,
                    'previous_badge_expires_at' => optional($audit->previous_badge_expires_at)?->toDateTimeString(),
                    'next_badge_expires_at' => optional($audit->next_badge_expires_at)?->toDateTimeString(),
                    'created_at' => optional($audit->created_at)?->toDateTimeString(),
                    'user' => $audit->user ? [
                        'id' => $audit->user->id,
                        'name' => $audit->user->name,
                        'email' => $audit->user->email,
                    ] : null,
                ];
            })
            ->values();
    }

    protected function recordBadgeAudit(
        Market $market,
        ?int $userId,
        string $action,
        ?string $previousBadge,
        ?string $nextBadge,
        $previousExpiry,
        $nextExpiry
    ): void {
        if ($previousBadge === $nextBadge && optional($previousExpiry)->toDateTimeString() === optional($nextExpiry)->toDateTimeString()) {
            return;
        }

        MarketBadgeAudit::create([
            'market_id' => $market->id,
            'user_id' => $userId,
            'action' => $action,
            'previous_badge' => $previousBadge,
            'next_badge' => $nextBadge,
            'previous_badge_expires_at' => $previousExpiry,
            'next_badge_expires_at' => $nextExpiry,
        ]);
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
            'category' => $market->category,
            'lat' => Market::hasCoordinateColumns() && $market->lat !== null ? (float) $market->lat : null,
            'lng' => Market::hasCoordinateColumns() && $market->lng !== null ? (float) $market->lng : null,
            'is_active' => (bool) $market->is_active,
            'is_open_now' => $market->is_open_now,
            'opens_at' => $market->opens_at,
            'closes_at' => $market->closes_at,
            'is_featured' => Market::hasFeaturedColumns() ? (bool) $market->is_featured : false,
            'is_currently_featured' => Market::hasFeaturedColumns() ? $market->isFeatureLive() : false,
            'featured_badge' => Market::hasFeaturedColumns() ? $market->featured_badge : null,
            'featured_headline' => Market::hasFeaturedColumns() ? $market->featured_headline : null,
            'featured_copy' => Market::hasFeaturedColumns() ? $market->featured_copy : null,
            'badge_expires_at' => optional($market->badge_expires_at)?->toDateTimeString(),
            'badge_is_active' => $market->hasActiveBadge(),
            'featured_starts_at' => optional($market->featured_starts_at)?->toDateTimeString(),
            'featured_ends_at' => optional($market->featured_ends_at)?->toDateTimeString(),
            'featured_sort_order' => (int) ($market->featured_sort_order ?? 0),
            'owner_user_id' => $market->owner_user_id,
            'owner' => $market->owner,
            'logo_path' => $market->logo_path,
            'logo_url' => $market->logo_url,
            'cover_path' => $market->cover_path,
            'cover_url' => $market->cover_url,
            'minimum_order' => (float) ($market->minimum_order ?? 0),
            'delivery_eta_minutes' => $market->delivery_eta_minutes ? (int) $market->delivery_eta_minutes : null,
            'active_items_count' => (int) ($market->active_items_count ?? 0),
            'average_rating' => $market->average_rating !== null ? round((float) $market->average_rating, 2) : null,
            'rating_count' => (int) ($market->rating_count ?? 0),
            'public_clicks_count' => (int) ($market->public_clicks_count ?? 0),
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
