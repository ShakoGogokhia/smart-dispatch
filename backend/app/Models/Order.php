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
        'time_window_start',
        'time_window_end',
        'priority',
        'size',
        'subtotal',
        'discount_total',
        'total',
        'status',
        'offer_sent_at',
        'accepted_at',
        'picked_up_at',
        'delivered_at',
    ];

    protected $casts = [
        'time_window_start' => 'datetime',
        'time_window_end' => 'datetime',
        'offer_sent_at' => 'datetime',
        'accepted_at' => 'datetime',
        'picked_up_at' => 'datetime',
        'delivered_at' => 'datetime',
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
