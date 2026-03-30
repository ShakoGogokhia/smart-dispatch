<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

class Market extends Model
{
    use HasFactory;

    protected static ?bool $hasFeaturedColumns = null;
    protected static ?bool $hasCoordinateColumns = null;
    

    protected $fillable = [
        'name',
        'code',
        'owner_user_id',
        'address',
        'category',
        'lat',
        'lng',
        'is_active',
        'is_featured',
        'featured_badge',
        'featured_headline',
        'featured_copy',
        'logo_path',
        'cover_path',
        'minimum_order',
        'delivery_eta_minutes',
        'featured_sort_order',
        'badge_expires_at',
        'featured_starts_at',
        'featured_ends_at',
        'opens_at',
        'closes_at',
    ];

    protected $casts = [
        'is_active' => 'boolean',
        'is_featured' => 'boolean',
        'lat' => 'decimal:7',
        'lng' => 'decimal:7',
        'minimum_order' => 'decimal:2',
        'badge_expires_at' => 'datetime',
        'featured_starts_at' => 'datetime',
        'featured_ends_at' => 'datetime',
    ];

    protected $appends = [
        'logo_url',
        'cover_url',
        'is_open_now',
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

    public function orders()
    {
        return $this->hasMany(Order::class);
    }

    public function publicClicks()
    {
        return $this->hasMany(MarketPublicClick::class);
    }

    public function badgeAudits()
    {
        return $this->hasMany(MarketBadgeAudit::class);
    }

    public function banners()
    {
        return $this->hasMany(MarketBanner::class);
    }

    public function getLogoUrlAttribute(): ?string
    {
        if (!$this->logo_path) {
            return null;
        }

        return Storage::disk('public')->url($this->logo_path);
    }

    public function getCoverUrlAttribute(): ?string
    {
        if (!$this->cover_path) {
            return null;
        }

        return Storage::disk('public')->url($this->cover_path);
    }

    public function getIsOpenNowAttribute(): ?bool
    {
        if (!$this->is_active) {
            return false;
        }

        if (!$this->opens_at || !$this->closes_at) {
            return null;
        }

        $now = now();
        $open = Carbon::parse($this->opens_at, $now->timezone)->setDateFrom($now);
        $close = Carbon::parse($this->closes_at, $now->timezone)->setDateFrom($now);

        if ($close->lessThanOrEqualTo($open)) {
            return $now->greaterThanOrEqualTo($open) || $now->lessThanOrEqualTo($close);
        }

        return $now->greaterThanOrEqualTo($open) && $now->lessThanOrEqualTo($close);
    }

    public function hasActiveBadge(): bool
    {
        if (!filled($this->featured_badge)) {
            return false;
        }

        return !$this->badge_expires_at || now()->lessThanOrEqualTo($this->badge_expires_at);
    }

    public function isFeatureLive(): bool
    {
        if (!$this->is_featured) {
            return false;
        }

        if ($this->featured_starts_at && now()->lessThan($this->featured_starts_at)) {
            return false;
        }

        if ($this->featured_ends_at && now()->greaterThan($this->featured_ends_at)) {
            return false;
        }

        return true;
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

    public static function hasCoordinateColumns(): bool
    {
        if (static::$hasCoordinateColumns !== null) {
            return static::$hasCoordinateColumns;
        }

        static::$hasCoordinateColumns =
            Schema::hasColumn('markets', 'lat') &&
            Schema::hasColumn('markets', 'lng');

        return static::$hasCoordinateColumns;
    }
}
