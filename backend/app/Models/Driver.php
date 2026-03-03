<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Driver extends Model
{
    protected $fillable = ['user_id', 'vehicle_id', 'status'];

    public function user()
    {
        return $this->belongsTo(User::class);
    }
    public function vehicle()
    {
        return $this->belongsTo(Vehicle::class);
    }

    public function shifts()
    {
        return $this->hasMany(\App\Models\Shift::class);
    }
}