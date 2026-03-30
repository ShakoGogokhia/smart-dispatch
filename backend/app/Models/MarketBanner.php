<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class MarketBanner extends Model
{
    use HasFactory;

    protected $fillable = [
        'title',
        'subtitle',
        'cta_label',
        'cta_url',
        'theme',
        'is_active',
        'sort_order',
        'starts_at',
        'ends_at',
        'market_id',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
    ];

    public function market()
    {
        return $this->belongsTo(Market::class);
    }

    public function isLive(): bool
    {
        if (!$this->is_active) {
            return false;
        }

        if ($this->starts_at && now()->lessThan($this->starts_at)) {
            return false;
        }

        if ($this->ends_at && now()->greaterThan($this->ends_at)) {
            return false;
        }

        return true;
    }
}
