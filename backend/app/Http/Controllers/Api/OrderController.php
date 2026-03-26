<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Market;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\OrderItem;
use App\Models\PromoCode;
use App\Services\OrderDispatchService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class OrderController extends Controller
{
    public function __construct(private OrderDispatchService $dispatchService)
    {
    }

    public function index(Request $request)
    {
        $user = $request->user();
        $query = Order::query()
            ->with([
                'market:id,name,code,address,lat,lng',
                'customer:id,name,email',
                'assignedDriver.user:id,name,email',
                'assignedDriver.latestPing',
                'offeredDriver.user:id,name,email',
                'items',
            ])
            ->latest();

        if ($request->filled('status')) {
            $query->where('status', $request->string('status'));
        }

        if ($request->filled('market_id')) {
            $query->where('market_id', $request->integer('market_id'));
        }

        if ($user->hasRole('admin')) {
            return response()->json($this->decoratePaginator($query->paginate(20)));
        }

        if ($user->hasRole('driver') && $user->driver) {
            $query->where(function (Builder $driverQuery) use ($user) {
                $driverQuery
                    ->where('assigned_driver_id', $user->driver->id)
                    ->orWhere('offered_driver_id', $user->driver->id);
            });

            return response()->json($this->decoratePaginator($query->paginate(20)));
        }

        if ($user->hasAnyRole(['owner', 'staff'])) {
            $marketIds = Market::query()
                ->where('owner_user_id', $user->id)
                ->orWhereHas('users', fn (Builder $builder) => $builder->where('users.id', $user->id))
                ->pluck('id');

            $query->whereIn('market_id', $marketIds);

            return response()->json($this->decoratePaginator($query->paginate(20)));
        }

        $query->where('customer_user_id', $user->id);

        return response()->json($this->decoratePaginator($query->paginate(20)));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'market_id' => ['nullable', 'exists:markets,id'],
            'dropoff_lat' => ['required', 'numeric'],
            'dropoff_lng' => ['required', 'numeric'],
            'pickup_lat' => ['nullable', 'numeric'],
            'pickup_lng' => ['nullable', 'numeric'],
            'pickup_address' => ['nullable', 'string', 'max:255'],
            'dropoff_address' => ['nullable', 'string', 'max:255'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'promo_code' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'weather_condition' => ['nullable', 'string', 'in:clear,rain,snow,storm,fog'],
            'time_window_start' => ['nullable', 'date'],
            'time_window_end' => ['nullable', 'date'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:5'],
            'size' => ['nullable', 'numeric', 'min:0'],
            'items' => ['nullable', 'array'],
            'items.*.item_id' => ['nullable', 'exists:items,id'],
            'items.*.name' => ['nullable', 'string', 'max:255'],
            'items.*.sku' => ['nullable', 'string', 'max:255'],
            'items.*.qty' => ['required_with:items', 'integer', 'min:1'],
            'items.*.price' => ['required_with:items', 'numeric', 'min:0'],
        ]);

        $market = !empty($data['market_id']) ? Market::findOrFail($data['market_id']) : null;

        $itemsPayload = collect($data['items'] ?? [])->map(function (array $item) {
            if (!empty($item['item_id'])) {
                $dbItem = Item::find($item['item_id']);
                if ($dbItem) {
                    return [
                        'item_id' => $dbItem->id,
                        'name' => $dbItem->name,
                        'sku' => $dbItem->sku,
                        'qty' => (int) $item['qty'],
                        'unit_price' => (float) $item['price'],
                        'line_total' => (float) $item['price'] * (int) $item['qty'],
                    ];
                }
            }

            return [
                'item_id' => $item['item_id'] ?? null,
                'name' => $item['name'] ?? 'Item',
                'sku' => $item['sku'] ?? null,
                'qty' => (int) $item['qty'],
                'unit_price' => (float) $item['price'],
                'line_total' => (float) $item['price'] * (int) $item['qty'],
            ];
        });

        $subtotal = (float) $itemsPayload->sum('line_total');
        $promo = $market && !empty($data['promo_code']) ? $this->resolvePromoCode($market, $data['promo_code']) : null;

        if ($market && !empty($data['promo_code']) && !$promo) {
            return response()->json(['message' => 'Promo code is invalid for this market'], 422);
        }

        $discountTotal = $promo ? $this->calculateDiscount($promo, $subtotal) : 0.0;
        $total = max(0, $subtotal - $discountTotal);
        $nextId = (int) (Order::max('id') ?? 0) + 1;

        $order = DB::transaction(function () use ($request, $data, $market, $itemsPayload, $subtotal, $discountTotal, $total, $nextId, $promo) {
            $order = Order::create([
                'market_id' => $market?->id,
                'customer_user_id' => $request->user()?->id,
                'code' => 'ORD-' . str_pad((string) $nextId, 6, '0', STR_PAD_LEFT),
                'pickup_lat' => $data['pickup_lat'] ?? $market?->lat,
                'pickup_lng' => $data['pickup_lng'] ?? $market?->lng,
                'dropoff_lat' => $data['dropoff_lat'],
                'dropoff_lng' => $data['dropoff_lng'],
                'pickup_address' => $data['pickup_address'] ?? $market?->address ?? $market?->name,
                'dropoff_address' => $data['dropoff_address'] ?? null,
                'customer_name' => $data['customer_name'] ?? $request->user()?->name,
                'customer_phone' => $data['customer_phone'] ?? null,
                'promo_code' => $data['promo_code'] ?? null,
                'notes' => $data['notes'] ?? null,
                'weather_condition' => $data['weather_condition'] ?? 'clear',
                'time_window_start' => $data['time_window_start'] ?? null,
                'time_window_end' => $data['time_window_end'] ?? null,
                'priority' => $data['priority'] ?? 2,
                'size' => $data['size'] ?? max(1, $itemsPayload->sum('qty')),
                'subtotal' => $subtotal,
                'discount_total' => $discountTotal,
                'total' => $total,
                'status' => $market ? 'MARKET_PENDING' : 'READY_FOR_PICKUP',
                'promised_at' => now()->addMinutes($market ? 75 : 45),
                'estimated_delivery_at' => now()->addMinutes($market ? 60 : 35),
            ]);

            if ($promo) {
                $promo->increment('uses');
            }

            $itemsPayload->each(function (array $item) use ($order) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'item_id' => $item['item_id'],
                    'name' => $item['name'],
                    'sku' => $item['sku'],
                    'qty' => $item['qty'],
                    'unit_price' => $item['unit_price'],
                    'line_total' => $item['line_total'],
                ]);
            });

            OrderEvent::create([
                'order_id' => $order->id,
                'type' => 'CREATED',
                'payload' => [
                    'market_id' => $market?->id,
                    'customer_name' => $order->customer_name,
                    'items_count' => $itemsPayload->count(),
                    'status' => $order->status,
                ],
            ]);

            return $order;
        });

        if (!$market) {
            $this->dispatchService->offerOrder($order);
        }

        return response()->json(
            $this->decorateOrder($order->fresh(['market', 'customer', 'assignedDriver.user', 'offeredDriver.user', 'items'])),
            201,
        );
    }

    public function show(Request $request, Order $order)
    {
        abort_unless($this->canAccessOrder($request, $order), Response::HTTP_FORBIDDEN);

        return response()->json($this->decorateOrder($order->load([
            'events',
            'items',
            'market',
            'customer',
            'assignedDriver.user',
            'assignedDriver.latestPing',
            'offeredDriver.user',
        ])));
    }

    public function update(Request $request, Order $order)
    {
        abort_unless($this->canUpdateOrder($request, $order), Response::HTTP_FORBIDDEN);

        $data = $request->validate([
            'pickup_lat' => ['nullable', 'numeric'],
            'pickup_lng' => ['nullable', 'numeric'],
            'dropoff_lat' => ['nullable', 'numeric'],
            'dropoff_lng' => ['nullable', 'numeric'],
            'pickup_address' => ['nullable', 'string', 'max:255'],
            'dropoff_address' => ['nullable', 'string', 'max:255'],
            'customer_name' => ['nullable', 'string', 'max:255'],
            'customer_phone' => ['nullable', 'string', 'max:50'],
            'promo_code' => ['nullable', 'string', 'max:50'],
            'notes' => ['nullable', 'string'],
            'weather_condition' => ['nullable', 'string', 'in:clear,rain,snow,storm,fog'],
            'time_window_start' => ['nullable', 'date'],
            'time_window_end' => ['nullable', 'date'],
            'priority' => ['nullable', 'integer', 'min:1', 'max:5'],
            'size' => ['nullable', 'numeric', 'min:0'],
            'status' => ['nullable', 'string'],
        ]);

        if (array_key_exists('status', $data)) {
            $allowed = [
                'MARKET_PENDING' => ['MARKET_ACCEPTED', 'CANCELLED'],
                'MARKET_ACCEPTED' => ['READY_FOR_PICKUP', 'CANCELLED'],
                'READY_FOR_PICKUP' => ['OFFERED', 'CANCELLED'],
                'OFFERED' => ['ASSIGNED', 'CANCELLED', 'READY_FOR_PICKUP'],
                'ASSIGNED' => ['PICKED_UP', 'CANCELLED'],
                'PICKED_UP' => ['DELIVERED', 'FAILED'],
                'FAILED' => [],
                'DELIVERED' => [],
                'CANCELLED' => [],
            ];

            $from = $order->status;
            $to = $data['status'];

            if (!isset($allowed[$from]) || !in_array($to, $allowed[$from], true)) {
                return response()->json([
                    'message' => "Invalid status change: $from -> $to",
                ], 422);
            }

            OrderEvent::create([
                'order_id' => $order->id,
                'type' => 'STATUS_CHANGED',
                'payload' => ['from' => $from, 'to' => $to],
            ]);
        }

        $order->update($data);

        return response()->json($this->decorateOrder($order->fresh(['market', 'customer', 'assignedDriver.user', 'offeredDriver.user', 'items'])));
    }

    public function marketAccept(Request $request, Order $order)
    {
        abort_unless($this->canManageMarketOrder($request, $order), Response::HTTP_FORBIDDEN);

        if ($order->status !== 'MARKET_PENDING') {
            return response()->json(['message' => 'Only market-pending orders can be accepted by the market'], 422);
        }

        $order->update([
            'status' => 'MARKET_ACCEPTED',
            'market_accepted_at' => now(),
            'estimated_delivery_at' => now()->addMinutes(50),
        ]);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'MARKET_ACCEPTED',
            'payload' => [
                'user_id' => $request->user()->id,
                'user_name' => $request->user()->name,
            ],
        ]);

        return response()->json($this->decorateOrder($order->fresh(['market', 'customer', 'assignedDriver.user', 'assignedDriver.latestPing', 'offeredDriver.user', 'items'])));
    }

    public function markReady(Request $request, Order $order)
    {
        abort_unless($this->canManageMarketOrder($request, $order), Response::HTTP_FORBIDDEN);

        if (!in_array($order->status, ['MARKET_ACCEPTED', 'READY_FOR_PICKUP'], true)) {
            return response()->json(['message' => 'Only accepted market orders can be marked ready'], 422);
        }

        $order->update([
            'status' => 'READY_FOR_PICKUP',
            'ready_for_pickup_at' => now(),
            'estimated_delivery_at' => now()->addMinutes(35),
        ]);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'MARKET_READY',
            'payload' => [
                'user_id' => $request->user()->id,
                'user_name' => $request->user()->name,
            ],
        ]);

        $this->dispatchService->offerOrder($order->fresh());

        return response()->json($this->decorateOrder($order->fresh(['market', 'customer', 'assignedDriver.user', 'assignedDriver.latestPing', 'offeredDriver.user', 'items'])));
    }

    public function requestCancel(Request $request, Order $order)
    {
        abort_unless($this->canAccessOrder($request, $order), Response::HTTP_FORBIDDEN);

        $data = $request->validate([
            'reason' => ['nullable', 'string', 'max:255'],
        ]);

        if (!in_array($order->status, ['MARKET_PENDING', 'MARKET_ACCEPTED', 'READY_FOR_PICKUP'], true)) {
            return response()->json(['message' => 'This order can no longer be cancelled automatically'], 422);
        }

        $order->update([
            'status' => 'CANCELLED',
            'cancellation_requested_at' => now(),
            'cancellation_reason' => $data['reason'] ?? 'Customer request',
        ]);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'CANCELLATION_REQUESTED',
            'payload' => [
                'reason' => $data['reason'] ?? 'Customer request',
                'requested_by' => $request->user()?->id,
            ],
        ]);

        return response()->json($this->decorateOrder($order->fresh(['market', 'customer', 'assignedDriver.user', 'assignedDriver.latestPing', 'offeredDriver.user', 'items'])));
    }

    public function rate(Request $request, Order $order)
    {
        abort_unless($this->canAccessOrder($request, $order), Response::HTTP_FORBIDDEN);

        if ($order->status !== 'DELIVERED') {
            return response()->json(['message' => 'You can only rate delivered orders'], 422);
        }

        $data = $request->validate([
            'rating' => ['required', 'integer', 'min:1', 'max:5'],
            'feedback' => ['nullable', 'string'],
        ]);

        $order->update([
            'customer_rating' => $data['rating'],
            'customer_feedback' => $data['feedback'] ?? null,
        ]);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'CUSTOMER_RATED',
            'payload' => [
                'rating' => $data['rating'],
                'feedback' => $data['feedback'] ?? null,
            ],
        ]);

        return response()->json($this->decorateOrder($order->fresh(['market', 'customer', 'assignedDriver.user', 'assignedDriver.latestPing', 'offeredDriver.user', 'items'])));
    }

    public function reorder(Request $request, Order $order)
    {
        abort_unless($this->canAccessOrder($request, $order), Response::HTTP_FORBIDDEN);
        $order->loadMissing('items');

        $clone = DB::transaction(function () use ($request, $order) {
            $nextId = (int) (Order::max('id') ?? 0) + 1;
            $newOrder = Order::create([
                'market_id' => $order->market_id,
                'customer_user_id' => $request->user()?->id,
                'code' => 'ORD-' . str_pad((string) $nextId, 6, '0', STR_PAD_LEFT),
                'pickup_lat' => $order->pickup_lat,
                'pickup_lng' => $order->pickup_lng,
                'dropoff_lat' => $order->dropoff_lat,
                'dropoff_lng' => $order->dropoff_lng,
                'pickup_address' => $order->pickup_address,
                'dropoff_address' => $order->dropoff_address,
                'customer_name' => $order->customer_name,
                'customer_phone' => $order->customer_phone,
                'promo_code' => $order->promo_code,
                'notes' => $order->notes,
                'priority' => $order->priority,
                'size' => $order->size,
                'subtotal' => $order->subtotal,
                'discount_total' => $order->discount_total,
                'total' => $order->total,
                'status' => $order->market_id ? 'MARKET_PENDING' : 'READY_FOR_PICKUP',
                'promised_at' => now()->addMinutes($order->market_id ? 75 : 45),
                'estimated_delivery_at' => now()->addMinutes($order->market_id ? 60 : 35),
            ]);

            foreach ($order->items as $item) {
                OrderItem::create([
                    'order_id' => $newOrder->id,
                    'item_id' => $item->item_id,
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'qty' => $item->qty,
                    'unit_price' => $item->unit_price,
                    'line_total' => $item->line_total,
                ]);
            }

            OrderEvent::create([
                'order_id' => $newOrder->id,
                'type' => 'REORDER_CREATED',
                'payload' => ['source_order_id' => $order->id],
            ]);

            return $newOrder;
        });

        if (!$clone->market_id) {
            $this->dispatchService->offerOrder($clone);
        }

        return response()->json(
            $this->decorateOrder($clone->fresh(['market', 'customer', 'assignedDriver.user', 'assignedDriver.latestPing', 'offeredDriver.user', 'items'])),
            201,
        );
    }

    private function canAccessOrder(Request $request, Order $order): bool
    {
        $user = $request->user();

        if ($user->hasRole('admin')) {
            return true;
        }

        if ($user->hasRole('driver') && $user->driver) {
            return (int) $order->assigned_driver_id === (int) $user->driver->id
                || (int) $order->offered_driver_id === (int) $user->driver->id;
        }

        if ($user->hasAnyRole(['owner', 'staff'])) {
            return $this->userCanAccessMarket($user->id, $order->market_id);
        }

        return (int) $order->customer_user_id === (int) $user->id;
    }

    private function canManageMarketOrder(Request $request, Order $order): bool
    {
        $user = $request->user();

        if ($user->hasRole('admin')) {
            return true;
        }

        if (!$user->hasAnyRole(['owner', 'staff'])) {
            return false;
        }

        return $this->userCanAccessMarket($user->id, $order->market_id);
    }

    private function canUpdateOrder(Request $request, Order $order): bool
    {
        $user = $request->user();

        if ($user->hasRole('admin')) {
            return true;
        }

        if ($user->hasAnyRole(['owner', 'staff'])) {
            return $this->userCanAccessMarket($user->id, $order->market_id);
        }

        return false;
    }

    private function userCanAccessMarket(int $userId, ?int $marketId): bool
    {
        if (!$marketId) {
            return false;
        }

        return Market::query()
            ->whereKey($marketId)
            ->where(function (Builder $builder) use ($userId) {
                $builder
                    ->where('owner_user_id', $userId)
                    ->orWhereHas('users', fn (Builder $users) => $users->where('users.id', $userId));
            })
            ->exists();
    }

    private function decoratePaginator(LengthAwarePaginator $paginator): LengthAwarePaginator
    {
        $paginator->setCollection(
            $paginator->getCollection()->map(fn (Order $order) => $this->decorateOrder($order))
        );

        return $paginator;
    }

    private function decorateOrder(Order $order): Order
    {
        $order->setAttribute('timeline', $this->buildTimeline($order));
        $order->setAttribute('eta_summary', $this->buildEtaSummary($order));
        $order->setAttribute('delivery_proof', [
            'note' => $order->proof_of_delivery_note,
            'photo_url' => $order->proof_of_delivery_photo_url,
        ]);
        $order->setAttribute('driver_compensation', [
            'distance_km' => $order->driver_distance_km,
            'weather_multiplier' => $order->driver_weather_multiplier,
            'earning_amount' => $order->driver_earning_amount,
            'weather_condition' => $order->weather_condition,
        ]);
        $order->setAttribute('rating_summary', [
            'rating' => $order->customer_rating,
            'feedback' => $order->customer_feedback,
        ]);
        $order->setAttribute('actions', [
            'can_cancel' => in_array($order->status, ['MARKET_PENDING', 'MARKET_ACCEPTED', 'READY_FOR_PICKUP'], true),
            'can_rate' => $order->status === 'DELIVERED',
            'can_reorder' => $order->relationLoaded('items') ? $order->items->isNotEmpty() : $order->items()->exists(),
        ]);

        return $order;
    }

    private function buildTimeline(Order $order): array
    {
        return array_values(array_filter([
            [
                'key' => 'created',
                'label' => 'Order created',
                'at' => $order->created_at?->toDateTimeString(),
                'done' => true,
            ],
            [
                'key' => 'market_accepted',
                'label' => 'Market accepted',
                'at' => $order->market_accepted_at?->toDateTimeString(),
                'done' => (bool) $order->market_accepted_at,
            ],
            [
                'key' => 'ready',
                'label' => 'Ready for pickup',
                'at' => $order->ready_for_pickup_at?->toDateTimeString(),
                'done' => (bool) $order->ready_for_pickup_at,
            ],
            [
                'key' => 'accepted',
                'label' => 'Driver accepted',
                'at' => $order->accepted_at?->toDateTimeString(),
                'done' => (bool) $order->accepted_at,
            ],
            [
                'key' => 'picked_up',
                'label' => 'Picked up',
                'at' => $order->picked_up_at?->toDateTimeString(),
                'done' => (bool) $order->picked_up_at,
            ],
            [
                'key' => 'delivered',
                'label' => 'Delivered',
                'at' => $order->delivered_at?->toDateTimeString(),
                'done' => (bool) $order->delivered_at,
            ],
        ], fn (array $step) => $step['done'] || in_array($step['key'], ['created', 'delivered'], true)));
    }

    private function buildEtaSummary(Order $order): array
    {
        return [
            'estimated_delivery_at' => $order->estimated_delivery_at?->toDateTimeString(),
            'promised_at' => $order->promised_at?->toDateTimeString(),
            'is_late' => (bool) ($order->promised_at && !$order->delivered_at && now()->gt($order->promised_at)),
        ];
    }

    private function resolvePromoCode(Market $market, string $code): ?PromoCode
    {
        $now = now();

        return PromoCode::query()
            ->whereRaw('UPPER(code) = ?', [mb_strtoupper(trim($code))])
            ->where(function (Builder $query) use ($market) {
                $query
                    ->where('market_id', $market->id)
                    ->orWhereNull('market_id');
            })
            ->activeApplicable()
            ->orderByRaw('CASE WHEN market_id = ? THEN 0 ELSE 1 END', [$market->id])
            ->latest()
            ->first();
    }

    private function calculateDiscount(?PromoCode $promo, float $subtotal): float
    {
        if (!$promo || $subtotal <= 0) {
            return 0.0;
        }

        $value = (float) $promo->value;

        if ($promo->type === 'percent') {
            return min($subtotal, round($subtotal * ($value / 100), 2));
        }

        return min($subtotal, round($value, 2));
    }
}
