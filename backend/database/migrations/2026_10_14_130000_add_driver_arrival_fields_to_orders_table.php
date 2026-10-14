<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            // Driver step-by-step flow: arrived at the market, then arrived at the customer.
            $table->timestamp('arrived_at_pickup_at')->nullable()->after('accepted_at');
            $table->timestamp('arrived_at_dropoff_at')->nullable()->after('picked_up_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn(['arrived_at_pickup_at', 'arrived_at_dropoff_at']);
        });
    }
};
