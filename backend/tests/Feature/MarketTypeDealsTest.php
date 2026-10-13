<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Market;
use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketTypeDealsTest extends TestCase
{
    use RefreshDatabase;

    private function market(string $type, User $owner): Market
    {
        return Market::create([
            'name' => ucfirst($type) . ' Market',
            'code' => strtoupper($type),
            'market_type' => $type,
            'owner_user_id' => $owner->id,
            'is_active' => true,
        ]);
    }

    private function owner(): User
    {
        $this->seed(RolesSeeder::class);
        $owner = User::factory()->create();
        $owner->assignRole('owner');

        return $owner;
    }

    public function test_paid_quantity_follows_buy_x_get_y(): void
    {
        $item = new Item(['multi_buy' => ['buy' => 1, 'get' => 1]]);
        $this->assertSame(1, $item->paidQuantity(1));
        $this->assertSame(1, $item->paidQuantity(2));
        $this->assertSame(3, $item->paidQuantity(5));

        $item->multi_buy = ['buy' => 2, 'get' => 1];
        $this->assertSame(2, $item->paidQuantity(3));
        $this->assertSame(5, $item->paidQuantity(7));

        $item->multi_buy = null;
        $this->assertSame(4, $item->paidQuantity(4));
    }

    public function test_order_line_total_applies_one_plus_one_deal(): void
    {
        $owner = User::factory()->create();
        $customer = User::factory()->create();
        $market = $this->market('grocery', $owner);

        $item = Item::create([
            'market_id' => $market->id,
            'name' => 'Greek Yogurt',
            'sku' => 'YOG-1',
            'price' => 4,
            'stock_qty' => 20,
            'is_active' => true,
            'multi_buy' => ['buy' => 1, 'get' => 1],
        ]);

        $this->withToken($customer->createToken('t')->plainTextToken)
            ->postJson('/api/orders', [
                'market_id' => $market->id,
                'dropoff_lat' => 41.72,
                'dropoff_lng' => 44.82,
                'dropoff_address' => 'Customer address',
                'customer_name' => 'Customer User',
                'customer_phone' => '55512345',
                'items' => [['item_id' => $item->id, 'qty' => 3, 'price' => 4]],
            ])
            ->assertCreated()
            ->assertJsonPath('items.0.qty', 3)
            ->assertJsonPath('items.0.line_total', fn ($total) => (float) $total === 8.0);
    }

    public function test_owner_can_add_deal_only_when_market_type_allows_it(): void
    {
        $owner = $this->owner();
        $token = $owner->createToken('t')->plainTextToken;
        $grocery = $this->market('grocery', $owner);
        $auto = $this->market('auto_parts', $owner);

        $this->withToken($token)
            ->postJson("/api/markets/{$grocery->id}/items", [
                'name' => 'Bananas',
                'sku' => 'BAN-1',
                'price' => 3,
                'multi_buy' => ['buy' => 2, 'get' => 1],
            ])
            ->assertCreated()
            ->assertJsonPath('multi_buy.buy', 2)
            ->assertJsonPath('multi_buy.get', 1);

        $this->withToken($token)
            ->postJson("/api/markets/{$auto->id}/items", [
                'name' => 'Brake Pads',
                'sku' => 'BRK-1',
                'price' => 60,
                'multi_buy' => ['buy' => 1, 'get' => 1],
            ])
            ->assertStatus(422)
            ->assertJsonValidationErrors('multi_buy');

        $this->withToken($token)
            ->postJson("/api/markets/{$auto->id}/items", [
                'name' => 'Brake Pads',
                'sku' => 'BRK-1',
                'price' => 60,
                'specs' => [
                    ['label' => 'Fits', 'value' => 'Toyota Camry 2018-2023'],
                    ['label' => 'Warranty', 'value' => ''],
                ],
            ])
            ->assertCreated()
            ->assertJsonCount(1, 'specs')
            ->assertJsonPath('specs.0.label', 'Fits');
    }

    public function test_owner_can_change_market_type_but_not_to_unknown_value(): void
    {
        $owner = $this->owner();
        $token = $owner->createToken('t')->plainTextToken;
        $market = $this->market('general', $owner);

        $this->withToken($token)
            ->patchJson("/api/markets/{$market->id}/settings", ['market_type' => 'electronics'])
            ->assertOk()
            ->assertJsonPath('market_type', 'electronics');

        $this->withToken($token)
            ->patchJson("/api/markets/{$market->id}/settings", ['market_type' => 'spaceships'])
            ->assertStatus(422);

        $this->getJson('/api/public/markets')
            ->assertOk()
            ->assertJsonPath('0.market_type', 'electronics');
    }
}
