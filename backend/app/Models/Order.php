<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = [
        'market_id',
        'customer_user_id',
        'assigned_driver_id',
        'offered_driver_id',
        'code',
        'pickup_lat',
        'pickup_lng',
        'dropoff_lat',
        'dropoff_lng',
        'pickup_address',
        'dropoff_address',
        'customer_name',
        'customer_phone',
        'promo_code',
        'notes',
        'weather_condition',
        'time_window_start',
        'time_window_end',
        'priority',
        'size',
        'subtotal',
        'discount_total',
        'total',
        'status',
        'market_accepted_at',
        'ready_for_pickup_at',
        'offer_sent_at',
        'accepted_at',
        'picked_up_at',
        'delivered_at',
        'promised_at',
        'estimated_delivery_at',
        'driver_distance_km',
        'driver_weather_multiplier',
        'driver_earning_amount',
        'cancellation_requested_at',
        'cancellation_reason',
        'proof_of_delivery_note',
        'proof_of_delivery_photo_url',
        'customer_rating',
        'customer_feedback',
    ];

    protected $casts = [
        'time_window_start' => 'datetime',
        'time_window_end' => 'datetime',
        'market_accepted_at' => 'datetime',
        'ready_for_pickup_at' => 'datetime',
        'offer_sent_at' => 'datetime',
        'accepted_at' => 'datetime',
        'picked_up_at' => 'datetime',
        'delivered_at' => 'datetime',
        'promised_at' => 'datetime',
        'estimated_delivery_at' => 'datetime',
        'cancellation_requested_at' => 'datetime',
        'driver_distance_km' => 'decimal:2',
        'driver_weather_multiplier' => 'decimal:2',
        'driver_earning_amount' => 'decimal:2',
    ];

    public function events()
    {
        return $this->hasMany(OrderEvent::class);
    }

    public function market()
    {
        return $this->belongsTo(Market::class);
    }

    public function customer()
    {
        return $this->belongsTo(User::class, 'customer_user_id');
    }

    public function assignedDriver()
    {
        return $this->belongsTo(Driver::class, 'assigned_driver_id');
    }

    public function offeredDriver()
    {
        return $this->belongsTo(Driver::class, 'offered_driver_id');
    }

    public function items()
    {
        return $this->hasMany(OrderItem::class);
    }

    public function declines()
    {
        return $this->hasMany(OrderDriverDecline::class);
    }
}
