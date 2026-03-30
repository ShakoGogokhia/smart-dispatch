<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MarketBanner;
use Illuminate\Http\Request;

class MarketBannerController extends Controller
{
    public function index()
    {
        return MarketBanner::query()
            ->with('market:id,name,code')
            ->orderBy('sort_order')
            ->latest('id')
            ->get()
            ->map(fn (MarketBanner $banner) => $this->serialize($banner))
            ->values();
    }

    public function publicIndex()
    {
        return MarketBanner::query()
            ->with('market:id,name,code')
            ->orderBy('sort_order')
            ->get()
            ->filter(fn (MarketBanner $banner) => $banner->isLive())
            ->map(fn (MarketBanner $banner) => $this->serialize($banner))
            ->values();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'title' => ['required', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'cta_label' => ['nullable', 'string', 'max:60'],
            'cta_url' => ['nullable', 'string', 'max:255'],
            'theme' => ['nullable', 'string', 'max:30'],
            'is_active' => ['nullable', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'market_id' => ['nullable', 'exists:markets,id'],
        ]);

        $banner = MarketBanner::create([
            'title' => $data['title'],
            'subtitle' => $data['subtitle'] ?? null,
            'cta_label' => $data['cta_label'] ?? null,
            'cta_url' => $data['cta_url'] ?? null,
            'theme' => $data['theme'] ?? 'cyan',
            'is_active' => $data['is_active'] ?? true,
            'sort_order' => $data['sort_order'] ?? 0,
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
            'market_id' => $data['market_id'] ?? null,
        ]);

        return response()->json($this->serialize($banner->load('market:id,name,code')), 201);
    }

    public function update(Request $request, MarketBanner $banner)
    {
        $data = $request->validate([
            'title' => ['sometimes', 'string', 'max:120'],
            'subtitle' => ['nullable', 'string', 'max:255'],
            'cta_label' => ['nullable', 'string', 'max:60'],
            'cta_url' => ['nullable', 'string', 'max:255'],
            'theme' => ['nullable', 'string', 'max:30'],
            'is_active' => ['sometimes', 'boolean'],
            'sort_order' => ['nullable', 'integer', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'market_id' => ['nullable', 'exists:markets,id'],
        ]);

        $banner->update($data);

        return response()->json($this->serialize($banner->load('market:id,name,code')));
    }

    protected function serialize(MarketBanner $banner): array
    {
        return [
            'id' => $banner->id,
            'title' => $banner->title,
            'subtitle' => $banner->subtitle,
            'cta_label' => $banner->cta_label,
            'cta_url' => $banner->cta_url,
            'theme' => $banner->theme,
            'is_active' => (bool) $banner->is_active,
            'is_live' => $banner->isLive(),
            'sort_order' => (int) $banner->sort_order,
            'starts_at' => optional($banner->starts_at)?->toDateTimeString(),
            'ends_at' => optional($banner->ends_at)?->toDateTimeString(),
            'market' => $banner->market ? [
                'id' => $banner->market->id,
                'name' => $banner->market->name,
                'code' => $banner->market->code,
            ] : null,
        ];
    }
}
