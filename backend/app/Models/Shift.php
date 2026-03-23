<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Shift extends Model
{
    protected $fillable = ['driver_id', 'started_at', 'ended_at', 'status'];
    protected $casts = ['started_at' => 'datetime', 'ended_at' => 'datetime'];

    public function driver()
    {
        return $this->belongsTo(Driver::class);
    }
}
