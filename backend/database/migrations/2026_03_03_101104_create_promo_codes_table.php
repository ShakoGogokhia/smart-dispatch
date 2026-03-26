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
        Schema::create('promo_codes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('market_id')->nullable()->constrained()->nullOnDelete();
            $table->string('code');
            $table->enum('type', ['percent', 'fixed']);
            $table->decimal('value', 10, 2);
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->integer('max_uses')->nullable();
            $table->integer('uses')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['market_id', 'code']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('promo_codes');
    }
};
