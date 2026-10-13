<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Storage;

class Item extends Model
{
    use HasFactory;

    protected $fillable = [
        'market_id','name','sku','item_kind','price',
        'discount_type','discount_value','multi_buy','specs',
        'stock_qty','show_stock_quantity','is_active',
        'is_promoted','promotion_starts_at','promotion_ends_at',
        'category','image_url','image_path','image_paths',
        'variants','availability_schedule',
        'ingredients','combo_offers',
        'low_stock_threshold',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'discount_value' => 'decimal:2',
        'is_active' => 'boolean',
        'show_stock_quantity' => 'boolean',
        'is_promoted' => 'boolean',
        'image_paths' => 'array',
        'multi_buy' => 'array',
        'specs' => 'array',
        'variants' => 'array',
        'availability_schedule' => 'array',
        'ingredients' => 'array',
        'combo_offers' => 'array',
        'promotion_starts_at' => 'datetime',
        'promotion_ends_at' => 'datetime',
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

    /**
     * Units the customer pays for under a "buy X get Y free" deal.
     * With 1+1 and qty 5 that is 3: two pairs get one free unit each.
     */
    public function paidQuantity(int $qty): int
    {
        $buy = (int) ($this->multi_buy['buy'] ?? 0);
        $get = (int) ($this->multi_buy['get'] ?? 0);

        if ($buy < 1 || $get < 1) {
            return $qty;
        }

        return $qty - intdiv($qty, $buy + $get) * $get;
    }
}
