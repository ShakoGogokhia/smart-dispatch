<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class StorefrontPromotionPurchase extends Model
{
    use HasFactory;

    protected $fillable = [
        'market_id',
        'item_id',
        'requested_by',
        'target_type',
        'plan_key',
        'price_label',
        'badge',
        'headline',
        'copy',
        'duration_days',
        'starts_at',
        'ends_at',
        'status',
        'payload',
    ];

    protected $casts = [
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'payload' => 'array',
    ];

    public function market()
    {
        return $this->belongsTo(Market::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }
}
