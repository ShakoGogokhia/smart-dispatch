<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MarketBadgeRequest extends Model
{
    use HasFactory;

    protected $fillable = [
        'market_id',
        'requested_by',
        'badge',
        'duration_days',
        'status',
        'notes',
    ];

    public function market()
    {
        return $this->belongsTo(Market::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
