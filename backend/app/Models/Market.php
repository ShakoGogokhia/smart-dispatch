<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class Market extends Model
{
    use HasFactory;

    protected static ?bool $hasFeaturedColumns = null;
    

    protected $fillable = [
        'name',
        'code',
        'owner_user_id',
        'address',
        'lat',
        'lng',
        'is_active',
        'is_featured',
        'featured_badge',
        'featured_headline',
        'featured_copy',
        'featured_theme',
        'logo_path',
        'banner_path',
        'delivery_slots',
        'approval_status',
        'promotion_starts_at',
        'promotion_ends_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'lat' => 'decimal:7',
        'lng' => 'decimal:7',
        'delivery_slots' => 'array',
        'featured_theme' => 'array',
        'promotion_starts_at' => 'datetime',
        'promotion_ends_at' => 'datetime',
    ];

    protected $appends = [
        'logo_url',
        'banner_url',
        'image_url',
    ];

    public function owner()
    {
        return $this->belongsTo(User::class, 'owner_user_id');
    }

    public function users()
    {
        return $this->belongsToMany(User::class, 'market_users')
            ->withPivot('role')
            ->withTimestamps();
    }

    public function items()
    {
        return $this->hasMany(Item::class);
    }

    public function promoCodes()
    {
        return $this->hasMany(PromoCode::class);
    }

    public function reviews()
    {
        return $this->hasMany(ProductReview::class)->whereNull('item_id');
    }

    public function getLogoUrlAttribute(): ?string
    {
        if (!$this->logo_path) {
            return null;
        }

        return url(Storage::disk('public')->url($this->logo_path));
    }

    public function getBannerUrlAttribute(): ?string
    {
        if (!$this->banner_path) {
            return null;
        }

        return url(Storage::disk('public')->url($this->banner_path));
    }

    public function getImageUrlAttribute(): ?string
    {
        return $this->banner_url ?? $this->logo_url;
    }

    public static function hasFeaturedColumns(): bool
    {
        if (static::$hasFeaturedColumns !== null) {
            return static::$hasFeaturedColumns;
        }

        static::$hasFeaturedColumns =
            Schema::hasColumn('markets', 'is_featured') &&
            Schema::hasColumn('markets', 'featured_badge') &&
            Schema::hasColumn('markets', 'featured_headline') &&
            Schema::hasColumn('markets', 'featured_copy');

        return static::$hasFeaturedColumns;
    }
}
