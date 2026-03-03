<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;
use App\Models\Market;
use App\Models\PromoCode;

class PromoCodeController extends Controller
{
    public function index(Market $market)
    {
        return $market->promoCodes()->latest()->get();
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

        $promo = PromoCode::create([
            'market_id' => $market->id,
            'code' => strtoupper($data['code']),
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

        if (isset($data['code']))
            $data['code'] = strtoupper($data['code']);
        $promoCode->update($data);

        return $promoCode;
    }
}