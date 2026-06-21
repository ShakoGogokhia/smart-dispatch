<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AppNotification;
use App\Models\Driver;
use App\Models\Item;
use App\Models\LocationPing;
use App\Models\Market;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\OrderItem;
use App\Models\ProductReview;
use App\Models\RoutePlan;
use App\Models\RouteStop;
use App\Models\Shift;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Support\Facades\DB;

class DemoScenarioController extends Controller
{
    public function store()
    {
        $summary = DB::transaction(function () {
            $admin = User::firstOrCreate(['email' => 'admin@test.com'], ['name' => 'Admin User', 'password' => '123456']);
            $customer = User::firstOrCreate(['email' => 'customer@test.com'], ['name' => 'Customer User', 'password' => '123456']);
            $owner = User::firstOrCreate(['email' => 'owner@test.com'], ['name' => 'Market Owner', 'password' => '123456']);
            $driverUser = User::firstOrCreate(['email' => 'driver@test.com'], ['name' => 'Demo Driver', 'password' => '123456']);

            $admin->syncRoles(['admin']);
            $customer->syncRoles(['customer']);
            $owner->syncRoles(['owner']);
            $driverUser->syncRoles(['driver']);

            $market = Market::updateOrCreate(
                ['code' => 'DEMO-HUB'],
                [
                    'name' => 'Demo Dispatch Market',
                    'owner_user_id' => $owner->id,
                    'address' => '12 Freedom Square, Tbilisi',
                    'lat' => 41.7151,
                    'lng' => 44.8271,
                    'is_active' => true,
                ],
            );
            $market->users()->syncWithoutDetaching([$owner->id => ['role' => 'owner']]);

            $vehicle = Vehicle::firstOrCreate(['name' => 'Demo Courier Van'], ['type' => 'van', 'capacity' => 60, 'max_stops' => 14]);
            $driver = Driver::updateOrCreate(['user_id' => $driverUser->id], ['vehicle_id' => $vehicle->id, 'status' => 'ONLINE']);
            Shift::updateOrCreate(['driver_id' => $driver->id, 'status' => 'ACTIVE'], ['started_at' => now()->subHours(2)]);
            LocationPing::create(['driver_id' => $driver->id, 'lat' => 41.7192, 'lng' => 44.8015, 'speed' => 18, 'heading' => 90]);

            $items = collect([
                ['sku' => 'DEMO-BOX', 'name' => 'Family Grocery Box', 'price' => 42, 'stock_qty' => 2, 'low_stock_threshold' => 5],
                ['sku' => 'DEMO-FLOWERS', 'name' => 'Fresh Flower Bundle', 'price' => 24, 'stock_qty' => 12, 'low_stock_threshold' => 4],
                ['sku' => 'DEMO-COFFEE', 'name' => 'Cold Brew Pack', 'price' => 16, 'stock_qty' => 0, 'low_stock_threshold' => 3],
            ])->map(fn (array $item) => Item::updateOrCreate(
                ['market_id' => $market->id, 'sku' => $item['sku']],
                [
                    'name' => $item['name'],
                    'price' => $item['price'],
                    'stock_qty' => $item['stock_qty'],
                    'low_stock_threshold' => $item['low_stock_threshold'],
                    'discount_type' => 'none',
                    'discount_value' => 0,
                    'is_active' => $item['stock_qty'] > 0,
                    'show_stock_quantity' => true,
                ],
            ));

            $statuses = ['MARKET_PENDING', 'READY_FOR_PICKUP', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'];
            $orders = collect($statuses)->map(function (string $status, int $index) use ($market, $customer, $driver, $items) {
                $nextId = (int) (Order::max('id') ?? 0) + 1;
                $order = Order::create([
                    'market_id' => $market->id,
                    'customer_user_id' => $customer->id,
                    'assigned_driver_id' => in_array($status, ['ASSIGNED', 'PICKED_UP', 'DELIVERED'], true) ? $driver->id : null,
                    'code' => 'DEMO-' . str_pad((string) $nextId, 5, '0', STR_PAD_LEFT),
                    'receipt_number' => 'RCT-' . now()->format('Ymd') . '-' . str_pad((string) $nextId, 5, '0', STR_PAD_LEFT),
                    'pickup_lat' => $market->lat,
                    'pickup_lng' => $market->lng,
                    'dropoff_lat' => 41.71 + ($index * 0.01),
                    'dropoff_lng' => 44.79 + ($index * 0.01),
                    'pickup_address' => $market->address,
                    'dropoff_address' => 'Demo customer address #' . ($index + 1),
                    'customer_name' => $customer->name,
                    'customer_phone' => '+995 555 010 10' . $index,
                    'priority' => 2,
                    'size' => 2,
                    'subtotal' => 58,
                    'discount_total' => 0,
                    'total' => 58,
                    'status' => $status,
                    'market_accepted_at' => $status !== 'MARKET_PENDING' ? now()->subMinutes(50) : null,
                    'ready_for_pickup_at' => in_array($status, ['READY_FOR_PICKUP', 'ASSIGNED', 'PICKED_UP', 'DELIVERED'], true) ? now()->subMinutes(35) : null,
                    'accepted_at' => in_array($status, ['ASSIGNED', 'PICKED_UP', 'DELIVERED'], true) ? now()->subMinutes(25) : null,
                    'picked_up_at' => in_array($status, ['PICKED_UP', 'DELIVERED'], true) ? now()->subMinutes(15) : null,
                    'delivered_at' => $status === 'DELIVERED' ? now()->subMinutes(5) : null,
                    'estimated_delivery_at' => now()->addMinutes(max(5, 40 - ($index * 8))),
                    'promised_at' => now()->addMinutes(50),
                    'customer_rating' => $status === 'DELIVERED' ? 5 : null,
                ]);

                $item = $items[$index % $items->count()];
                OrderItem::create([
                    'order_id' => $order->id,
                    'item_id' => $item->id,
                    'name' => $item->name,
                    'sku' => $item->sku,
                    'qty' => 1,
                    'unit_price' => $item->price,
                    'line_total' => $item->price,
                ]);
                OrderEvent::create(['order_id' => $order->id, 'type' => 'DEMO_STATUS', 'payload' => ['status' => $status]]);

                return $order;
            });

            $route = RoutePlan::updateOrCreate(
                ['driver_id' => $driver->id, 'route_date' => now()->toDateString()],
                ['status' => 'ACTIVE', 'planned_distance_km' => 18.4, 'planned_duration_min' => 72],
            );
            foreach ($orders->whereIn('status', ['ASSIGNED', 'PICKED_UP', 'DELIVERED'])->values() as $index => $order) {
                RouteStop::updateOrCreate(
                    ['route_plan_id' => $route->id, 'order_id' => $order->id],
                    ['sequence' => $index + 1, 'status' => $order->status === 'DELIVERED' ? 'DELIVERED' : 'ASSIGNED', 'eta' => now()->addMinutes(15 + ($index * 12)), 'dispatch_score' => 90 - ($index * 5)],
                );
            }

            ProductReview::firstOrCreate(
                ['market_id' => $market->id, 'user_id' => $customer->id, 'item_id' => null],
                ['rating' => 5, 'comment' => 'Fast demo delivery and fresh items.'],
            );
            AppNotification::create([
                'user_id' => $owner->id,
                'type' => 'demo.ready',
                'title' => 'Demo scenario ready',
                'message' => 'Fresh demo orders, stock alerts, route stops, and reviews were generated.',
                'payload' => ['market_id' => $market->id],
            ]);

            return [
                'market_id' => $market->id,
                'orders_created' => $orders->count(),
                'items_ready' => $items->count(),
                'route_id' => $route->id,
            ];
        });

        return response()->json(['message' => 'Demo scenario generated.', ...$summary], 201);
    }
}
