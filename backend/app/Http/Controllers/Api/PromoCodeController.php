<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Market;
use App\Models\PromoCode;

class PromoCodeController extends Controller
{
    public function indexGlobal()
    {
        return PromoCode::query()
            ->whereNull('market_id')
            ->latest()
            ->get();
    }

    public function index(Market $market)
    {
        return $market->promoCodes()->latest()->get();
    }

    public function storeGlobal(Request $request)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50'],
            'type' => ['required', 'in:percent,fixed'],
            'value' => ['required', 'numeric', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $normalizedCode = strtoupper($data['code']);

        if (PromoCode::query()->whereNull('market_id')->whereRaw('UPPER(code) = ?', [$normalizedCode])->exists()) {
            return response()->json(['message' => 'Global promo code already exists'], 422);
        }

        $promo = PromoCode::create([
            'market_id' => null,
            'code' => $normalizedCode,
            'type' => $data['type'],
            'value' => $data['value'],
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
            'max_uses' => $data['max_uses'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'uses' => 0,
        ]);

        return response()->json($promo, 201);
    }

    public function store(Request $request, Market $market)
    {
        $data = $request->validate([
            'code' => ['required', 'string', 'max:50'],
            'type' => ['required', 'in:percent,fixed'],
            'value' => ['required', 'numeric', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['nullable', 'boolean'],
        ]);

        $normalizedCode = strtoupper($data['code']);

        if ($market->promoCodes()->whereRaw('UPPER(code) = ?', [$normalizedCode])->exists()) {
            return response()->json(['message' => 'Promo code already exists for this market'], 422);
        }

        $promo = PromoCode::create([
            'market_id' => $market->id,
            'code' => $normalizedCode,
            'type' => $data['type'],
            'value' => $data['value'],
            'starts_at' => $data['starts_at'] ?? null,
            'ends_at' => $data['ends_at'] ?? null,
            'max_uses' => $data['max_uses'] ?? null,
            'is_active' => $data['is_active'] ?? true,
            'uses' => 0,
        ]);

        return response()->json($promo, 201);
    }

    public function updateGlobal(Request $request, PromoCode $promoCode)
    {
        if ($promoCode->market_id !== null) {
            return response()->json(['message' => 'Promo code does not belong to the global scope'], 400);
        }

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:50'],
            'type' => ['sometimes', 'in:percent,fixed'],
            'value' => ['sometimes', 'numeric', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['code'])) {
            $normalizedCode = strtoupper($data['code']);
            $exists = PromoCode::query()
                ->whereNull('market_id')
                ->whereKeyNot($promoCode->id)
                ->whereRaw('UPPER(code) = ?', [$normalizedCode])
                ->exists();

            if ($exists) {
                return response()->json(['message' => 'Global promo code already exists'], 422);
            }

            $data['code'] = $normalizedCode;
        }

        $promoCode->update($data);

        return $promoCode;
    }

    public function update(Request $request, Market $market, PromoCode $promoCode)
    {
        if ($promoCode->market_id !== $market->id) {
            return response()->json(['message' => 'Promo code does not belong to market'], 400);
        }

        $data = $request->validate([
            'code' => ['sometimes', 'string', 'max:50'],
            'type' => ['sometimes', 'in:percent,fixed'],
            'value' => ['sometimes', 'numeric', 'min:0'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'max_uses' => ['nullable', 'integer', 'min:1'],
            'is_active' => ['sometimes', 'boolean'],
        ]);

        if (isset($data['code'])) {
            $normalizedCode = strtoupper($data['code']);
            $exists = $market->promoCodes()
                ->whereKeyNot($promoCode->id)
                ->whereRaw('UPPER(code) = ?', [$normalizedCode])
                ->exists();

            if ($exists) {
                return response()->json(['message' => 'Promo code already exists for this market'], 422);
            }

            $data['code'] = $normalizedCode;
        }

        $promoCode->update($data);

        return $promoCode;
    }
}
