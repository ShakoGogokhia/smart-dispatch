<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class OrderItem extends Model
{
    protected $fillable = [
        'order_id',
        'item_id',
        'name',
        'sku',
        'qty',
        'unit_price',
        'line_total',
        'ingredients',
        'removed_ingredients',
        'combo_offer',
    ];

    protected $casts = [
        'ingredients' => 'array',
        'removed_ingredients' => 'array',
        'combo_offer' => 'array',
    ];

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public function item()
    {
        return $this->belongsTo(Item::class);
    }
}
