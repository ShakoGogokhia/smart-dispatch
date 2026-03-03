<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Order;
use App\Models\OrderEvent;
use Illuminate\Http\Request;

class OrderController extends Controller
{
    public function index(Request $request)
    {
        $q = Order::query()->latest();

        if ($request->filled('status')) {
            $q->where('status', $request->string('status'));
        }

        return response()->json($q->paginate(20));
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'dropoff_lat' => ['required','numeric'],
            'dropoff_lng' => ['required','numeric'],

            'pickup_lat' => ['nullable','numeric'],
            'pickup_lng' => ['nullable','numeric'],

            'pickup_address' => ['nullable','string','max:255'],
            'dropoff_address' => ['nullable','string','max:255'],

            'time_window_start' => ['nullable','date'],
            'time_window_end' => ['nullable','date'],

            'priority' => ['nullable','integer','min:1','max:5'],
            'size' => ['nullable','numeric','min:0'],
        ]);

        // Simple readable order code
        $nextId = (int) (Order::max('id') ?? 0) + 1;
        $data['code'] = 'ORD-' . str_pad((string)$nextId, 6, '0', STR_PAD_LEFT);
        $data['status'] = 'NEW';

        $order = Order::create($data);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'CREATED',
            'payload' => $data,
        ]);

        return response()->json($order, 201);
    }

    public function show(Order $order)
    {
        return response()->json($order->load('events'));
    }

    public function update(Request $request, Order $order)
    {
        $data = $request->validate([
            'pickup_lat' => ['nullable','numeric'],
            'pickup_lng' => ['nullable','numeric'],
            'dropoff_lat' => ['nullable','numeric'],
            'dropoff_lng' => ['nullable','numeric'],
            'pickup_address' => ['nullable','string','max:255'],
            'dropoff_address' => ['nullable','string','max:255'],
            'time_window_start' => ['nullable','date'],
            'time_window_end' => ['nullable','date'],
            'priority' => ['nullable','integer','min:1','max:5'],
            'size' => ['nullable','numeric','min:0'],
            'status' => ['nullable','string'],
        ]);

        // Status transition guard (MVP)
        if (array_key_exists('status', $data)) {
            $allowed = [
                'NEW' => ['PLANNED', 'CANCELLED'],
                'PLANNED' => ['ASSIGNED', 'CANCELLED'],
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
                    'message' => "Invalid status change: $from -> $to"
                ], 422);
            }

            OrderEvent::create([
                'order_id' => $order->id,
                'type' => 'STATUS_CHANGED',
                'payload' => ['from' => $from, 'to' => $to],
            ]);
        }

        $order->update($data);

        return response()->json($order);
    }
}