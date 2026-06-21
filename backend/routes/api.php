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
use App\Http\Controllers\Api\StorefrontPromotionController;
use App\Http\Controllers\Api\OrderTrackingController;
use App\Http\Controllers\Api\CustomerOrderController;
use App\Http\Controllers\Api\DriverEarningsController;
use App\Http\Controllers\Api\MarketDashboardController;
use App\Http\Controllers\Api\InventoryAlertController;
use App\Http\Controllers\Api\DispatchInsightController;
use App\Http\Controllers\Api\DemoScenarioController;
use App\Http\Controllers\Api\PaymentController;
use App\Http\Controllers\Api\SupportTicketController;
use App\Http\Controllers\Api\AuditLogController;



Route::post('/login', [AuthController::class, 'login']);
Route::post('/register', [AuthController::class, 'register']);


Route::prefix('public')->group(function () {
    Route::get('/markets', [PublicMarketController::class, 'markets']);
    Route::get('/discovery-items', [PublicMarketController::class, 'discoveryItems']);
    Route::get('/markets/{market}', [PublicMarketController::class, 'market']);
    Route::get('/markets/{market}/items', [PublicMarketController::class, 'items']);
    Route::get('/markets/{market}/active-promo', [PublicMarketController::class, 'activePromo']); // optional
    Route::get('/markets/{market}/reviews', [ReviewController::class, 'marketIndex']);
    Route::get('/markets/{market}/validate-promo', [PublicMarketController::class, 'validatePromo']);
    Route::get('/items/{item}/reviews', [ReviewController::class, 'index']);
    Route::get('/track/{code}', [OrderTrackingController::class, 'show']);
});

