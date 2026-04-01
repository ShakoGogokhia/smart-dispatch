<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Market;
use App\Models\Order;
use App\Models\PromoCode;
use App\Models\WorkflowApproval;
use App\Services\AppNotificationService;
use Illuminate\Http\Request;

class WorkflowApprovalController extends Controller
{
    public function __construct(private AppNotificationService $notifications)
    {
    }

    public function index(Request $request)
    {
        $query = WorkflowApproval::query()
            ->with([
                'requester:id,name,email',
                'reviewer:id,name,email',
                'market:id,name,code',
                'order:id,code',
                'promoCode:id,code,market_id',
            ])
            ->latest();

        if (!$request->user()->hasRole('admin')) {
            $query->where('requested_by', $request->user()->id);
        }

        return $query->get()->map(fn (WorkflowApproval $approval) => $this->serialize($approval))->values();
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'type' => ['required', 'string', 'in:market_creation,promo,badge,refund'],
            'market_id' => ['nullable', 'exists:markets,id'],
            'order_id' => ['nullable', 'exists:orders,id'],
            'promo_code_id' => ['nullable', 'exists:promo_codes,id'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'payload' => ['nullable', 'array'],
        ]);

        $approval = WorkflowApproval::create([
            'type' => $data['type'],
            'requested_by' => $request->user()->id,
            'market_id' => $data['market_id'] ?? null,
            'order_id' => $data['order_id'] ?? null,
            'promo_code_id' => $data['promo_code_id'] ?? null,
            'notes' => $data['notes'] ?? null,
            'payload' => $data['payload'] ?? null,
            'status' => 'pending',
        ]);

        $this->notifications->notifyAdmins(
            'approval.created',
            'New approval request',
            ucfirst(str_replace('_', ' ', $approval->type)) . ' request submitted.',
            ['approval_id' => $approval->id, 'type' => $approval->type],
        );

        return response()->json($this->serialize($approval->fresh(['requester:id,name,email', 'market:id,name,code', 'order:id,code', 'promoCode:id,code,market_id'])), 201);
    }

    public function review(Request $request, WorkflowApproval $workflowApproval)
    {
        abort_unless($request->user()->hasRole('admin'), 403);

        $data = $request->validate([
            'status' => ['required', 'string', 'in:approved,rejected'],
            'notes' => ['nullable', 'string', 'max:1000'],
        ]);

        $workflowApproval->update([
            'status' => $data['status'],
            'notes' => $data['notes'] ?? $workflowApproval->notes,
            'reviewed_by' => $request->user()->id,
            'reviewed_at' => now(),
        ]);

        if ($workflowApproval->type === 'refund' && $workflowApproval->order_id) {
            Order::whereKey($workflowApproval->order_id)->update([
                'refund_status' => $data['status'],
            ]);
        }

        if ($workflowApproval->type === 'market_creation' && $workflowApproval->market_id) {
            Market::whereKey($workflowApproval->market_id)->update([
                'approval_status' => $data['status'],
                'is_active' => $data['status'] === 'approved',
            ]);
        }

        if ($workflowApproval->type === 'promo' && $workflowApproval->promo_code_id) {
            PromoCode::whereKey($workflowApproval->promo_code_id)->update([
                'is_active' => $data['status'] === 'approved',
            ]);
        }

        $this->notifications->sendToUser(
            $workflowApproval->requested_by,
            'approval.reviewed',
            'Approval request updated',
            'Your ' . str_replace('_', ' ', $workflowApproval->type) . ' request was ' . $data['status'] . '.',
            ['approval_id' => $workflowApproval->id, 'status' => $data['status']],
        );

        return response()->json($this->serialize($workflowApproval->fresh([
            'requester:id,name,email',
            'reviewer:id,name,email',
            'market:id,name,code',
            'order:id,code',
            'promoCode:id,code,market_id',
        ])));
    }

    public function createForType(
        string $type,
        int $requestedBy,
        ?int $marketId = null,
        ?int $orderId = null,
        ?int $promoCodeId = null,
        ?array $payload = null,
        ?string $notes = null,
    ): WorkflowApproval {
        $approval = WorkflowApproval::create([
            'type' => $type,
            'requested_by' => $requestedBy,
            'market_id' => $marketId,
            'order_id' => $orderId,
            'promo_code_id' => $promoCodeId,
            'payload' => $payload,
            'notes' => $notes,
            'status' => 'pending',
        ]);

        $this->notifications->notifyAdmins(
            'approval.created',
            'New approval request',
            ucfirst(str_replace('_', ' ', $type)) . ' request submitted.',
            ['approval_id' => $approval->id, 'type' => $type],
        );

        return $approval;
    }

    private function serialize(WorkflowApproval $approval): array
    {
        return [
            'id' => $approval->id,
            'type' => $approval->type,
            'status' => $approval->status,
            'notes' => $approval->notes,
            'payload' => $approval->payload,
            'reviewed_at' => $approval->reviewed_at?->toDateTimeString(),
            'created_at' => $approval->created_at?->toDateTimeString(),
            'requester' => $approval->requester ? [
                'id' => $approval->requester->id,
                'name' => $approval->requester->name,
                'email' => $approval->requester->email,
            ] : null,
            'reviewer' => $approval->reviewer ? [
                'id' => $approval->reviewer->id,
                'name' => $approval->reviewer->name,
                'email' => $approval->reviewer->email,
            ] : null,
            'market' => $approval->market ? [
                'id' => $approval->market->id,
                'name' => $approval->market->name,
                'code' => $approval->market->code,
            ] : null,
            'order' => $approval->order ? [
                'id' => $approval->order->id,
                'code' => $approval->order->code,
            ] : null,
            'promo_code' => $approval->promoCode ? [
                'id' => $approval->promoCode->id,
                'code' => $approval->promoCode->code,
                'market_id' => $approval->promoCode->market_id,
            ] : null,
        ];
    }
}
