<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $table->timestamp('promotion_starts_at')->nullable()->after('approval_status');
            $table->timestamp('promotion_ends_at')->nullable()->after('promotion_starts_at');
        });

        Schema::table('items', function (Blueprint $table) {
            $table->boolean('is_promoted')->default(false)->after('is_active');
            $table->timestamp('promotion_starts_at')->nullable()->after('is_promoted');
            $table->timestamp('promotion_ends_at')->nullable()->after('promotion_starts_at');
        });
    }

    public function down(): void
    {
        Schema::table('items', function (Blueprint $table) {
            $table->dropColumn([
                'is_promoted',
                'promotion_starts_at',
                'promotion_ends_at',
            ]);
        });

        Schema::table('markets', function (Blueprint $table) {
            $table->dropColumn([
                'promotion_starts_at',
                'promotion_ends_at',
            ]);
        });
    }
};
