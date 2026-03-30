<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MarketBadgeAudit extends Model
{
    use HasFactory;

    protected $fillable = [
        'market_id',
        'user_id',
        'action',
        'previous_badge',
        'next_badge',
        'previous_badge_expires_at',
        'next_badge_expires_at',
    ];

    protected $casts = [
        'previous_badge_expires_at' => 'datetime',
        'next_badge_expires_at' => 'datetime',
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
