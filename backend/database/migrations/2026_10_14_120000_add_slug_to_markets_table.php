<?php

use App\Models\Market;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $table->string('slug')->nullable()->unique()->after('name');
        });

        // Backfill existing markets with unique, URL-friendly slugs.
        DB::table('markets')->orderBy('id')->select(['id', 'name', 'code'])->get()->each(function ($market) {
            DB::table('markets')
                ->where('id', $market->id)
                ->update(['slug' => Market::uniqueSlug($market->name ?: $market->code, $market->id)]);
        });
    }

    public function down(): void
    {
        Schema::table('markets', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropColumn('slug');
        });
    }
};
