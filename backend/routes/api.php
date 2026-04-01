<?php

use Illuminate\Support\Facades\Route;

/*
|--------------------------------------------------------------------------
| Controllers
|--------------------------------------------------------------------------
*/

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OrderController;
use App\Http\Controllers\Api\VehicleController;
use App\Http\Controllers\Api\DriverController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\PlanningController;
use App\Http\Controllers\Api\DriverRouteController;
use App\Http\Controllers\Api\TrackingController;
use App\Http\Controllers\Api\OrderEventController;
use App\Http\Controllers\Api\RouteDispatchController;
use App\Http\Controllers\Api\ReoptimizeController;
use App\Http\Controllers\Api\LiveController;
use App\Http\Controllers\Api\AnalyticsController;

/* NEW */
use App\Http\Controllers\Api\MarketController;
use App\Http\Controllers\Api\ItemController;
use App\Http\Controllers\Api\PromoCodeController;
use App\Http\Controllers\Api\UsersController;
use App\Http\Controllers\Api\PublicMarketController;
use App\Http\Controllers\Api\DriverOrderController;
use App\Http\Controllers\Api\MarketBadgeRequestController;
use App\Http\Controllers\Api\FavoriteController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ReviewController;
use App\Http\Controllers\Api\WorkflowApprovalController;

/*
|--------------------------------------------------------------------------
| Public Routes
|--------------------------------------------------------------------------
*/

Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);


Route::prefix('public')->group(function () {
    Route::get('/markets', [PublicMarketController::class, 'markets']);
    Route::get('/markets/{market}', [PublicMarketController::class, 'market']);
    Route::get('/markets/{market}/items', [PublicMarketController::class, 'items']);
    Route::get('/markets/{market}/active-promo', [PublicMarketController::class, 'activePromo']); // optional
    Route::get('/markets/{market}/validate-promo', [PublicMarketController::class, 'validatePromo']);
    Route::get('/items/{item}/reviews', [ReviewController::class, 'index']);
});
/*
|--------------------------------------------------------------------------
| Protected Routes (Sanctum)
|--------------------------------------------------------------------------
*/

