<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\SupportTicket;
use App\Models\SupportTicketMessage;
use App\Services\AuditLogService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;

class SupportTicketController extends Controller
{
    public function __construct(private AuditLogService $audit)
    {
    }

    public function index(Request $request)
    {
        $query = SupportTicket::query()
            ->with(['order:id,code,status', 'customer:id,name,email', 'assignedUser:id,name,email', 'messages.user:id,name,email'])
            ->latest();

        if (!$request->user()->hasRole('admin')) {
            $query->where(function (Builder $builder) use ($request) {
                $builder
                    ->where('customer_user_id', $request->user()->id)
                    ->orWhere('assigned_user_id', $request->user()->id);
            });
        }

        if ($request->filled('status')) {
            $query->where('status', $request->query('status'));
        }

        if ($request->filled('category')) {
            $query->where('category', $request->query('category'));
        }

        return response()->json($query->limit(80)->get()->map(fn (SupportTicket $ticket) => $this->serialize($ticket))->values());
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'order_id' => ['nullable', 'exists:orders,id'],
            'category' => ['nullable', 'string', 'in:order_issue,payment,refund,delivery,market,other'],
            'priority' => ['nullable', 'string', 'in:low,normal,high,urgent'],
            'subject' => ['required', 'string', 'max:160'],
            'description' => ['nullable', 'string', 'max:4000'],
        ]);

        if (!empty($data['order_id'])) {
            $order = Order::findOrFail($data['order_id']);
            abort_unless($request->user()->hasRole('admin') || (int) $order->customer_user_id === (int) $request->user()->id, 403);
        }

        $nextId = (int) (SupportTicket::max('id') ?? 0) + 1;
        $ticket = SupportTicket::create([
            'order_id' => $data['order_id'] ?? null,
            'customer_user_id' => $request->user()->id,
            'code' => 'SUP-' . str_pad((string) $nextId, 6, '0', STR_PAD_LEFT),
            'category' => $data['category'] ?? 'order_issue',
            'priority' => $data['priority'] ?? 'normal',
            'subject' => $data['subject'],
            'description' => $data['description'] ?? null,
        ]);

        if (!empty($data['description'])) {
            SupportTicketMessage::create([
                'support_ticket_id' => $ticket->id,
                'user_id' => $request->user()->id,
                'visibility' => 'public',
                'message' => $data['description'],
            ]);
        }

        $this->audit->record('support.ticket_created', $request, $ticket);

        return response()->json($this->serialize($ticket->fresh(['order:id,code,status', 'customer:id,name,email', 'messages.user:id,name,email'])), 201);
    }

    public function message(Request $request, SupportTicket $supportTicket)
    {
        abort_unless($this->canAccess($request, $supportTicket), 403);

        $data = $request->validate([
            'message' => ['required', 'string', 'max:4000'],
            'visibility' => ['nullable', 'string', 'in:public,internal'],
        ]);

        $visibility = $data['visibility'] ?? 'public';
        abort_if($visibility === 'internal' && !$request->user()->hasRole('admin'), 403);

        $message = SupportTicketMessage::create([
            'support_ticket_id' => $supportTicket->id,
            'user_id' => $request->user()->id,
            'visibility' => $visibility,
            'message' => $data['message'],
        ]);

        $this->audit->record('support.message_created', $request, $supportTicket, ['visibility' => $visibility]);

        return response()->json([
            'id' => $message->id,
            'visibility' => $message->visibility,
            'message' => $message->message,
            'created_at' => $message->created_at?->toDateTimeString(),
        ], 201);
    }

    public function update(Request $request, SupportTicket $supportTicket)
    {
        abort_unless($request->user()->hasRole('admin') || (int) $supportTicket->customer_user_id === (int) $request->user()->id, 403);

        $rules = [
            'status' => ['nullable', 'string', 'in:open,pending_customer,escalated,resolved,closed'],
            'priority' => ['nullable', 'string', 'in:low,normal,high,urgent'],
        ];

        if ($request->user()->hasRole('admin')) {
            $rules['assigned_user_id'] = ['nullable', 'exists:users,id'];
        }

        $data = $request->validate($rules);

        if (($data['status'] ?? null) === 'resolved') {
            $data['resolved_at'] = now();
        }

        $supportTicket->update($data);
        $this->audit->record('support.ticket_updated', $request, $supportTicket, $data);

        return response()->json($this->serialize($supportTicket->fresh(['order:id,code,status', 'customer:id,name,email', 'assignedUser:id,name,email', 'messages.user:id,name,email'])));
    }

    private function canAccess(Request $request, SupportTicket $ticket): bool
    {
        return $request->user()->hasRole('admin')
            || (int) $ticket->customer_user_id === (int) $request->user()->id
            || (int) $ticket->assigned_user_id === (int) $request->user()->id;
    }

    private function serialize(SupportTicket $ticket): array
    {
        return [
            'id' => $ticket->id,
            'code' => $ticket->code,
            'category' => $ticket->category,
            'status' => $ticket->status,
            'priority' => $ticket->priority,
            'subject' => $ticket->subject,
            'description' => $ticket->description,
            'resolved_at' => $ticket->resolved_at?->toDateTimeString(),
            'created_at' => $ticket->created_at?->toDateTimeString(),
            'order' => $ticket->order,
            'customer' => $ticket->customer,
            'assigned_user' => $ticket->assignedUser,
            'messages' => $ticket->messages->map(fn (SupportTicketMessage $message) => [
                'id' => $message->id,
                'visibility' => $message->visibility,
                'message' => $message->message,
                'created_at' => $message->created_at?->toDateTimeString(),
                'user' => $message->user ? [
                    'id' => $message->user->id,
                    'name' => $message->user->name,
                    'email' => $message->user->email,
                ] : null,
            ])->values(),
        ];
    }
}
