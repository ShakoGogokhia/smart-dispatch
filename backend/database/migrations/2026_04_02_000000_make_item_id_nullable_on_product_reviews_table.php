<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (!Schema::hasTable('product_reviews')) {
            return;
        }

        Schema::table('product_reviews', function (Blueprint $table) {
            $table->foreignId('item_id')->nullable()->change();
        });
    }

    public function down(): void
    {
        if (!Schema::hasTable('product_reviews')) {
            return;
        }

        DB::table('product_reviews')->whereNull('item_id')->delete();

        Schema::table('product_reviews', function (Blueprint $table) {
            $table->foreignId('item_id')->nullable(false)->change();
        });
    }
};
