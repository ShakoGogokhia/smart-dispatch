<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RouteStop extends Model
{
    protected $fillable = [
        'route_plan_id','order_id','sequence','eta','status'
    ];

    protected $casts = [
        'eta' => 'datetime',
    ];

    public function routePlan() { return $this->belongsTo(RoutePlan::class); }
    public function order() { return $this->belongsTo(Order::class); }
}