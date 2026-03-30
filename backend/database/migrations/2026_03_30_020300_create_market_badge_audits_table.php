<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('market_badge_audits', function (Blueprint $table) {
            $table->id();
            $table->foreignId('market_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('action')->default('updated');
            $table->string('previous_badge')->nullable();
            $table->string('next_badge')->nullable();
            $table->timestamp('previous_badge_expires_at')->nullable();
            $table->timestamp('next_badge_expires_at')->nullable();
            $table->timestamps();

            $table->index(['market_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('market_badge_audits');
    }
};
