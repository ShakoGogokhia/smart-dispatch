<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('market_public_clicks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('market_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('visitor_key')->nullable();
            $table->string('source')->nullable();
            $table->timestamps();

            $table->index(['market_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('market_public_clicks');
    }
};
