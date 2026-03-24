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
        Schema::table('markets', function (Blueprint $table) {
            $table->boolean('is_featured')->default(false)->after('is_active');
            $table->string('featured_badge')->nullable()->after('is_featured');
            $table->string('featured_headline')->nullable()->after('featured_badge');
            $table->string('featured_copy', 255)->nullable()->after('featured_headline');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $table->dropColumn([
                'is_featured',
                'featured_badge',
                'featured_headline',
                'featured_copy',
            ]);
        });
    }
};
