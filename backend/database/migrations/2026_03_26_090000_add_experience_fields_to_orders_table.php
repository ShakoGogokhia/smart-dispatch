<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->timestamp('promised_at')->nullable()->after('delivered_at');
            $table->timestamp('estimated_delivery_at')->nullable()->after('promised_at');
            $table->timestamp('cancellation_requested_at')->nullable()->after('estimated_delivery_at');
            $table->string('cancellation_reason')->nullable()->after('cancellation_requested_at');
            $table->text('proof_of_delivery_note')->nullable()->after('cancellation_reason');
            $table->string('proof_of_delivery_photo_url')->nullable()->after('proof_of_delivery_note');
            $table->unsignedTinyInteger('customer_rating')->nullable()->after('proof_of_delivery_photo_url');
            $table->text('customer_feedback')->nullable()->after('customer_rating');

            $table->index(['promised_at']);
            $table->index(['customer_rating']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropIndex(['promised_at']);
            $table->dropIndex(['customer_rating']);
            $table->dropColumn([
                'promised_at',
                'estimated_delivery_at',
                'cancellation_requested_at',
                'cancellation_reason',
                'proof_of_delivery_note',
                'proof_of_delivery_photo_url',
                'customer_rating',
                'customer_feedback',
            ]);
        });
    }
};
