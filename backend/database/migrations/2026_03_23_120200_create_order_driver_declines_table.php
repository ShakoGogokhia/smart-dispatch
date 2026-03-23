<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('order_driver_declines', function (Blueprint $table) {
            $table->id();
            $table->foreignId('order_id')->constrained()->cascadeOnDelete();
            $table->foreignId('driver_id')->constrained()->cascadeOnDelete();
            $table->timestamp('declined_at');
            $table->timestamps();

            $table->unique(['order_id', 'driver_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('order_driver_declines');
    }
};
