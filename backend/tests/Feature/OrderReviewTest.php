<?php

namespace Tests\Feature;

use App\Models\Driver;
use App\Models\Item;
use App\Models\Market;
use App\Models\Order;
use App\Models\OrderItem;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OrderReviewTest extends TestCase
{
    use RefreshDatabase;

    private Market $market;
    private Item $item;
    private Item $otherItem;
    private User $customer;

    protected function setUp(): void
    {
        parent::setUp();

        $this->market = Market::create([
            'name' => 'Harbor Market',
            'code' => 'HBR001',
            'owner_user_id' => User::factory()->create()->id,
            'is_active' => true,
        ]);
        $this->item = $this->makeItem('Cold Brew', 'CB-01');
        $this->otherItem = $this->makeItem('Bagel', 'BG-01');
        $this->customer = User::factory()->create();
    }

    private function makeItem(string $name, string $sku): Item
    {
        return Item::create([
            'market_id' => $this->market->id,
            'name' => $name,
            'sku' => $sku,
            'price' => 4.75,
            'stock_qty' => 20,
            'is_active' => true,
        ]);
    }

    private function makeOrder(string $status, ?int $driverId = null): Order
    {
        static $n = 0;
        $n++;

        $order = Order::create([
            'market_id' => $this->market->id,
            'customer_user_id' => $this->customer->id,
            'assigned_driver_id' => $driverId,
            'code' => "ORD-RV-{$n}",
            'customer_name' => $this->customer->name,
            'customer_phone' => '555-0100',
            'pickup_lat' => 41.7151,
            'pickup_lng' => 44.8271,
            'dropoff_lat' => 41.7211,
            'dropoff_lng' => 44.8011,
            'pickup_address' => 'Pickup point',
            'dropoff_address' => 'Dropoff point',
            'priority' => 2,
            'size' => 1,
            'subtotal' => 9.5,
            'discount_total' => 0,
            'total' => 9.5,
            'status' => $status,
        ]);

        OrderItem::create([
            'order_id' => $order->id,
            'item_id' => $this->item->id,
            'name' => $this->item->name,
            'sku' => $this->item->sku,
            'qty' => 2,
            'unit_price' => 4.75,
            'line_total' => 9.5,
        ]);

        return $order;
    }

    private function asCustomer()
    {
        return $this->withToken($this->customer->createToken('t')->plainTextToken);
    }

    public function test_customers_without_a_delivered_order_cannot_review(): void
    {
        $this->makeOrder('PICKED_UP');

        $this->asCustomer()->postJson("/api/markets/{$this->market->id}/reviews", ['rating' => 5])->assertForbidden();
        $this->asCustomer()->postJson("/api/items/{$this->item->id}/reviews", ['rating' => 5])->assertForbidden();

        $this->asCustomer()->getJson("/api/markets/{$this->market->id}/review-eligibility")
            ->assertOk()
            ->assertJsonPath('can_review_market', false)
            ->assertJsonPath('reviewable_item_ids', []);
    }

    public function test_only_items_from_delivered_orders_can_be_reviewed_and_reviews_update(): void
    {
        $this->makeOrder('DELIVERED');

        $this->asCustomer()->getJson("/api/markets/{$this->market->id}/review-eligibility")
            ->assertJsonPath('can_review_market', true)
            ->assertJsonPath('reviewable_item_ids', [$this->item->id]);

        $this->asCustomer()->postJson("/api/items/{$this->otherItem->id}/reviews", ['rating' => 5])->assertForbidden();

        $this->asCustomer()->postJson("/api/items/{$this->item->id}/reviews", ['rating' => 3])->assertCreated();
        $this->asCustomer()->postJson("/api/items/{$this->item->id}/reviews", ['rating' => 5, 'comment' => 'Better'])->assertOk();

        $this->assertDatabaseCount('product_reviews', 1);
        $this->assertDatabaseHas('product_reviews', ['item_id' => $this->item->id, 'rating' => 5, 'comment' => 'Better']);
    }

    public function test_rate_your_order_saves_item_market_and_courier_reviews(): void
    {
        $driverUser = User::factory()->create(['name' => 'Dina Driver']);
        $driver = Driver::create(['user_id' => $driverUser->id, 'status' => 'offline']);
        $order = $this->makeOrder('DELIVERED', $driver->id);

        $this->asCustomer()->getJson("/api/orders/{$order->id}/review")
            ->assertOk()
            ->assertJsonPath('can_review', true)
            ->assertJsonPath('is_complete', false)
            ->assertJsonPath('items.0.item_id', $this->item->id)
            ->assertJsonPath('items.0.review', null)
            ->assertJsonPath('driver.name', 'Dina Driver');

        $this->asCustomer()->postJson("/api/orders/{$order->id}/review", [
            'items' => [['item_id' => $this->item->id, 'rating' => 4, 'comment' => 'Tasty']],
            'market' => ['rating' => 5, 'comment' => 'Fast and friendly'],
            'driver' => ['rating' => 5],
        ])
            ->assertOk()
            ->assertJsonPath('is_complete', true)
            ->assertJsonPath('items.0.review.rating', 4)
            ->assertJsonPath('market.review.comment', 'Fast and friendly')
            ->assertJsonPath('driver.review.rating', 5);

        $this->assertDatabaseHas('product_reviews', ['item_id' => $this->item->id, 'order_id' => $order->id, 'rating' => 4]);
        $this->assertDatabaseHas('product_reviews', ['item_id' => null, 'market_id' => $this->market->id, 'rating' => 5]);
        $this->assertSame(5, (int) $order->fresh()->customer_rating);

        // Shows up in the public storefront reviews.
        $this->getJson("/api/public/items/{$this->item->id}/reviews")->assertJsonPath('0.comment', 'Tasty');
        $this->getJson("/api/public/markets/{$this->market->id}/reviews")->assertJsonPath('0.comment', 'Fast and friendly');
    }

    public function test_rate_your_order_rejects_undelivered_orders_foreign_items_and_other_customers(): void
    {
        $pending = $this->makeOrder('ASSIGNED');
        $this->asCustomer()->postJson("/api/orders/{$pending->id}/review", ['market' => ['rating' => 5]])->assertStatus(422);

        $delivered = $this->makeOrder('DELIVERED');
        $this->asCustomer()->postJson("/api/orders/{$delivered->id}/review", [
            'items' => [['item_id' => $this->otherItem->id, 'rating' => 5]],
        ])->assertStatus(422);

        $this->asCustomer()->postJson("/api/orders/{$delivered->id}/review", ['driver' => ['rating' => 5]])->assertStatus(422);

        $stranger = User::factory()->create();
        $this->app['auth']->forgetGuards(); // the test client otherwise keeps the previous user
        $this->withToken($stranger->createToken('t')->plainTextToken)
            ->getJson("/api/orders/{$delivered->id}/review")
            ->assertForbidden();
    }
}
