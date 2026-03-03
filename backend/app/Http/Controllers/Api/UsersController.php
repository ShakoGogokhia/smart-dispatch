<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;

class UsersController extends Controller
{
    public function owners()
    {
        return User::query()
            ->select('id','name','email')
            ->orderBy('name')
            ->get();
    }
}