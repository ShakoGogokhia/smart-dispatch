<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $table->string('market_type', 40)->default('general')->index()->after('code');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->json('multi_buy')->nullable()->after('discount_value');
            $table->json('specs')->nullable()->after('combo_offers');
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn(['multi_buy', 'specs']);
        });

        Schema::table('markets', function (Blueprint $table) {
            $table->dropIndex(['market_type']);
            $table->dropColumn('market_type');
        });
    }
};
