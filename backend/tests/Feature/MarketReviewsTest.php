<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Market;
use App\Models\ProductReview;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketReviewsTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_market_reviews_only_return_market_level_reviews(): void
    {
        $owner = User::factory()->create();
        $reviewer = User::factory()->create();

        $market = Market::create([
            'name' => 'Harbor Market',
            'code' => 'HBR001',
            'owner_user_id' => $owner->id,
            'is_active' => true,
        ]);

        $item = Item::create([
            'market_id' => $market->id,
            'name' => 'Cold Brew',
            'sku' => 'CB-01',
            'price' => 4.75,
            'stock_qty' => 20,
            'is_active' => true,
        ]);

        ProductReview::create([
            'item_id' => $item->id,
            'market_id' => $market->id,
            'user_id' => $reviewer->id,
            'rating' => 2,
            'comment' => 'Item review only',
        ]);

        ProductReview::create([
            'item_id' => null,
            'market_id' => $market->id,
            'user_id' => $reviewer->id,
            'rating' => 5,
            'comment' => 'Excellent market experience',
        ]);

        $this->getJson("/api/public/markets/{$market->id}")
            ->assertOk()
            ->assertJsonPath('review_summary.count', 1)
            ->assertJsonPath('review_summary.average', 5);

        $this->getJson("/api/public/markets/{$market->id}/reviews")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.comment', 'Excellent market experience')
            ->assertJsonPath('0.rating', 5);
    }

    public function test_authenticated_users_can_submit_market_reviews_without_comment(): void
    {
        $owner = User::factory()->create();
        $customer = User::factory()->create();

        $market = Market::create([
            'name' => 'Night Market',
            'code' => 'NGT001',
            'owner_user_id' => $owner->id,
            'is_active' => true,
        ]);

        $token = $customer->createToken('market-review')->plainTextToken;

        $this->withToken($token)
            ->postJson("/api/markets/{$market->id}/reviews", [
                'rating' => 4,
            ])
            ->assertCreated()
            ->assertJsonPath('rating', 4)
            ->assertJsonPath('comment', null);

        $this->assertDatabaseHas('product_reviews', [
            'market_id' => $market->id,
            'item_id' => null,
            'user_id' => $customer->id,
            'rating' => 4,
        ]);
    }
}
