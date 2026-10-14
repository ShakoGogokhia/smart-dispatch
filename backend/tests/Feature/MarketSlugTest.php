<?php

namespace Tests\Feature;

use App\Models\Market;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class MarketSlugTest extends TestCase
{
    use RefreshDatabase;

    private function makeMarket(string $name, string $code): Market
    {
        return Market::create([
            'name' => $name,
            'code' => $code,
            'owner_user_id' => User::factory()->create()->id,
            'is_active' => true,
        ]);
    }

    public function test_markets_get_unique_url_friendly_slugs(): void
    {
        $first = $this->makeMarket('Downtown Fresh', 'MKT001');
        $second = $this->makeMarket('Downtown Fresh', 'MKT002');
        $numeric = $this->makeMarket('24', 'MKT003');

        $this->assertSame('downtown-fresh', $first->slug);
        $this->assertSame('downtown-fresh-2', $second->slug);
        $this->assertSame('market-24', $numeric->slug);
    }

    public function test_public_market_resolves_by_slug_and_by_id(): void
    {
        $market = $this->makeMarket('Downtown Fresh', 'MKT001');

        $this->getJson('/api/public/markets/downtown-fresh')
            ->assertOk()
            ->assertJsonPath('id', $market->id)
            ->assertJsonPath('slug', 'downtown-fresh');

        $this->getJson("/api/public/markets/{$market->id}")
            ->assertOk()
            ->assertJsonPath('slug', 'downtown-fresh');

        $this->getJson('/api/public/markets/downtown-fresh/items')->assertOk();
        $this->getJson('/api/public/markets/no-such-market')->assertNotFound();
    }
}
