<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class LocationPing extends Model
{
    protected $fillable = ['driver_id', 'lat', 'lng', 'speed', 'heading'];
}