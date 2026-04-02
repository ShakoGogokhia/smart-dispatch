<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Schema;

class ProductReview extends Model
{
    protected $fillable = [
        'item_id',
        'market_id',
        'user_id',
        'order_id',
        'rating',
        'comment',
    ];

    public function item()
    {
        return $this->belongsTo(Item::class);
    }

    public function market()
    {
        return $this->belongsTo(Market::class);
    }

    public function user()
    {
        return $this->belongsTo(User::class);
    }

    public function order()
    {
        return $this->belongsTo(Order::class);
    }

    public static function tableExists(): bool
    {
        return Schema::hasTable((new static())->getTable());
    }
}
