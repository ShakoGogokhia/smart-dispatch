<?php

namespace Tests\Feature;

use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuthMeTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_can_fetch_authenticated_profile(): void
    {
        $this->seed(RolesSeeder::class);

        $user = User::factory()->create([
            'email' => 'admin@test.com',
            'password' => '123456',
            'language' => 'en',
        ]);
        $user->assignRole('admin');

        $loginResponse = $this->postJson('/api/login', [
            'email' => 'admin@test.com',
            'password' => '123456',
        ]);

        $loginResponse->assertOk()
            ->assertJsonPath('user.email', 'admin@test.com');

        $token = $loginResponse->json('token');

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('email', 'admin@test.com')
            ->assertJsonPath('notification_summary.unread', 0);
    }

    public function test_me_still_loads_when_optional_tables_are_unavailable(): void
    {
        $this->seed(RolesSeeder::class);

        $user = User::factory()->create([
            'email' => 'customer@test.com',
            'password' => '123456',
            'language' => 'en',
        ]);
        $user->assignRole('customer');

        Schema::shouldReceive('hasTable')
            ->once()
            ->with('driver_transactions')
            ->andReturn(false);

        Schema::shouldReceive('hasTable')
            ->once()
            ->with('app_notifications')
            ->andReturn(false);

        $this->withToken($user->createToken('test-token')->plainTextToken)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('email', 'customer@test.com')
            ->assertJsonPath('notification_summary.unread', 0)
            ->assertJsonPath('driver', null);
    }
}
