<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('drivers', function (Blueprint $table) {
            $table->decimal('balance', 10, 2)->default(0)->after('status');
            $table->decimal('total_earned', 10, 2)->default(0)->after('balance');
        });

        Schema::table('markets', function (Blueprint $table) {
            $table->decimal('lat', 10, 7)->nullable()->after('address');
            $table->decimal('lng', 10, 7)->nullable()->after('lat');
        });

        Schema::table('orders', function (Blueprint $table) {
            $table->string('weather_condition', 20)->default('clear')->after('notes');
            $table->decimal('driver_distance_km', 10, 2)->nullable()->after('estimated_delivery_at');
            $table->decimal('driver_weather_multiplier', 8, 2)->nullable()->after('driver_distance_km');
            $table->decimal('driver_earning_amount', 10, 2)->nullable()->after('driver_weather_multiplier');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'weather_condition',
                'driver_distance_km',
                'driver_weather_multiplier',
                'driver_earning_amount',
            ]);
        });

        Schema::table('markets', function (Blueprint $table) {
            $table->dropColumn(['lat', 'lng']);
        });

        Schema::table('drivers', function (Blueprint $table) {
            $table->dropColumn(['balance', 'total_earned']);
        });
    }
};
