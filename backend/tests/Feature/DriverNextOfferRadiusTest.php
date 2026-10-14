<?php

namespace Tests\Feature;

use App\Models\Driver;
use App\Models\LocationPing;
use App\Models\Market;
use App\Models\Order;
use App\Models\Shift;
use App\Models\User;
use App\Models\Vehicle;
use App\Services\OrderDispatchService;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

/** A busy driver only gets the next offer when ~500 m from the current customer. */
class DriverNextOfferRadiusTest extends TestCase
{
    use RefreshDatabase;

    private const DROPOFF = [41.7211, 44.8011];

    public function test_busy_driver_gets_next_offer_only_near_the_current_customer(): void
    {
        $this->seed(RolesSeeder::class);
        $market = Market::create(['name' => 'Harbor', 'code' => 'HBR', 'owner_user_id' => User::factory()->create()->id, 'is_active' => true]);
        $driver = $this->createDriver();
        $dispatch = app(OrderDispatchService::class);

        // Free driver: can get offers.
        $this->assertTrue($dispatch->canReceiveNewOffer($driver->fresh()));

        // Assigned (not picked up yet): no new offers.
        $current = $this->createOrder($market, 'ASSIGNED', $driver->id);
        $this->assertFalse($dispatch->canReceiveNewOffer($driver->fresh()));

        // Picked up but still far from the customer (~2.4 km): no new offers.
        $current->update(['status' => 'PICKED_UP']);
        $this->ping($driver, 41.7151, 44.8271);
        $this->assertFalse($dispatch->canReceiveNewOffer($driver->fresh()));

        // Within ~300 m of the customer: the next order can be offered.
        $this->ping($driver, 41.7230, 44.8035);
        $this->assertTrue($dispatch->canReceiveNewOffer($driver->fresh()));

        $next = $this->createOrder($market, 'MARKET_ACCEPTED', null, 'ORD-NEXT');
        $dispatch->offerOrder($next);
        $this->assertSame($driver->id, $next->fresh()->offered_driver_id);
    }

    public function test_far_busy_driver_is_skipped_for_new_orders(): void
    {
        $this->seed(RolesSeeder::class);
        $market = Market::create(['name' => 'Harbor', 'code' => 'HBR', 'owner_user_id' => User::factory()->create()->id, 'is_active' => true]);
        $driver = $this->createDriver();
        $this->createOrder($market, 'PICKED_UP', $driver->id);
        $this->ping($driver, 41.7151, 44.8271);

        $next = $this->createOrder($market, 'MARKET_ACCEPTED', null, 'ORD-NEXT');
        app(OrderDispatchService::class)->offerOrder($next);

        $this->assertNull($next->fresh()->offered_driver_id);
        $this->assertSame('MARKET_ACCEPTED', $next->fresh()->status);
    }

    private function ping(Driver $driver, float $lat, float $lng): void
    {
        LocationPing::create(['driver_id' => $driver->id, 'lat' => $lat, 'lng' => $lng, 'speed' => 0, 'heading' => 0]);
        // Make sure the newest ping wins regardless of identical timestamps.
        LocationPing::query()->where('driver_id', $driver->id)->latest('id')->first()->update(['created_at' => now()->addSecond()]);
    }

    private function createDriver(): Driver
    {
        $user = User::factory()->create();
        $user->assignRole('driver');
        $vehicle = Vehicle::create(['name' => 'Van', 'type' => 'van', 'capacity' => 20, 'max_stops' => 8]);
        $driver = Driver::create(['user_id' => $user->id, 'vehicle_id' => $vehicle->id, 'status' => 'ON_ROUTE', 'balance' => 0, 'total_earned' => 0]);
        Shift::create(['driver_id' => $driver->id, 'started_at' => now()->subHour(), 'status' => 'ACTIVE']);
        LocationPing::create(['driver_id' => $driver->id, 'lat' => 41.7151, 'lng' => 44.8271, 'speed' => 0, 'heading' => 0]);

        return $driver;
    }

    private function createOrder(Market $market, string $status, ?int $driverId, string $code = 'ORD-CUR'): Order
    {
        return Order::create([
            'market_id' => $market->id,
            'customer_user_id' => User::factory()->create()->id,
            'assigned_driver_id' => $driverId,
            'code' => $code,
            'customer_name' => 'Nino',
            'customer_phone' => '555-0100',
            'pickup_lat' => 41.7151,
            'pickup_lng' => 44.8271,
            'dropoff_lat' => self::DROPOFF[0],
            'dropoff_lng' => self::DROPOFF[1],
            'pickup_address' => 'Pickup',
            'dropoff_address' => 'Dropoff',
            'priority' => 2,
            'size' => 1,
            'subtotal' => 20,
            'discount_total' => 0,
            'total' => 20,
            'status' => $status,
        ]);
    }
}
