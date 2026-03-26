<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class PromoCode extends Model
{
    use HasFactory;

    protected $fillable = [
        'market_id',
        'code',
        'type',
        'value',
        'starts_at',
        'ends_at',
        'max_uses',
        'uses',
        'is_active'
    ];

    protected $casts = [
        'value' => 'decimal:2',
        'starts_at' => 'datetime',
        'ends_at' => 'datetime',
        'is_active' => 'boolean',
    ];

    public function market()
    {
        return $this->belongsTo(Market::class);
    }

    public function scopeActiveApplicable($query)
    {
        $now = now();

        return $query
            ->where('is_active', true)
            ->where(function ($builder) use ($now) {
                $builder->whereNull('starts_at')->orWhere('starts_at', '<=', $now);
            })
            ->where(function ($builder) use ($now) {
                $builder->whereNull('ends_at')->orWhere('ends_at', '>=', $now);
            })
            ->where(function ($builder) {
                $builder->whereNull('max_uses')->orWhereColumn('uses', '<', 'max_uses');
            });
    }
}
