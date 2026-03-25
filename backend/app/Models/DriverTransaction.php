<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DriverTransaction extends Model
{
    protected $fillable = [
        'driver_id',
        'order_id',
        'type',
        'amount',
        'distance_km',
        'weather_multiplier',
        'weather_condition',
        'description',
    ];

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }
}
