<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->json('combo_offers')->nullable()->after('ingredients');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->json('combo_offer')->nullable()->after('removed_ingredients');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn('combo_offer');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn('combo_offers');
        });
    }
};
