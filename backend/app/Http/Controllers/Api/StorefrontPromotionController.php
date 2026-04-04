<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Market;
use App\Models\StorefrontPromotionPurchase;
use Illuminate\Http\Request;

class StorefrontPromotionController extends Controller
{
    private const PLANS = [
        'week' => ['days' => 7, 'price_label' => '$120 / 7 days', 'custom_price_label' => '$220 / 7 days'],
        'month' => ['days' => 30, 'price_label' => '$360 / 30 days', 'custom_price_label' => '$640 / 30 days'],
        'year' => ['days' => 365, 'price_label' => '$2400 / 365 days', 'custom_price_label' => '$4200 / 365 days'],
    ];

    private const MARKET_TEMPLATES = [
        'vip_market' => [
            'badge' => 'VIP Market',
            'headline' => 'Premium storefront now featured',
            'copy' => 'This storefront is running a premium featured placement across the marketplace.',
            'theme' => ['tone' => 'amber', 'shape' => 'pill'],
        ],
        'staff_pick' => [
            'badge' => 'Staff Pick',
            'headline' => 'Picked for quality and consistency',
            'copy' => 'Highlighted by the team for strong service, presentation, and customer experience.',
            'theme' => ['tone' => 'violet', 'shape' => 'soft'],
        ],
        'fast_delivery' => [
            'badge' => 'Fast Delivery',
            'headline' => 'Featured for quick fulfillment',
            'copy' => 'Promoted for reliable ordering, faster turnaround, and smooth delivery flow.',
            'theme' => ['tone' => 'cyan', 'shape' => 'pill'],
        ],
    ];

    public function index(Request $request, Market $market)
    {
        $this->assertOwnerOrAdmin($request, $market);

        return StorefrontPromotionPurchase::query()
            ->with([
                'market:id,name,code',
                'item:id,market_id,name,sku',
                'requester:id,name,email',
            ])
            ->where('market_id', $market->id)
            ->latest()
            ->get()
            ->map(fn (StorefrontPromotionPurchase $purchase) => $this->serialize($purchase))
            ->values();
    }

    public function store(Request $request, Market $market)
    {
        $this->assertOwnerOrAdmin($request, $market);

        $data = $request->validate([
            'target_type' => ['required', 'string', 'in:market,item'],
            'item_id' => ['nullable', 'integer', 'exists:items,id'],
            'plan_key' => ['required', 'string', 'in:week,month,year'],
            'template_key' => ['nullable', 'string', 'in:vip_market,staff_pick,fast_delivery'],
            'is_custom_sponsor' => ['nullable', 'boolean'],
            'badge' => ['nullable', 'string', 'max:40'],
            'headline' => ['nullable', 'string', 'max:120'],
            'copy' => ['nullable', 'string', 'max:255'],
            'theme' => ['nullable', 'array'],
            'theme.tone' => ['nullable', 'string', 'in:amber,cyan,emerald,rose,slate'],
            'theme.shape' => ['nullable', 'string', 'in:pill,soft,outline'],
        ]);

        $plan = self::PLANS[$data['plan_key']];
        $startsAt = now();
        $endsAt = now()->copy()->addDays($plan['days']);

        $item = null;
        if ($data['target_type'] === 'item') {
            $item = Item::query()
                ->where('market_id', $market->id)
                ->findOrFail($data['item_id'] ?? 0);
        }

        $isCustomSponsor = (bool) ($data['is_custom_sponsor'] ?? false);
        $templateKey = $data['template_key'] ?? null;
        $template = $templateKey ? (self::MARKET_TEMPLATES[$templateKey] ?? null) : null;

        $badge = trim((string) ($data['badge'] ?? ''));
        $headline = trim((string) ($data['headline'] ?? ''));
        $copy = trim((string) ($data['copy'] ?? ''));
        $theme = $data['theme'] ?? null;

        if ($data['target_type'] === 'market' && !$isCustomSponsor) {
            abort_unless($template !== null, 422, 'Select a standard storefront promotion template.');
            $badge = $template['badge'];
            $headline = $template['headline'];
            $copy = $template['copy'];
            $theme = $template['theme'];
        }

        $priceLabel = $isCustomSponsor ? $plan['custom_price_label'] : $plan['price_label'];

        $purchase = StorefrontPromotionPurchase::create([
            'market_id' => $market->id,
            'item_id' => $item?->id,
            'requested_by' => $request->user()->id,
            'target_type' => $data['target_type'],
            'plan_key' => $data['plan_key'],
            'price_label' => $priceLabel,
            'badge' => $badge !== '' ? $badge : null,
            'headline' => $headline !== '' ? $headline : null,
            'copy' => $copy !== '' ? $copy : null,
            'duration_days' => $plan['days'],
            'starts_at' => $startsAt,
            'ends_at' => $endsAt,
            'status' => 'active',
            'payload' => [
                'target_name' => $data['target_type'] === 'market' ? $market->name : $item?->name,
                'template_key' => $templateKey,
                'is_custom_sponsor' => $isCustomSponsor,
                'theme' => $theme,
            ],
        ]);

        if ($data['target_type'] === 'market') {
            $market->update([
                'is_featured' => true,
                'featured_badge' => $badge !== '' ? $badge : ($market->featured_badge ?: 'Promoted Market'),
                'featured_headline' => $headline !== '' ? $headline : ($market->featured_headline ?: "Featured {$market->name}"),
                'featured_copy' => $copy !== '' ? $copy : ($market->featured_copy ?: 'This storefront is currently running a featured promotion.'),
                'featured_theme' => $theme,
                'promotion_starts_at' => $startsAt,
                'promotion_ends_at' => $endsAt,
            ]);
        }

        if ($data['target_type'] === 'item' && $item) {
            $item->update([
                'is_promoted' => true,
                'promotion_starts_at' => $startsAt,
                'promotion_ends_at' => $endsAt,
            ]);
        }

        return response()->json(
            $this->serialize($purchase->fresh(['market:id,name,code', 'item:id,market_id,name,sku', 'requester:id,name,email'])),
            201
        );
    }

    private function assertOwnerOrAdmin(Request $request, Market $market): void
    {
        $user = $request->user();

        abort_unless(
            $user->hasRole('admin') || (int) $market->owner_user_id === (int) $user->id,
            403,
            'Only the market owner or admin can purchase storefront promotion.',
        );
    }

    private function serialize(StorefrontPromotionPurchase $purchase): array
    {
        return [
            'id' => $purchase->id,
            'target_type' => $purchase->target_type,
            'plan_key' => $purchase->plan_key,
            'price_label' => $purchase->price_label,
            'badge' => $purchase->badge,
            'headline' => $purchase->headline,
            'copy' => $purchase->copy,
            'duration_days' => $purchase->duration_days,
            'starts_at' => $purchase->starts_at?->toDateTimeString(),
            'ends_at' => $purchase->ends_at?->toDateTimeString(),
            'status' => $purchase->status,
            'market' => $purchase->market ? [
                'id' => $purchase->market->id,
                'name' => $purchase->market->name,
                'code' => $purchase->market->code,
            ] : null,
            'item' => $purchase->item ? [
                'id' => $purchase->item->id,
                'name' => $purchase->item->name,
                'sku' => $purchase->item->sku,
            ] : null,
            'requester' => $purchase->requester ? [
                'id' => $purchase->requester->id,
                'name' => $purchase->requester->name,
                'email' => $purchase->requester->email,
            ] : null,
        ];
    }
}
