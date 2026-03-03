<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Item extends Model
{
    use HasFactory;

    protected $fillable = [
        'market_id','name','sku','price',
        'discount_type','discount_value',
        'stock_qty','is_active',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_value' => 'decimal:2',
        'is_active' => 'boolean',
    ];

    public function market()
    {
        return $this->belongsTo(Market::class);
    }
}