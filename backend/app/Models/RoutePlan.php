<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class RoutePlan extends Model
{
    protected $fillable = [
        'driver_id','route_date','status',
        'planned_distance_km','planned_duration_min'
    ];

    protected $casts = [
        'route_date' => 'date',
    ];

    public function driver() { return $this->belongsTo(Driver::class); }
    public function stops() { return $this->hasMany(RouteStop::class)->orderBy('sequence'); }
}