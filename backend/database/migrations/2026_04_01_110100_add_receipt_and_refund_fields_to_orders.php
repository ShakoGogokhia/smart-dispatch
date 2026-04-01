<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('receipt_number')->nullable()->after('code');
            $table->string('delivery_slot_label')->nullable()->after('time_window_end');
            $table->string('proof_of_delivery_signature_name')->nullable()->after('proof_of_delivery_photo_url');
            $table->timestamp('refund_requested_at')->nullable()->after('cancellation_requested_at');
            $table->string('refund_status')->default('none')->after('refund_requested_at');
            $table->string('refund_reason')->nullable()->after('refund_status');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'receipt_number',
                'delivery_slot_label',
                'proof_of_delivery_signature_name',
                'refund_requested_at',
                'refund_status',
                'refund_reason',
            ]);
        });
    }
};
