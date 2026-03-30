<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            if (!Schema::hasColumn('markets', 'category')) {
                $table->string('category')->nullable()->after('address');
            }

            if (!Schema::hasColumn('markets', 'cover_path')) {
                $table->string('cover_path')->nullable()->after('logo_path');
            }

            if (!Schema::hasColumn('markets', 'minimum_order')) {
                $table->decimal('minimum_order', 10, 2)->default(0)->after('cover_path');
            }

            if (!Schema::hasColumn('markets', 'delivery_eta_minutes')) {
                $table->unsignedSmallInteger('delivery_eta_minutes')->nullable()->after('minimum_order');
            }

            if (!Schema::hasColumn('markets', 'featured_sort_order')) {
                $table->integer('featured_sort_order')->default(0)->after('delivery_eta_minutes');
            }

            if (!Schema::hasColumn('markets', 'badge_expires_at')) {
                $table->timestamp('badge_expires_at')->nullable()->after('featured_copy');
            }

            if (!Schema::hasColumn('markets', 'featured_starts_at')) {
                $table->timestamp('featured_starts_at')->nullable()->after('badge_expires_at');
            }

            if (!Schema::hasColumn('markets', 'featured_ends_at')) {
                $table->timestamp('featured_ends_at')->nullable()->after('featured_starts_at');
            }

            if (!Schema::hasColumn('markets', 'opens_at')) {
                $table->time('opens_at')->nullable()->after('featured_ends_at');
            }

            if (!Schema::hasColumn('markets', 'closes_at')) {
                $table->time('closes_at')->nullable()->after('opens_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $dropColumns = array_values(array_filter([
                Schema::hasColumn('markets', 'category') ? 'category' : null,
                Schema::hasColumn('markets', 'cover_path') ? 'cover_path' : null,
                Schema::hasColumn('markets', 'minimum_order') ? 'minimum_order' : null,
                Schema::hasColumn('markets', 'delivery_eta_minutes') ? 'delivery_eta_minutes' : null,
                Schema::hasColumn('markets', 'featured_sort_order') ? 'featured_sort_order' : null,
                Schema::hasColumn('markets', 'badge_expires_at') ? 'badge_expires_at' : null,
                Schema::hasColumn('markets', 'featured_starts_at') ? 'featured_starts_at' : null,
                Schema::hasColumn('markets', 'featured_ends_at') ? 'featured_ends_at' : null,
                Schema::hasColumn('markets', 'opens_at') ? 'opens_at' : null,
                Schema::hasColumn('markets', 'closes_at') ? 'closes_at' : null,
            ]));

            if ($dropColumns !== []) {
                $table->dropColumn($dropColumns);
            }
        });
    }
};
