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
        'logo_path',
        'delivery_slots',
        'approval_status',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'lat' => 'decimal:7',
        'lng' => 'decimal:7',
        'delivery_slots' => 'array',
    ];

    protected $appends = [
        'logo_url',
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

        return Storage::disk('public')->url($this->logo_path);
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
