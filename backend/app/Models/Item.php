<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Storage;

class Item extends Model
{
    use HasFactory;

    protected $fillable = [
        'market_id','name','sku','price',
        'discount_type','discount_value',
        'stock_qty','is_active',
        'category','image_url','image_path','image_paths',
        'variants','availability_schedule',
        'ingredients','combo_offers',
        'low_stock_threshold',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_value' => 'decimal:2',
        'is_active' => 'boolean',
        'image_paths' => 'array',
        'variants' => 'array',
        'availability_schedule' => 'array',
        'ingredients' => 'array',
        'combo_offers' => 'array',
    ];

    public function getImageUrlAttribute(?string $value): ?string
    {
        $gallery = $this->image_paths ?? [];

        if (is_array($gallery) && !empty($gallery[0])) {
            return url(Storage::disk('public')->url($gallery[0]));
        }

        if ($this->image_path) {
            return url(Storage::disk('public')->url($this->image_path));
        }

        return $value;
    }

    public function market()
    {
        return $this->belongsTo(Market::class);
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class);
    }
}
