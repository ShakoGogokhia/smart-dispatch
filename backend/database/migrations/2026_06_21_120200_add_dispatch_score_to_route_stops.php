<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('route_stops', 'dispatch_score')) {
            return;
        }

        Schema::table('route_stops', function (Blueprint $table) {
            $table->decimal('dispatch_score', 8, 2)->nullable()->after('status');
        });
    }

    public function down(): void
    {
        Schema::table('route_stops', function (Blueprint $table) {
            $table->dropColumn('dispatch_score');
        });
    }
};
