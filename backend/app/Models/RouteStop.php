<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RouteStop extends Model
{
    protected $fillable = [
        'route_plan_id','order_id','sequence','eta','status','dispatch_score','dispatch_reason'
    ];

    protected $casts = [
        'eta' => 'datetime',
        'dispatch_reason' => 'array',
    ];

    public function routePlan() { return $this->belongsTo(RoutePlan::class); }
    public function order() { return $this->belongsTo(Order::class); }
}
