<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use Illuminate\Http\Request;

class AuditLogController extends Controller
{
    public function index(Request $request)
    {
        abort_unless($request->user()->hasRole('admin'), 403);

        $query = AuditLog::query()->with('user:id,name,email')->latest();

        if ($request->filled('action')) {
            $query->where('action', 'like', trim((string) $request->query('action')).'%');
        }

        return response()->json($query->limit((int) $request->query('limit', 100))->get());
    }
}
