<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->foreignId('market_id')->nullable()->after('id')->constrained()->nullOnDelete();
            $table->foreignId('customer_user_id')->nullable()->after('market_id')->constrained('users')->nullOnDelete();
            $table->foreignId('assigned_driver_id')->nullable()->after('customer_user_id')->constrained('drivers')->nullOnDelete();
            $table->foreignId('offered_driver_id')->nullable()->after('assigned_driver_id')->constrained('drivers')->nullOnDelete();

            $table->string('customer_name')->nullable()->after('dropoff_address');
            $table->string('customer_phone')->nullable()->after('customer_name');
            $table->string('promo_code')->nullable()->after('customer_phone');
            $table->text('notes')->nullable()->after('promo_code');

            $table->decimal('subtotal', 10, 2)->default(0)->after('size');
            $table->decimal('discount_total', 10, 2)->default(0)->after('subtotal');
            $table->decimal('total', 10, 2)->default(0)->after('discount_total');

            $table->timestamp('offer_sent_at')->nullable()->after('status');
            $table->timestamp('accepted_at')->nullable()->after('offer_sent_at');
            $table->timestamp('picked_up_at')->nullable()->after('accepted_at');
            $table->timestamp('delivered_at')->nullable()->after('picked_up_at');

            $table->index(['market_id', 'created_at']);
            $table->index(['assigned_driver_id', 'status']);
            $table->index(['offered_driver_id', 'status']);
            $table->index(['customer_user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::table('orders', function (Blueprint $table) {
            $table->dropConstrainedForeignId('market_id');
            $table->dropConstrainedForeignId('customer_user_id');
            $table->dropConstrainedForeignId('assigned_driver_id');
            $table->dropConstrainedForeignId('offered_driver_id');
            $table->dropColumn([
                'customer_name',
                'customer_phone',
                'promo_code',
                'notes',
                'subtotal',
                'discount_total',
                'total',
                'offer_sent_at',
                'accepted_at',
                'picked_up_at',
                'delivered_at',
            ]);
        });
    }
};
