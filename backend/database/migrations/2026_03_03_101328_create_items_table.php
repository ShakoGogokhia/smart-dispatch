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
        Schema::create('items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('market_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('sku');
            $table->decimal('price', 10, 2);
            $table->enum('discount_type', ['none', 'percent', 'fixed'])->default('none');
            $table->decimal('discount_value', 10, 2)->default(0);
            $table->boolean('is_active')->default(true);
            $table->integer('stock_qty')->default(0);
            $table->timestamps();

            $table->unique(['market_id', 'sku']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('items');
    }
};
