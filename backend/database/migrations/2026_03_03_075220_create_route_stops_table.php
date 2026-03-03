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
        Schema::create('route_stops', function (Blueprint $table) {
            $table->id();

            $table->foreignId('route_plan_id')->constrained('route_plans')->cascadeOnDelete();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();

            $table->unsignedInteger('sequence'); // 1..N
            $table->dateTime('eta')->nullable();

            $table->string('status')->default('PENDING'); // PENDING, DONE, SKIPPED

            $table->timestamps();

            $table->unique(['route_plan_id', 'order_id']);
            $table->index(['route_plan_id', 'sequence']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('route_stops');
    }
};
