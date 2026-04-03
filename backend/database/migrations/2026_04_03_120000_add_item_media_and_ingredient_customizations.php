<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->string('image_path')->nullable()->after('image_url');
            $table->json('ingredients')->nullable()->after('availability_schedule');
        });

        Schema::table('order_items', function (Blueprint $table) {
            $table->json('ingredients')->nullable()->after('line_total');
            $table->json('removed_ingredients')->nullable()->after('ingredients');
        });
    }

    public function down(): void
    {
        Schema::table('order_items', function (Blueprint $table) {
            $table->dropColumn([
                'ingredients',
                'removed_ingredients',
            ]);
        });

        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn([
                'image_path',
                'ingredients',
            ]);
        });
    }
};
