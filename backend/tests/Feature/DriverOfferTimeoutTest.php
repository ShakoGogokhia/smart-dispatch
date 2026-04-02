<?php

namespace Tests\Feature;

use App\Models\Driver;
use App\Models\LocationPing;
use App\Models\Order;
use App\Models\Shift;
use App\Models\User;
use App\Models\Vehicle;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class DriverOfferTimeoutTest extends TestCase
{
    use RefreshDatabase;

    public function test_feed_reassigns_expired_offer_to_another_driver(): void
    {
        $this->seed(RolesSeeder::class);

        [$firstDriverUser, $firstDriver] = $this->createDriverAccount('driver-one@test.com', 41.7151, 44.8271);
        [, $secondDriver] = $this->createDriverAccount('driver-two@test.com', 41.7161, 44.8281);

        $order = $this->createExpiredOffer($firstDriver);

        $response = $this->withToken($firstDriverUser->createToken('driver-feed')->plainTextToken)
            ->getJson('/api/driver/orders/feed');

        $response->assertOk()
            ->assertJsonCount(0, 'offered_orders');

        $order->refresh();

        $this->assertSame('OFFERED', $order->status);
        $this->assertSame($secondDriver->id, $order->offered_driver_id);
        $this->assertNotNull($order->offer_sent_at);
    }

    public function test_accept_rejects_expired_offer_and_reassigns_it(): void
    {
        $this->seed(RolesSeeder::class);

        [$firstDriverUser, $firstDriver] = $this->createDriverAccount('driver-one@test.com', 41.7151, 44.8271);
        [, $secondDriver] = $this->createDriverAccount('driver-two@test.com', 41.7161, 44.8281);

        $order = $this->createExpiredOffer($firstDriver);

        $this->withToken($firstDriverUser->createToken('driver-accept')->plainTextToken)
            ->postJson("/api/driver/orders/{$order->id}/accept")
            ->assertStatus(422)
            ->assertJsonPath('message', 'This offer expired and was reassigned');

        $order->refresh();

        $this->assertSame('OFFERED', $order->status);
        $this->assertSame($secondDriver->id, $order->offered_driver_id);
        $this->assertNull($order->assigned_driver_id);
    }

    private function createDriverAccount(string $email, float $lat, float $lng): array
    {
        $user = User::factory()->create([
            'email' => $email,
            'password' => '123456',
        ]);
        $user->assignRole('driver');

        $vehicle = Vehicle::create([
            'name' => "Vehicle {$email}",
            'type' => 'van',
            'capacity' => 20,
            'max_stops' => 8,
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
            'lat' => $lat,
            'lng' => $lng,
            'speed' => 0,
            'heading' => 0,
        ]);

        return [$user, $driver];
    }

    private function createExpiredOffer(Driver $driver): Order
    {
        return Order::create([
            'code' => 'ORD-TIMEOUT-1',
            'customer_name' => 'Timeout Test',
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
            'status' => 'OFFERED',
            'offered_driver_id' => $driver->id,
            'offer_sent_at' => now()->subMinutes(6),
            'ready_for_pickup_at' => now()->subMinutes(7),
            'estimated_delivery_at' => now()->addMinutes(30),
            'promised_at' => now()->addMinutes(45),
            'weather_condition' => 'clear',
        ]);
    }
}
