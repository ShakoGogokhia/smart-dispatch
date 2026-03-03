<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Factories\HasFactory;

class Market extends Model
{
    use HasFactory;
    

    protected $fillable = [
        'name','code','owner_user_id','address','is_active','logo_path'
    ];

    protected $casts = [
        'is_active' => 'boolean',
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
    
}