Route::middleware('auth:sanctum')->group(function () {

    Route::middleware('role:admin')->group(function () {
        Route::get('/promo-codes', [PromoCodeController::class, 'indexGlobal']);
        Route::post('/promo-codes', [PromoCodeController::class, 'storeGlobal']);
        Route::patch('/promo-codes/{promoCode}', [PromoCodeController::class, 'updateGlobal']);
    });

    /*
    |--------------------------------------------------------------------------
    | Auth
    |--------------------------------------------------------------------------
    */
    Route::get('/me', [AuthController::class, 'me']);
    Route::match(['patch', 'post'], '/me/language', [AuthController::class, 'updateLanguage']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::get('/favorites', [FavoriteController::class, 'index']);
    Route::post('/favorites/toggle', [FavoriteController::class, 'toggle']);
    Route::post('/items/{item}/reviews', [ReviewController::class, 'store']);
    Route::get('/workflow-approvals', [WorkflowApprovalController::class, 'index']);
    Route::post('/workflow-approvals', [WorkflowApprovalController::class, 'store']);
    Route::post('/workflow-approvals/{workflowApproval}/review', [WorkflowApprovalController::class, 'review']);

    /*
    |--------------------------------------------------------------------------
    | Orders
    |--------------------------------------------------------------------------
    */
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::patch('/orders/{order}', [OrderController::class, 'update']);
    Route::post('/orders/{order}/market-accept', [OrderController::class, 'marketAccept']);
    Route::post('/orders/{order}/mark-ready', [OrderController::class, 'markReady']);
    Route::post('/orders/{order}/request-cancel', [OrderController::class, 'requestCancel']);
    Route::post('/orders/{order}/request-refund', [OrderController::class, 'requestRefund']);
    Route::post('/orders/{order}/rate', [OrderController::class, 'rate']);
    Route::post('/orders/{order}/reorder', [OrderController::class, 'reorder']);
    Route::post('/orders/{order}/events', [OrderEventController::class, 'store']);

    /*
    |--------------------------------------------------------------------------
    | Vehicles
    |--------------------------------------------------------------------------
    */
    Route::get('/vehicles', [VehicleController::class, 'index']);
    Route::post('/vehicles', [VehicleController::class, 'store']);

    /*
    |--------------------------------------------------------------------------
    | Drivers
    |--------------------------------------------------------------------------
    */
    Route::get('/drivers', [DriverController::class, 'index']);
    Route::post('/drivers', [DriverController::class, 'store']);
    Route::patch('/drivers/{driver}/status', [DriverController::class, 'updateStatus']);
    Route::get('/driver/routes/today', [DriverRouteController::class, 'today']);
    Route::get('/driver/orders/feed', [DriverOrderController::class, 'feed']);
    Route::post('/driver/orders/{order}/accept', [DriverOrderController::class, 'accept']);
    Route::post('/driver/orders/{order}/decline', [DriverOrderController::class, 'decline']);
    Route::post('/driver/orders/{order}/picked-up', [DriverOrderController::class, 'pickedUp']);
    Route::post('/driver/orders/{order}/delivered', [DriverOrderController::class, 'delivered']);

    /*
    |--------------------------------------------------------------------------
    | Shifts
    |--------------------------------------------------------------------------
    */
    Route::post('/shifts/start', [ShiftController::class, 'start']);
    Route::post('/shifts/end', [ShiftController::class, 'end']);

    /*
    |--------------------------------------------------------------------------
    | Planning
    |--------------------------------------------------------------------------
    */
    Route::post('/planning/run', [PlanningController::class, 'run']);
    Route::post('/planning/commit', [PlanningController::class, 'commit']);

    /*
    |--------------------------------------------------------------------------
    | Tracking
    |--------------------------------------------------------------------------
    */
    Route::post('/tracking/ping', [TrackingController::class, 'ping']);

    /*
    |--------------------------------------------------------------------------
    | Route Dispatch
    |--------------------------------------------------------------------------
    */
    Route::post('/routes/{routePlan}/reassign-stop', [RouteDispatchController::class, 'reassignStop']);
    Route::patch('/routes/{routePlan}/stops/reorder', [RouteDispatchController::class, 'reorder']);
    Route::delete('/routes/{routePlan}/stops/{stop}', [RouteDispatchController::class, 'removeStop']);
    Route::post('/routes/{routePlan}/reoptimize', [ReoptimizeController::class, 'reoptimize']);

    /*
    |--------------------------------------------------------------------------
    | Live
    |--------------------------------------------------------------------------
    */
    Route::get('/live/locations', [LiveController::class, 'locations']);
    Route::get('/live/routes', [LiveController::class, 'routes']);
    Route::get('/live/alerts', [LiveController::class, 'alerts']);
    Route::get('/live/history', [LiveController::class, 'history']);

    /*
    |--------------------------------------------------------------------------
    | Analytics
    |--------------------------------------------------------------------------
    */
    Route::get('/analytics/summary', [AnalyticsController::class, 'summary']);

    /*
    |--------------------------------------------------------------------------
    | Markets System
    |--------------------------------------------------------------------------
    */

    /*
    | Admin-only routes
    */
    Route::middleware('role:admin')->group(function () {

        // Get all users to assign as owner
        Route::get('/users', [UsersController::class, 'index']);
        Route::get('/users/owners', [UsersController::class, 'owners']);
        Route::post('/users', [UsersController::class, 'store']);
        Route::patch('/users/{user}', [UsersController::class, 'update']);

        // Markets CRUD
        Route::get('/markets', [MarketController::class, 'index']);
        Route::post('/markets', [MarketController::class, 'store']);
        Route::patch('/markets/{market}', [MarketController::class, 'update']);
        Route::get('/badge-requests', [MarketBadgeRequestController::class, 'index']);

        // Change owner
        Route::post('/markets/{market}/assign-owner', [MarketController::class, 'assignOwner']);
    });

    /*
    | Owner / Staff markets
    */
    Route::get('/my/markets', [MarketController::class, 'myMarkets']);
    Route::get('/my/badge-requests', [MarketBadgeRequestController::class, 'index']);

    /*
    | Market scoped routes (owner or staff or admin)
    */
    Route::middleware('market.access')->group(function () {

        // Items
        Route::get('/markets/{market}/items', [ItemController::class, 'index']);
        Route::post('/markets/{market}/items', [ItemController::class, 'store']);
        Route::patch('/markets/{market}/items/{item}', [ItemController::class, 'update']);
        Route::post('/markets/{market}/items/import-csv', [ItemController::class, 'importCsv']);
        Route::get('/markets/{market}/items/export-csv', [ItemController::class, 'exportCsv']);
        Route::post('/markets/{market}/logo', [MarketController::class, 'uploadLogo']);
        // Promo Codes
        Route::get('/markets/{market}/promo-codes', [PromoCodeController::class, 'index']);
        Route::post('/markets/{market}/promo-codes', [PromoCodeController::class, 'store']);
        Route::patch('/markets/{market}/promo-codes/{promoCode}', [PromoCodeController::class, 'update']);

        Route::get('/markets/{market}/staff', [MarketController::class, 'staff']);
        Route::post('/markets/{market}/staff', [MarketController::class, 'addStaff']);
        Route::delete('/markets/{market}/staff/{userId}', [MarketController::class, 'removeStaff']);
        Route::get('/markets/{market}/assignable-users', [UsersController::class, 'assignable']);
        Route::post('/markets/{market}/badge-requests', [MarketBadgeRequestController::class, 'store']);
    });

});
