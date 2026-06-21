<?php

namespace Tests\Feature;

use App\Models\Order;
use App\Models\SupportTicket;
use App\Models\User;
use Database\Seeders\RolesSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class PaymentAndSupportTest extends TestCase
{
    use RefreshDatabase;

    public function test_customer_can_simulate_mock_card_payment(): void
    {
        $this->seed(RolesSeeder::class);

        $customer = User::factory()->create(['password' => '123456']);
        $customer->assignRole('customer');
        $order = $this->createCustomerOrder($customer);

        $this->withToken($customer->createToken('payment')->plainTextToken)
            ->postJson("/api/orders/{$order->id}/payment/simulate", ['method' => 'mock_card'])
            ->assertOk()
            ->assertJsonPath('payment_status', 'paid')
            ->assertJsonPath('payment_method', 'mock_card');

        $this->assertDatabaseHas('audit_logs', [
            'action' => 'payment.simulated',
            'auditable_id' => $order->id,
        ]);
    }

    public function test_customer_can_create_support_ticket_and_reply(): void
    {
        $this->seed(RolesSeeder::class);

        $customer = User::factory()->create(['password' => '123456']);
        $customer->assignRole('customer');
        $order = $this->createCustomerOrder($customer);
        $token = $customer->createToken('support')->plainTextToken;

        $response = $this->withToken($token)
            ->postJson('/api/support-tickets', [
                'order_id' => $order->id,
                'subject' => 'Missing item',
                'description' => 'The drink was missing.',
            ])
            ->assertCreated()
            ->assertJsonPath('subject', 'Missing item');

        $ticketId = $response->json('id');

        $this->withToken($token)
            ->postJson("/api/support-tickets/{$ticketId}/messages", [
                'message' => 'Please check the receipt.',
            ])
            ->assertCreated()
            ->assertJsonPath('message', 'Please check the receipt.');

        $this->assertDatabaseHas('support_tickets', [
            'id' => $ticketId,
            'status' => 'open',
        ]);
        $this->assertSame(2, SupportTicket::find($ticketId)->messages()->count());
    }

    private function createCustomerOrder(User $customer): Order
    {
        return Order::create([
            'customer_user_id' => $customer->id,
            'code' => 'ORD-PAY-SUPPORT',
            'receipt_number' => 'RCT-PAY-SUPPORT',
            'customer_name' => $customer->name,
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
            'status' => 'MARKET_PENDING',
            'estimated_delivery_at' => now()->addMinutes(30),
            'promised_at' => now()->addMinutes(45),
            'weather_condition' => 'clear',
        ]);
    }
}
