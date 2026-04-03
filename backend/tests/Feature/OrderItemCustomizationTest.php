<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Market;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderItemCustomizationTest extends TestCase
{
    use RefreshDatabase;

    public function test_order_items_store_only_removable_ingredient_customizations(): void
    {
        $owner = User::factory()->create();
        $customer = User::factory()->create();

        $market = Market::create([
            'name' => 'Garden Kitchen',
            'code' => 'GRD001',
            'owner_user_id' => $owner->id,
            'is_active' => true,
            'address' => '12 Market Street',
            'lat' => 41.7151,
            'lng' => 44.8271,
        ]);

        $item = Item::create([
            'market_id' => $market->id,
            'name' => 'Veggie Wrap',
            'sku' => 'WRAP-01',
            'price' => 11.25,
            'stock_qty' => 10,
            'is_active' => true,
            'ingredients' => [
                ['name' => 'Tortilla', 'removable' => false],
                ['name' => 'Onion', 'removable' => true],
                ['name' => 'Parsley', 'removable' => true],
            ],
        ]);

        $token = $customer->createToken('order-customization')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/orders', [
            'market_id' => $market->id,
            'dropoff_lat' => 41.72,
            'dropoff_lng' => 44.82,
            'dropoff_address' => 'Customer address',
            'customer_name' => 'Customer User',
            'customer_phone' => '55512345',
            'items' => [
                [
                    'item_id' => $item->id,
                    'qty' => 1,
                    'price' => 11.25,
                    'removed_ingredients' => ['Onion', 'Tortilla', 'Parsley'],
                ],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('items.0.name', 'Veggie Wrap')
            ->assertJsonPath('items.0.removed_ingredients.0', 'Onion')
            ->assertJsonPath('items.0.removed_ingredients.1', 'Parsley')
            ->assertJsonMissingPath('items.0.removed_ingredients.2');

        $orderItem = OrderItem::query()->firstOrFail();

        $this->assertSame(['Onion', 'Parsley'], $orderItem->removed_ingredients);
        $this->assertCount(3, $orderItem->ingredients ?? []);
    }

    public function test_order_items_store_selected_combo_offer_and_combo_price(): void
    {
        $owner = User::factory()->create();
        $customer = User::factory()->create();

        $market = Market::create([
            'name' => 'Combo Kitchen',
            'code' => 'CMB001',
            'owner_user_id' => $owner->id,
            'is_active' => true,
            'address' => '44 Combo Street',
            'lat' => 41.7151,
            'lng' => 44.8271,
        ]);

        $item = Item::create([
            'market_id' => $market->id,
            'name' => 'Burger',
            'sku' => 'BRG-01',
            'price' => 15.00,
            'stock_qty' => 20,
            'is_active' => true,
            'combo_offers' => [
                [
                    'name' => 'Burger Combo',
                    'description' => 'Fries and drink included',
                    'combo_price' => 12.50,
                ],
            ],
        ]);

        $token = $customer->createToken('order-combo')->plainTextToken;

        $response = $this->withToken($token)->postJson('/api/orders', [
            'market_id' => $market->id,
            'dropoff_lat' => 41.72,
            'dropoff_lng' => 44.82,
            'dropoff_address' => 'Customer address',
            'customer_name' => 'Customer User',
            'customer_phone' => '55512345',
            'items' => [
                [
                    'item_id' => $item->id,
                    'qty' => 2,
                    'price' => 15.00,
                    'combo_offer' => [
                        'name' => 'Burger Combo',
                        'description' => 'Ignored client description',
                        'combo_price' => 10.00,
                    ],
                ],
            ],
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('items.0.unit_price', 12.5)
            ->assertJsonPath('items.0.line_total', 25)
            ->assertJsonPath('items.0.combo_offer.name', 'Burger Combo')
            ->assertJsonPath('receipt.items.0.combo_offer.name', 'Burger Combo');

        $orderItem = OrderItem::query()->latest('id')->firstOrFail();

        $this->assertSame(12.5, (float) $orderItem->unit_price);
        $this->assertSame(25.0, (float) $orderItem->line_total);
        $this->assertSame('Burger Combo', $orderItem->combo_offer['name'] ?? null);
        $this->assertSame(12.5, (float) ($orderItem->combo_offer['combo_price'] ?? 0));
    }
}
