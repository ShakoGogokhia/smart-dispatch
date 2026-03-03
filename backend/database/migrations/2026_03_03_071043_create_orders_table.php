<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('orders', function (Blueprint $table) {
            $table->id();

            $table->string('code')->unique();

            $table->decimal('pickup_lat', 10, 7)->nullable();
            $table->decimal('pickup_lng', 10, 7)->nullable();
            $table->decimal('dropoff_lat', 10, 7);
            $table->decimal('dropoff_lng', 10, 7);

            $table->string('pickup_address')->nullable();
            $table->string('dropoff_address')->nullable();

            $table->dateTime('time_window_start')->nullable();
            $table->dateTime('time_window_end')->nullable();

            $table->unsignedTinyInteger('priority')->default(3); // 1 high, 5 low
            $table->decimal('size', 10, 2)->nullable();

            $table->string('status')->default('NEW');

            $table->timestamps();

            $table->index('status');
            $table->index('created_at');
        });
    }
    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('orders');
    }
};