Route::middleware('auth:sanctum')->group(function () {

    Route::middleware('role:admin')->group(function () {
        Route::get('/promo-codes', [PromoCodeController::class, 'indexGlobal']);
        Route::post('/promo-codes', [PromoCodeController::class, 'storeGlobal']);
        Route::patch('/promo-codes/{promoCode}', [PromoCodeController::class, 'updateGlobal']);
    });


    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me', [AuthController::class, 'updateProfile']);
    Route::post('/me/photo', [AuthController::class, 'uploadProfilePhoto']);
    Route::match(['patch', 'post'], '/me/language', [AuthController::class, 'updateLanguage']);
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllRead']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'markRead']);
    Route::get('/support-tickets', [SupportTicketController::class, 'index']);
    Route::post('/support-tickets', [SupportTicketController::class, 'store'])->middleware('throttle:20,1');
    Route::post('/support-tickets/{supportTicket}/messages', [SupportTicketController::class, 'message'])->middleware('throttle:40,1');
    Route::patch('/support-tickets/{supportTicket}', [SupportTicketController::class, 'update']);
    Route::get('/customer/orders/history', [CustomerOrderController::class, 'history']);
    Route::get('/customer/orders/{order}/receipt', [CustomerOrderController::class, 'receipt']);
    Route::get('/favorites', [FavoriteController::class, 'index']);
    Route::post('/favorites/toggle', [FavoriteController::class, 'toggle']);
    Route::post('/markets/{market}/reviews', [ReviewController::class, 'storeMarket']);
    Route::post('/items/{item}/reviews', [ReviewController::class, 'store']);
    Route::get('/workflow-approvals', [WorkflowApprovalController::class, 'index']);
    Route::post('/workflow-approvals', [WorkflowApprovalController::class, 'store']);
    Route::post('/workflow-approvals/{workflowApproval}/review', [WorkflowApprovalController::class, 'review']);

 
    Route::get('/orders', [OrderController::class, 'index']);
    Route::post('/orders', [OrderController::class, 'store']);
    Route::get('/orders/{order}', [OrderController::class, 'show']);
    Route::patch('/orders/{order}', [OrderController::class, 'update']);
    Route::post('/orders/{order}/market-accept', [OrderController::class, 'marketAccept']);
    Route::post('/orders/{order}/mark-ready', [OrderController::class, 'markReady']);
    Route::post('/orders/{order}/request-cancel', [OrderController::class, 'requestCancel']);
    Route::post('/orders/{order}/request-refund', [OrderController::class, 'requestRefund']);
    Route::post('/orders/{order}/payment/simulate', [PaymentController::class, 'simulate'])->middleware('throttle:20,1');
    Route::post('/orders/{order}/payment/refund', [PaymentController::class, 'refund'])->middleware('role:admin');
    Route::post('/orders/{order}/rate', [OrderController::class, 'rate']);
    Route::post('/orders/{order}/reorder', [OrderController::class, 'reorder']);
    Route::post('/orders/{order}/events', [OrderEventController::class, 'store']);


    Route::get('/vehicles', [VehicleController::class, 'index']);
    Route::post('/vehicles', [VehicleController::class, 'store']);

    Route::get('/drivers', [DriverController::class, 'index']);
    Route::post('/drivers', [DriverController::class, 'store']);
    Route::patch('/drivers/{driver}/status', [DriverController::class, 'updateStatus']);
    Route::get('/driver/routes/today', [DriverRouteController::class, 'today']);
    Route::get('/driver/earnings', [DriverEarningsController::class, 'summary']);
    Route::get('/driver/orders/feed', [DriverOrderController::class, 'feed']);
    Route::post('/driver/orders/{order}/accept', [DriverOrderController::class, 'accept']);
    Route::post('/driver/orders/{order}/decline', [DriverOrderController::class, 'decline']);
    Route::post('/driver/orders/{order}/picked-up', [DriverOrderController::class, 'pickedUp']);
    Route::post('/driver/orders/{order}/proof', [DriverOrderController::class, 'uploadProof'])->middleware('throttle:20,1');
    Route::post('/driver/orders/{order}/delivered', [DriverOrderController::class, 'delivered']);

    Route::post('/shifts/start', [ShiftController::class, 'start']);
    Route::post('/shifts/end', [ShiftController::class, 'end']);


    Route::post('/planning/run', [PlanningController::class, 'run'])->middleware(['can:view-dispatch-console', 'throttle:dispatch-actions']);
    Route::post('/planning/commit', [PlanningController::class, 'commit'])->middleware(['can:view-dispatch-console', 'throttle:dispatch-actions']);

 
    Route::post('/tracking/ping', [TrackingController::class, 'ping']);


    Route::post('/routes/{routePlan}/reassign-stop', [RouteDispatchController::class, 'reassignStop']);
    Route::patch('/routes/{routePlan}/stops/reorder', [RouteDispatchController::class, 'reorder']);
    Route::delete('/routes/{routePlan}/stops/{stop}', [RouteDispatchController::class, 'removeStop']);
    Route::post('/routes/{routePlan}/reoptimize', [ReoptimizeController::class, 'reoptimize']);


    Route::get('/live/locations', [LiveController::class, 'locations']);
    Route::get('/live/routes', [LiveController::class, 'routes']);
    Route::get('/live/alerts', [LiveController::class, 'alerts']);
    Route::get('/live/history', [LiveController::class, 'history']);
    Route::get('/dispatch/orders/{order}/insights', [DispatchInsightController::class, 'show'])->middleware('can:view-dispatch-console');


    Route::get('/analytics/summary', [AnalyticsController::class, 'summary']);
    Route::middleware('role:admin')->group(function () {

        Route::get('/users', [UsersController::class, 'index']);
        Route::get('/users/owners', [UsersController::class, 'owners']);
        Route::post('/users', [UsersController::class, 'store']);
        Route::patch('/users/{user}', [UsersController::class, 'update']);

        Route::get('/markets', [MarketController::class, 'index']);
        Route::post('/markets', [MarketController::class, 'store']);
        Route::patch('/markets/{market}', [MarketController::class, 'update']);
        Route::get('/badge-requests', [MarketBadgeRequestController::class, 'index']);
        Route::post('/demo/scenario', [DemoScenarioController::class, 'store']);
        Route::get('/audit-logs', [AuditLogController::class, 'index']);

        Route::post('/markets/{market}/assign-owner', [MarketController::class, 'assignOwner']);
    });

    Route::get('/my/markets', [MarketController::class, 'myMarkets']);
    Route::get('/my/badge-requests', [MarketBadgeRequestController::class, 'index']);

    Route::middleware('market.access')->group(function () {

        Route::get('/markets/{market}/items', [ItemController::class, 'index']);
        Route::get('/markets/{market}/dashboard', [MarketDashboardController::class, 'show']);
        Route::get('/markets/{market}/inventory-alerts', [InventoryAlertController::class, 'index']);
        Route::post('/markets/{market}/inventory-alerts/hide-out-of-stock', [InventoryAlertController::class, 'hideOutOfStock']);
        Route::patch('/markets/{market}/settings', [MarketController::class, 'updateSettings']);
        Route::post('/markets/{market}/items', [ItemController::class, 'store']);
        Route::patch('/markets/{market}/items/{item}', [ItemController::class, 'update']);
        Route::post('/markets/{market}/items/{item}/image', [ItemController::class, 'uploadImage']);
        Route::delete('/markets/{market}/items/{item}/images', [ItemController::class, 'clearImages']);
        Route::delete('/markets/{market}/items/{item}/images/{imageIndex}', [ItemController::class, 'deleteImage']);
        Route::post('/markets/{market}/items/import-csv', [ItemController::class, 'importCsv']);
        Route::get('/markets/{market}/items/export-csv', [ItemController::class, 'exportCsv']);
        Route::post('/markets/{market}/logo', [MarketController::class, 'uploadLogo']);
        Route::post('/markets/{market}/banner', [MarketController::class, 'uploadBanner']);
        Route::get('/markets/{market}/promo-codes', [PromoCodeController::class, 'index']);
        Route::post('/markets/{market}/promo-codes', [PromoCodeController::class, 'store']);
        Route::patch('/markets/{market}/promo-codes/{promoCode}', [PromoCodeController::class, 'update']);

        Route::get('/markets/{market}/staff', [MarketController::class, 'staff']);
        Route::post('/markets/{market}/staff', [MarketController::class, 'addStaff']);
        Route::delete('/markets/{market}/staff/{userId}', [MarketController::class, 'removeStaff']);
        Route::get('/markets/{market}/assignable-users', [UsersController::class, 'assignable']);
        Route::post('/markets/{market}/badge-requests', [MarketBadgeRequestController::class, 'store']);
        Route::get('/markets/{market}/promotion-purchases', [StorefrontPromotionController::class, 'index']);
        Route::post('/markets/{market}/promotion-purchases', [StorefrontPromotionController::class, 'store']);
    });

});
