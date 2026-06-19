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
        'operating_hours',
        'uses_operating_schedule',
        'is_manually_closed',
        'manual_close_comment',
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
        'operating_hours' => 'array',
        'uses_operating_schedule' => 'boolean',
        'is_manually_closed' => 'boolean',
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

    public function operatingStatus(?Carbon $now = null): array
    {
        $now ??= now();

        if (!$this->is_active) {
            return [
                'is_open' => false,
                'mode' => 'inactive',
                'label' => 'Closed',
                'reason' => 'Market is not live.',
                'next_open_at' => null,
                'next_close_at' => null,
                'today_hours' => null,
            ];
        }

        $todayHours = $this->hoursForDay($now);

        if ($this->is_manually_closed) {
            return [
                'is_open' => false,
                'mode' => 'manual',
                'label' => 'Temporarily closed',
                'reason' => $this->manual_close_comment,
                'next_open_at' => $this->nextOpeningTime($now)?->toIso8601String(),
                'next_close_at' => null,
                'today_hours' => $todayHours,
            ];
        }

        if (!$this->uses_operating_schedule) {
            return [
                'is_open' => true,
                'mode' => 'always_open',
                'label' => 'Open now',
                'reason' => null,
                'next_open_at' => null,
                'next_close_at' => null,
                'today_hours' => null,
            ];
        }

        $hours = $this->normalizedOperatingHours();

        if ($hours === []) {
            return [
                'is_open' => false,
                'mode' => 'schedule',
                'label' => 'Closed now',
                'reason' => null,
                'next_open_at' => null,
                'next_close_at' => null,
                'today_hours' => null,
            ];
        }

        $window = $this->activeScheduleWindow($now);

        if ($window) {
            return [
                'is_open' => true,
                'mode' => 'schedule',
                'label' => 'Open now',
                'reason' => null,
                'next_open_at' => null,
                'next_close_at' => $window['close']->toIso8601String(),
                'today_hours' => $todayHours,
            ];
        }

        return [
            'is_open' => false,
            'mode' => 'schedule',
            'label' => 'Closed now',
            'reason' => null,
            'next_open_at' => $this->nextOpeningTime($now)?->toIso8601String(),
            'next_close_at' => null,
            'today_hours' => $todayHours,
        ];
    }

    public function normalizedOperatingHours(): array
    {
        return collect($this->operating_hours ?? [])
            ->filter(fn ($entry) => is_array($entry) && ($entry['enabled'] ?? false) && !empty($entry['day']) && !empty($entry['open']) && !empty($entry['close']))
            ->map(fn ($entry) => [
                'day' => strtolower((string) $entry['day']),
                'enabled' => true,
                'open' => (string) $entry['open'],
                'close' => (string) $entry['close'],
            ])
            ->values()
            ->all();
    }

    private function hoursForDay(Carbon $date): ?array
    {
        $day = strtolower($date->englishDayOfWeek);

        foreach ($this->normalizedOperatingHours() as $entry) {
            if ($entry['day'] === $day) {
                return $entry;
            }
        }

        return null;
    }

    private function activeScheduleWindow(Carbon $now): ?array
    {
        foreach ([0, -1] as $offset) {
            $date = $now->copy()->addDays($offset);
            $entry = $this->hoursForDay($date);

            if (!$entry) {
                continue;
            }

            [$openHour, $openMinute] = array_map('intval', explode(':', $entry['open']));
            [$closeHour, $closeMinute] = array_map('intval', explode(':', $entry['close']));

            $open = $date->copy()->setTime($openHour, $openMinute);
            $close = $date->copy()->setTime($closeHour, $closeMinute);

            if ($close->lessThanOrEqualTo($open)) {
                $close->addDay();
            }

            if ($now->betweenIncluded($open, $close)) {
                return ['open' => $open, 'close' => $close];
            }
        }

        return null;
    }

    private function nextOpeningTime(Carbon $now): ?Carbon
    {
        for ($i = 0; $i < 8; $i++) {
            $date = $now->copy()->addDays($i);
            $entry = $this->hoursForDay($date);

            if (!$entry) {
                continue;
            }

            [$openHour, $openMinute] = array_map('intval', explode(':', $entry['open']));
            $open = $date->copy()->setTime($openHour, $openMinute);

            if ($open->greaterThan($now)) {
                return $open;
            }
        }

        return null;
    }
}
