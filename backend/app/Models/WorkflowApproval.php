<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class WorkflowApproval extends Model
{
    protected $fillable = [
        'type',
        'status',
        'requested_by',
        'reviewed_by',
        'market_id',
        'order_id',
        'promo_code_id',
        'payload',
        'notes',
        'reviewed_at',
    ];

    protected $casts = [
        'payload' => 'array',
        'reviewed_at' => 'datetime',
    ];

    public function requester()
    {
        return $this->belongsTo(User::class, 'requested_by');
    }

    public function reviewer()
    {
        return $this->belongsTo(User::class, 'reviewed_by');
    }

    public function market()
    {
        return $this->belongsTo(Market::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function promoCode()
    {
        return $this->belongsTo(PromoCode::class);
    }
}
