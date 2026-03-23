<?php

namespace Database\Seeders;

use App\Models\Driver;
use App\Models\Item;
use App\Models\LocationPing;
use App\Models\Market;
use App\Models\Shift;
use App\Models\User;
use App\Models\Vehicle;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $this->call([
            RolesSeeder::class,
        ]);

        $admin = User::updateOrCreate(['email' => 'admin@test.com'], [
            'name' => 'Admin User',
            'password' => '123456',
        ]);
        $admin->syncRoles(['admin']);

        $customer = User::updateOrCreate(['email' => 'customer@test.com'], [
            'name' => 'Customer User',
            'password' => '123456',
        ]);
        $customer->syncRoles(['customer']);

        $owner = User::updateOrCreate(['email' => 'owner@test.com'], [
            'name' => 'Market Owner',
            'password' => '123456',
        ]);
        $owner->syncRoles(['owner']);

        $driverUser = User::updateOrCreate(['email' => 'driver@test.com'], [
            'name' => 'Demo Driver',
            'password' => '123456',
        ]);
        $driverUser->syncRoles(['driver']);

        $vehicle = Vehicle::firstOrCreate(
            ['name' => 'City Van 01'],
            [
                'type' => 'van',
                'capacity' => 40,
                'max_stops' => 12,
            ]
        );

        $driver = Driver::firstOrCreate(
            ['user_id' => $driverUser->id],
            [
                'vehicle_id' => $vehicle->id,
                'status' => 'ONLINE',
            ]
        );

        $market = Market::firstOrCreate(
            ['code' => 'MKT001'],
            [
                'name' => 'Downtown Fresh',
                'owner_user_id' => $owner->id,
                'address' => '12 Freedom Square, Tbilisi',
                'is_active' => true,
            ]
        );

        $market->users()->syncWithoutDetaching([
            $owner->id => ['role' => 'owner'],
        ]);

        $items = [
            ['name' => 'Orange Juice', 'sku' => 'OJ-001', 'price' => 5.50, 'stock_qty' => 30],
            ['name' => 'Bakery Box', 'sku' => 'BK-010', 'price' => 12.00, 'stock_qty' => 18],
            ['name' => 'Fresh Salad', 'sku' => 'SL-204', 'price' => 8.75, 'stock_qty' => 22],
        ];

        foreach ($items as $item) {
            Item::firstOrCreate(
                ['market_id' => $market->id, 'sku' => $item['sku']],
                [
                    'name' => $item['name'],
                    'price' => $item['price'],
                    'discount_type' => 'none',
                    'discount_value' => 0,
                    'stock_qty' => $item['stock_qty'],
                    'is_active' => true,
                ]
            );
        }

        Shift::firstOrCreate(
            ['driver_id' => $driver->id, 'status' => 'ACTIVE'],
            [
                'started_at' => now()->subHour(),
            ]
        );

        LocationPing::create([
            'driver_id' => $driver->id,
            'lat' => 41.7151,
            'lng' => 44.8271,
            'speed' => 0,
            'heading' => 0,
        ]);
    }
}
