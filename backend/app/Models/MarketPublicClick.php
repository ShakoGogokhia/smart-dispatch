<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MarketPublicClick extends Model
{
    use HasFactory;

    protected $fillable = [
        'market_id',
        'user_id',
        'visitor_key',
        'source',
    ];

    public function market()
    {
        return $this->belongsTo(Market::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }
}
