<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->string('payment_method')->default('cash_on_delivery')->after('total');
            $table->string('payment_status')->default('pending')->after('payment_method');
            $table->string('payment_reference')->nullable()->after('payment_status');
            $table->decimal('payment_amount', 10, 2)->nullable()->after('payment_reference');
            $table->timestamp('paid_at')->nullable()->after('payment_amount');
            $table->timestamp('payment_failed_at')->nullable()->after('paid_at');
            $table->string('payment_failure_reason')->nullable()->after('payment_failed_at');
            $table->decimal('refunded_amount', 10, 2)->default(0)->after('payment_failure_reason');
            $table->timestamp('refunded_at')->nullable()->after('refunded_amount');
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropColumn([
                'payment_method',
                'payment_status',
                'payment_reference',
                'payment_amount',
                'paid_at',
                'payment_failed_at',
                'payment_failure_reason',
                'refunded_amount',
                'refunded_at',
            ]);
        });
    }
};
