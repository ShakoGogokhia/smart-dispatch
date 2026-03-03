<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use App\Models\Market;

class EnsureMarketAccess
{
    public function handle(Request $request, Closure $next)
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        if ($user->hasRole('admin')) {
            return $next($request);
        }

        $marketParam = $request->route('market');
        $marketId = is_object($marketParam) ? $marketParam->id : $marketParam;

        $market = Market::find($marketId);
        if (!$market) {
            return response()->json(['message' => 'Market not found'], 404);
        }

        $isOwner = (int)$market->owner_user_id === (int)$user->id;
        $isStaff = $market->users()->where('users.id', $user->id)->exists();

        if (!$isOwner && !$isStaff) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return $next($request);
    }
}