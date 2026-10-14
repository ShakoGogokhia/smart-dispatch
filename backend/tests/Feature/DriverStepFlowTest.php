<?php

namespace Tests\Feature;

use App\Models\Driver;
use App\Models\LocationPing;
use App\Models\Market;
use App\Models\Order;
use App\Models\Shift;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/**
 * Simple driver flow: offer (as soon as the market accepts) -> accept -> arrive at market -> wait until ready
 * -> pick up -> arrive at customer -> deliver.
 */
class DriverStepFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_driver_follows_one_step_at_a_time_from_offer_to_delivery(): void
    {
        $this->seed(RolesSeeder::class);

        $owner = User::factory()->create();
        $owner->assignRole('owner');
        $market = Market::create(['name' => 'Harbor Market', 'code' => 'HBR001', 'owner_user_id' => $owner->id, 'is_active' => true]);
        $market->users()->attach($owner->id, ['role' => 'owner']);

        [$driverUser, $driver] = $this->createDriver();
        $order = $this->createOrder($market);

        $ownerToken = $owner->createToken('owner')->plainTextToken;
        $driverToken = $driverUser->createToken('driver')->plainTextToken;

        // Market accepts -> the order is offered to a driver right away (while it's being prepared).
        $this->withToken($ownerToken)->postJson("/api/orders/{$order->id}/market-accept")->assertOk();
        $order->refresh();
        $this->assertSame('OFFERED', $order->status);
        $this->assertSame($driver->id, $order->offered_driver_id);

        $this->forgetAuth();
        $this->withToken($driverToken)->getJson('/api/driver/orders/feed')
            ->assertJsonPath('offered_orders.0.driver_step', 'offer');

        // Accept -> head to the market.
        $this->withToken($driverToken)->postJson("/api/driver/orders/{$order->id}/accept")->assertOk();
        $this->withToken($driverToken)->getJson('/api/driver/orders/feed')
            ->assertJsonPath('assigned_orders.0.driver_step', 'to_pickup')
            ->assertJsonPath('assigned_orders.0.is_ready_for_pickup', false);

        // Can't pick up before the market has prepared the order.
        $this->withToken($driverToken)->postJson("/api/driver/orders/{$order->id}/picked-up")->assertStatus(422);

        // Arrive at the market -> waiting for the order.
        $this->withToken($driverToken)->postJson("/api/driver/orders/{$order->id}/arrived-pickup")
            ->assertOk()
            ->assertJsonPath('driver_step', 'waiting_ready');

        // Market marks it ready; the driver stays assigned.
        $this->forgetAuth();
        $this->withToken($ownerToken)->postJson("/api/orders/{$order->id}/mark-ready")->assertOk();
        $this->assertSame('ASSIGNED', $order->fresh()->status);
        $this->assertNotNull($order->fresh()->ready_for_pickup_at);

        $this->forgetAuth();
        $this->withToken($driverToken)->getJson('/api/driver/orders/feed')
            ->assertJsonPath('assigned_orders.0.driver_step', 'pickup');

        // Pick up -> head to the customer -> arrive -> hand over.
        $this->withToken($driverToken)->postJson("/api/driver/orders/{$order->id}/delivered")->assertStatus(422);
        $this->withToken($driverToken)->postJson("/api/driver/orders/{$order->id}/picked-up")->assertOk();
        $this->withToken($driverToken)->getJson('/api/driver/orders/feed')
            ->assertJsonPath('assigned_orders.0.driver_step', 'to_dropoff');
        $this->withToken($driverToken)->postJson("/api/driver/orders/{$order->id}/arrived-dropoff")
            ->assertOk()
            ->assertJsonPath('driver_step', 'handover');
        $this->withToken($driverToken)->postJson("/api/driver/orders/{$order->id}/delivered", ['proof_signature_name' => 'Nino'])->assertOk();

        $order->refresh();
        $this->assertSame('DELIVERED', $order->status);
        $this->assertNotNull($order->arrived_at_pickup_at);
        $this->assertNotNull($order->arrived_at_dropoff_at);
    }

    public function test_declined_offer_returns_to_preparing_status_until_ready(): void
    {
        $this->seed(RolesSeeder::class);

        $owner = User::factory()->create();
        $owner->assignRole('owner');
        $market = Market::create(['name' => 'Harbor Market', 'code' => 'HBR001', 'owner_user_id' => $owner->id, 'is_active' => true]);
        $market->users()->attach($owner->id, ['role' => 'owner']);
        [$driverUser] = $this->createDriver();
        $order = $this->createOrder($market);

        $this->withToken($owner->createToken('owner')->plainTextToken)->postJson("/api/orders/{$order->id}/market-accept")->assertOk();
        $this->forgetAuth();
        $this->withToken($driverUser->createToken('driver')->plainTextToken)->postJson("/api/driver/orders/{$order->id}/decline")->assertOk();

        // Only driver declined and the order isn't ready yet -> back to MARKET_ACCEPTED, not READY_FOR_PICKUP.
        $this->assertSame('MARKET_ACCEPTED', $order->fresh()->status);
    }

    private function forgetAuth(): void
    {
        $this->app['auth']->forgetGuards();
    }

    private function createDriver(): array
    {
        $user = User::factory()->create();
        $user->assignRole('driver');
        $vehicle = Vehicle::create(['name' => 'Van', 'type' => 'van', 'capacity' => 20, 'max_stops' => 8]);
        $driver = Driver::create(['user_id' => $user->id, 'vehicle_id' => $vehicle->id, 'status' => 'ONLINE', 'balance' => 0, 'total_earned' => 0]);
        Shift::create(['driver_id' => $driver->id, 'started_at' => now()->subHour(), 'status' => 'ACTIVE']);
        LocationPing::create(['driver_id' => $driver->id, 'lat' => 41.7151, 'lng' => 44.8271, 'speed' => 0, 'heading' => 0]);

        return [$user, $driver];
    }

    private function createOrder(Market $market): Order
    {
        return Order::create([
            'market_id' => $market->id,
            'customer_user_id' => User::factory()->create()->id,
            'code' => 'ORD-FLOW-1',
            'customer_name' => 'Nino',
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
            'status' => 'MARKET_PENDING',
            'weather_condition' => 'clear',
        ]);
    }
}
