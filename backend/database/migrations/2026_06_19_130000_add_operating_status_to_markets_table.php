<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $table->json('operating_hours')->nullable()->after('delivery_slots');
            $table->boolean('uses_operating_schedule')->default(false)->after('operating_hours');
            $table->boolean('is_manually_closed')->default(false)->after('uses_operating_schedule');
            $table->string('manual_close_comment')->nullable()->after('is_manually_closed');
        });
    }

    public function down(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $table->dropColumn(['operating_hours', 'uses_operating_schedule', 'is_manually_closed', 'manual_close_comment']);
        });
    }
};
