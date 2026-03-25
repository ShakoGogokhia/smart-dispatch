<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Market;
use App\Models\MarketBadgeRequest;
use Illuminate\Http\Request;

class MarketBadgeRequestController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        $query = MarketBadgeRequest::query()
            ->with(['market:id,name,code', 'requester:id,name,email'])
            ->latest();

        if (!$user->hasRole('admin')) {
            $query->where('requested_by', $user->id);
        }

        return $query->get()->map(fn (MarketBadgeRequest $badgeRequest) => $this->serialize($badgeRequest));
    }

    public function store(Request $request, Market $market)
    {
        $data = $request->validate([
            'badge' => ['required', 'string', 'max:40'],
            'duration_days' => ['nullable', 'integer', 'min:1', 'max:90'],
            'notes' => ['nullable', 'string', 'max:255'],
        ]);

        $badgeRequest = MarketBadgeRequest::create([
            'market_id' => $market->id,
            'requested_by' => $request->user()->id,
            'badge' => $data['badge'],
            'duration_days' => $data['duration_days'] ?? 7,
            'notes' => $data['notes'] ?? null,
            'status' => 'pending',
        ]);

        return response()->json(
            $this->serialize($badgeRequest->load(['market:id,name,code', 'requester:id,name,email'])),
            201
        );
    }

    protected function serialize(MarketBadgeRequest $badgeRequest): array
    {
        return [
            'id' => $badgeRequest->id,
            'badge' => $badgeRequest->badge,
            'duration_days' => $badgeRequest->duration_days,
            'status' => $badgeRequest->status,
            'notes' => $badgeRequest->notes,
            'created_at' => $badgeRequest->created_at,
            'market' => $badgeRequest->market ? [
                'id' => $badgeRequest->market->id,
                'name' => $badgeRequest->market->name,
                'code' => $badgeRequest->market->code,
            ] : null,
            'requester' => $badgeRequest->requester ? [
                'id' => $badgeRequest->requester->id,
                'name' => $badgeRequest->requester->name,
                'email' => $badgeRequest->requester->email,
            ] : null,
        ];
    }
}
