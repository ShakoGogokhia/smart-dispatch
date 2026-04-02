<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\Market;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PublicMarketItemsTest extends TestCase
{
    use RefreshDatabase;

    public function test_public_market_items_still_load_without_reviews_table(): void
    {
        $owner = User::factory()->create();

        $market = Market::create([
            'name' => 'Downtown Fresh',
            'code' => 'MKT001',
            'owner_user_id' => $owner->id,
            'is_active' => true,
        ]);

        Item::create([
            'market_id' => $market->id,
            'name' => 'Orange Juice',
            'sku' => 'OJ-001',
            'price' => 5.50,
            'stock_qty' => 30,
            'is_active' => true,
        ]);

        Schema::drop('product_reviews');

        $this->getJson("/api/public/markets/{$market->id}/items")
            ->assertOk()
            ->assertJsonCount(1)
            ->assertJsonPath('0.name', 'Orange Juice')
            ->assertJsonPath('0.review_summary.count', 0)
            ->assertJsonPath('0.review_summary.average', null);
    }
}
