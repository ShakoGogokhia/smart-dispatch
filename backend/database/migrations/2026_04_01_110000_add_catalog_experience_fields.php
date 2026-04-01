<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $table->json('delivery_slots')->nullable()->after('address');
            $table->string('approval_status')->default('approved')->after('delivery_slots');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->string('category')->nullable()->after('name');
            $table->string('image_url')->nullable()->after('category');
            $table->json('variants')->nullable()->after('image_url');
            $table->json('availability_schedule')->nullable()->after('variants');
            $table->unsignedInteger('low_stock_threshold')->default(5)->after('stock_qty');
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn([
                'category',
                'image_url',
                'variants',
                'availability_schedule',
                'low_stock_threshold',
            ]);
        });

        Schema::table('markets', function (Blueprint $table) {
            $table->dropColumn([
                'delivery_slots',
                'approval_status',
            ]);
        });
    }
};
