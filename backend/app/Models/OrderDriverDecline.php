<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderDriverDecline extends Model
{
    protected $fillable = [
        'order_id',
        'driver_id',
        'declined_at',
    ];

    protected $casts = [
        'declined_at' => 'datetime',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }
}
