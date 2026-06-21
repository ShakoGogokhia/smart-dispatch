<?php

namespace Tests\Feature;

use App\Models\AppNotification;
use App\Models\Driver;
use App\Models\DriverTransaction;
use App\Models\Item;
use App\Models\LocationPing;
use App\Models\Market;
use App\Models\Order;
use App\Models\OrderEvent;
use App\Models\OrderItem;
use App\Models\Shift;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class NewWorkspaceFeaturesTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_order_tracking_returns_timeline_and_driver_position(): void
    {
        $this->seed(RolesSeeder::class);

        [$driver] = $this->createDriver('driver-track@test.com');
        $order = $this->createOrder([
            'code' => 'ORD-TRACK-1',
            'assigned_driver_id' => $driver->id,
            'status' => 'PICKED_UP',
            'accepted_at' => now()->subMinutes(20),
            'picked_up_at' => now()->subMinutes(10),
        ]);

        OrderEvent::create([
            'order_id' => $order->id,
            'type' => 'ORDER_PICKED_UP',
            'payload' => ['driver_id' => $driver->id],
        ]);

        $this->getJson('/api/public/track/ORD-TRACK-1')
            ->assertOk()
            ->assertJsonPath('code', 'ORD-TRACK-1')
            ->assertJsonPath('driver.name', 'Driver driver-track@test.com')
            ->assertJsonPath('timeline.4.done', true)
            ->assertJsonPath('events.0.type', 'ORDER_PICKED_UP');
    }

    public function test_driver_earnings_summary_returns_daily_and_transactions(): void
    {
        $this->seed(RolesSeeder::class);

        [$driver, $driverUser] = $this->createDriver('driver-earnings@test.com');
        $order = $this->createOrder([
            'code' => 'ORD-EARN-1',
            'assigned_driver_id' => $driver->id,
            'status' => 'DELIVERED',
            'delivered_at' => now(),
        ]);

        DriverTransaction::create([
            'driver_id' => $driver->id,
            'order_id' => $order->id,
            'type' => 'delivery_earning',
            'amount' => 9.75,
            'distance_km' => 4.2,
            'weather_multiplier' => 1,
            'weather_condition' => 'clear',
            'description' => 'Delivery earning for ORD-EARN-1',
        ]);

        $this->withToken($driverUser->createToken('earnings')->plainTextToken)
            ->getJson('/api/driver/earnings')
            ->assertOk()
            ->assertJsonPath('totals.period_earnings', 9.75)
            ->assertJsonPath('totals.period_deliveries', 1)
            ->assertJsonPath('transactions.0.order.code', 'ORD-EARN-1');
    }

    public function test_market_dashboard_and_inventory_alerts_surface_stock_warnings(): void
    {
        $this->seed(RolesSeeder::class);

        $owner = User::factory()->create(['password' => '123456']);
        $owner->assignRole('owner');

        $market = Market::create([
            'name' => 'Stock Market',
            'code' => 'STOCK',
            'owner_user_id' => $owner->id,
            'is_active' => true,
        ]);
        $market->users()->syncWithoutDetaching([$owner->id => ['role' => 'owner']]);

        Item::create([
            'market_id' => $market->id,
            'name' => 'Low Stock Item',
            'sku' => 'LOW-1',
            'price' => 12,
            'stock_qty' => 1,
            'low_stock_threshold' => 3,
            'discount_type' => 'none',
            'discount_value' => 0,
            'is_active' => true,
        ]);

        $token = $owner->createToken('owner')->plainTextToken;

        $this->withToken($token)
            ->getJson("/api/markets/{$market->id}/dashboard")
            ->assertOk()
            ->assertJsonPath('summary.low_stock_count', 1)
            ->assertJsonPath('stock_warnings.0.sku', 'LOW-1');

        $this->withToken($token)
            ->getJson("/api/markets/{$market->id}/inventory-alerts")
            ->assertOk()
            ->assertJsonPath('alerts.0.severity', 'low');
    }

    public function test_notifications_can_filter_and_mark_all_read(): void
    {
        $this->seed(RolesSeeder::class);

        $user = User::factory()->create(['password' => '123456']);
        $user->assignRole('customer');

        AppNotification::create([
            'user_id' => $user->id,
            'type' => 'order.ready',
            'title' => 'Order ready',
            'message' => 'Your order is ready.',
        ]);
        AppNotification::create([
            'user_id' => $user->id,
            'type' => 'driver.assigned',
            'title' => 'Driver assigned',
            'message' => 'A driver accepted.',
            'read_at' => now(),
        ]);

        $token = $user->createToken('notifications')->plainTextToken;

        $this->withToken($token)
            ->getJson('/api/notifications?status=unread')
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.type', 'order.ready');

        $this->withToken($token)
            ->postJson('/api/notifications/read-all')
            ->assertOk()
            ->assertJsonPath('updated', 1);
    }

    private function createDriver(string $email): array
    {
        $user = User::factory()->create([
            'name' => "Driver {$email}",
            'email' => $email,
            'password' => '123456',
        ]);
        $user->assignRole('driver');

        $vehicle = Vehicle::create([
            'name' => "Vehicle {$email}",
            'type' => 'van',
            'capacity' => 40,
            'max_stops' => 10,
        ]);

        $driver = Driver::create([
            'user_id' => $user->id,
            'vehicle_id' => $vehicle->id,
            'status' => 'ONLINE',
            'balance' => 0,
            'total_earned' => 0,
        ]);

        Shift::create([
            'driver_id' => $driver->id,
            'started_at' => now()->subHour(),
            'status' => 'ACTIVE',
        ]);

        LocationPing::create([
            'driver_id' => $driver->id,
            'lat' => 41.7151,
            'lng' => 44.8271,
            'speed' => 0,
            'heading' => 0,
        ]);

        return [$driver, $user];
    }

    private function createOrder(array $overrides = []): Order
    {
        $order = Order::create([
            'code' => 'ORD-FEATURE-1',
            'receipt_number' => 'RCT-FEATURE-1',
            'customer_name' => 'Feature Customer',
            'customer_phone' => '555-0100',
            'pickup_lat' => 41.7151,
            'pickup_lng' => 44.8271,
            'dropoff_lat' => 41.7211,
            'dropoff_lng' => 44.8011,
            'pickup_address' => 'Pickup point',
            'dropoff_address' => 'Dropoff point',
            'priority' => 2,
            'size' => 1,
            'subtotal' => 20,
            'discount_total' => 0,
            'total' => 20,
            'status' => 'READY_FOR_PICKUP',
            'ready_for_pickup_at' => now()->subMinutes(30),
            'estimated_delivery_at' => now()->addMinutes(30),
            'promised_at' => now()->addMinutes(45),
            'weather_condition' => 'clear',
            ...$overrides,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'name' => 'Feature Item',
            'sku' => 'FEATURE-ITEM',
            'qty' => 1,
            'unit_price' => 20,
            'line_total' => 20,
        ]);

        return $order;
    }
}
