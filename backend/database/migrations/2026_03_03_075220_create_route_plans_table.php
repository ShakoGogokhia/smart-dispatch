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
        Schema::create('route_plans', function (Blueprint $table) {
            $table->id();

            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->date('route_date');

            $table->string('status')->default('PLANNED'); // PLANNED, ASSIGNED, IN_PROGRESS, DONE

            $table->decimal('planned_distance_km', 10, 2)->nullable();
            $table->unsignedInteger('planned_duration_min')->nullable();

            $table->timestamps();

            $table->index(['route_date', 'status']);
            $table->index('driver_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('route_plans');
    }
};
