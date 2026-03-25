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
            if (!Schema::hasColumn('markets', 'is_featured')) {
                $table->boolean('is_featured')->default(false)->after('is_active');
            }

            if (!Schema::hasColumn('markets', 'featured_badge')) {
                $table->string('featured_badge')->nullable()->after('is_featured');
            }

            if (!Schema::hasColumn('markets', 'featured_headline')) {
                $table->string('featured_headline')->nullable()->after('featured_badge');
            }

            if (!Schema::hasColumn('markets', 'featured_copy')) {
                $table->string('featured_copy', 255)->nullable()->after('featured_headline');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $dropColumns = array_values(array_filter([
                Schema::hasColumn('markets', 'is_featured') ? 'is_featured' : null,
                Schema::hasColumn('markets', 'featured_badge') ? 'featured_badge' : null,
                Schema::hasColumn('markets', 'featured_headline') ? 'featured_headline' : null,
                Schema::hasColumn('markets', 'featured_copy') ? 'featured_copy' : null,
            ]));

            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
