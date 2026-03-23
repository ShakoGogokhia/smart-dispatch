<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('market_accepted_at')->nullable()->after('status');
            $table->timestamp('ready_for_pickup_at')->nullable()->after('market_accepted_at');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'market_accepted_at',
                'ready_for_pickup_at',
            ]);
        });
    }
};
