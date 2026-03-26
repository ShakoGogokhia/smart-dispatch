<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('promo_codes', function (Blueprint $table) {
            $table->dropForeign(['market_id']);
        });

        Schema::table('promo_codes', function (Blueprint $table) {
            $table->unsignedBigInteger('market_id')->nullable()->change();
            $table->foreign('market_id')->references('id')->on('markets')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('promo_codes', function (Blueprint $table) {
            $table->dropForeign(['market_id']);
        });

        Schema::table('promo_codes', function (Blueprint $table) {
            $table->unsignedBigInteger('market_id')->nullable(false)->change();
            $table->foreign('market_id')->references('id')->on('markets')->cascadeOnDelete();
        });
    }
};
