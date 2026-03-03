<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Order extends Model
{
    protected $fillable = [
        'code',
        'pickup_lat',
        'pickup_lng',
        'dropoff_lat',
        'dropoff_lng',
        'pickup_address',
        'dropoff_address',
        'time_window_start',
        'time_window_end',
        'priority',
        'size',
        'status',
    ];

    protected $casts = [
        'time_window_start' => 'datetime',
        'time_window_end' => 'datetime',
    ];

    public function events()
    {
        return $this->hasMany(OrderEvent::class);
    }
}
