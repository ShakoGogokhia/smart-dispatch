<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('driver_transactions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->foreignId('order_id')->nullable()->constrained()->nullOnDelete();
            $table->string('type', 30)->default('delivery_earning');
            $table->decimal('amount', 10, 2);
            $table->decimal('distance_km', 10, 2)->nullable();
            $table->decimal('weather_multiplier', 8, 2)->nullable();
            $table->string('weather_condition', 20)->nullable();
            $table->string('description', 255)->nullable();
            $table->timestamps();

            $table->unique(['driver_id', 'order_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('driver_transactions');
    }
};
