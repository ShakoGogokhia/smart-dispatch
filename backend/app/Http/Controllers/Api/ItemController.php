<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Market;
use App\Models\ProductReview;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ItemController extends Controller
{
    public function index(Market $market)
    {
        $query = $market->items()->latest();

        if (ProductReview::tableExists()) {
            $query
                ->withCount('reviews')
                ->withAvg('reviews', 'rating');
        }

        return $query
            ->get()
            ->map(fn (Item $item) => $this->serializeItem($item));
    }

    public function store(Request $request, Market $market)
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'sku' => ['required', 'string', 'max:100'],
            'price' => ['required', 'numeric', 'min:0'],
            'discount_type' => ['nullable', 'in:none,percent,fixed'],
            'discount_value' => ['nullable', 'numeric', 'min:0'],
            'stock_qty' => ['nullable', 'integer', 'min:0'],
            'is_active' => ['nullable', 'boolean'],
            'category' => ['nullable', 'string', 'max:120'],
            'image_url' => ['nullable', 'url'],
            'variants' => ['nullable', 'array'],
            'availability_schedule' => ['nullable', 'array'],
            'low_stock_threshold' => ['nullable', 'integer', 'min:0'],
        ]);

        $item = Item::create([
            'market_id' => $market->id,
            'name' => $data['name'],
            'sku' => $data['sku'],
            'price' => $data['price'],
            'discount_type' => $data['discount_type'] ?? 'none',
            'discount_value' => $data['discount_value'] ?? 0,
            'stock_qty' => $data['stock_qty'] ?? 0,
            'is_active' => $data['is_active'] ?? true,
            'category' => $data['category'] ?? null,
            'image_url' => $data['image_url'] ?? null,
            'variants' => $data['variants'] ?? null,
            'availability_schedule' => $data['availability_schedule'] ?? null,
            'low_stock_threshold' => $data['low_stock_threshold'] ?? 5,
        ]);

        return response()->json($this->serializeItem($item), 201);
    }

    public function update(Request $request, Market $market, Item $item)
    {
        if ($item->market_id !== $market->id) {
            return response()->json(['message' => 'Item does not belong to market'], 400);
        }

        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:255'],
            'sku' => ['sometimes', 'string', 'max:100'],
            'price' => ['sometimes', 'numeric', 'min:0'],
            'discount_type' => ['sometimes', 'in:none,percent,fixed'],
            'discount_value' => ['sometimes', 'numeric', 'min:0'],
            'stock_qty' => ['sometimes', 'integer', 'min:0'],
            'is_active' => ['sometimes', 'boolean'],
            'category' => ['nullable', 'string', 'max:120'],
            'image_url' => ['nullable', 'url'],
            'variants' => ['nullable', 'array'],
            'availability_schedule' => ['nullable', 'array'],
            'low_stock_threshold' => ['sometimes', 'integer', 'min:0'],
        ]);

        $item->update($data);
        return $this->serializeItem($item->fresh());
    }

    public function importCsv(Request $request, Market $market)
    {
        $data = $request->validate([
            'csv' => ['required', 'string'],
        ]);

        $lines = preg_split('/\r\n|\n|\r/', trim($data['csv']));

        if (!$lines || count($lines) < 2) {
            return response()->json(['message' => 'CSV must include a header and at least one row'], 422);
        }

        $headers = str_getcsv(array_shift($lines));
        $created = [];

        foreach ($lines as $line) {
            if (trim($line) === '') {
                continue;
            }

            $row = array_combine($headers, str_getcsv($line));

            if (!$row) {
                continue;
            }

            $created[] = Item::updateOrCreate(
                [
                    'market_id' => $market->id,
                    'sku' => $row['sku'],
                ],
                [
                    'name' => $row['name'] ?? 'Item',
                    'price' => (float) ($row['price'] ?? 0),
                    'discount_type' => $row['discount_type'] ?? 'none',
                    'discount_value' => (float) ($row['discount_value'] ?? 0),
                    'stock_qty' => (int) ($row['stock_qty'] ?? 0),
                    'is_active' => filter_var($row['is_active'] ?? true, FILTER_VALIDATE_BOOL),
                    'category' => $row['category'] ?? null,
                    'image_url' => $row['image_url'] ?? null,
                    'variants' => !empty($row['variants']) ? json_decode($row['variants'], true) : null,
                    'availability_schedule' => !empty($row['availability_schedule']) ? json_decode($row['availability_schedule'], true) : null,
                    'low_stock_threshold' => (int) ($row['low_stock_threshold'] ?? 5),
                ],
            );
        }

        return response()->json([
            'imported' => count($created),
        ]);
    }

    public function exportCsv(Market $market): StreamedResponse
    {
        $headers = [
            'Content-Type' => 'text/csv',
            'Content-Disposition' => 'attachment; filename="market-' . $market->id . '-items.csv"',
        ];

        $columns = ['name', 'sku', 'category', 'price', 'discount_type', 'discount_value', 'stock_qty', 'low_stock_threshold', 'is_active', 'image_url', 'variants', 'availability_schedule'];

        return response()->stream(function () use ($market, $columns) {
            $handle = fopen('php://output', 'w');
            fputcsv($handle, $columns);

            foreach ($market->items()->orderBy('name')->get() as $item) {
                fputcsv($handle, [
                    $item->name,
                    $item->sku,
                    $item->category,
                    $item->price,
                    $item->discount_type,
                    $item->discount_value,
                    $item->stock_qty,
                    $item->low_stock_threshold,
                    $item->is_active ? 'true' : 'false',
                    $item->image_url,
                    $item->variants ? json_encode($item->variants) : '',
                    $item->availability_schedule ? json_encode($item->availability_schedule) : '',
                ]);
            }

            fclose($handle);
        }, 200, $headers);
    }

    private function serializeItem(Item $item): array
    {
        if (ProductReview::tableExists()) {
            $avg = $item->reviews_avg_rating ?? $item->reviews()->avg('rating');
            $count = $item->reviews_count ?? $item->reviews()->count();
        } else {
            $avg = null;
            $count = 0;
        }

        return [
            'id' => $item->id,
            'market_id' => $item->market_id,
            'name' => $item->name,
            'sku' => $item->sku,
            'category' => $item->category,
            'image_url' => $item->image_url,
            'variants' => $item->variants,
            'availability_schedule' => $item->availability_schedule,
            'price' => $item->price,
            'discount_type' => $item->discount_type,
            'discount_value' => $item->discount_value,
            'stock_qty' => $item->stock_qty,
            'low_stock_threshold' => $item->low_stock_threshold,
            'is_active' => (bool) $item->is_active,
            'is_low_stock' => $item->stock_qty <= $item->low_stock_threshold,
            'review_summary' => [
                'count' => (int) $count,
                'average' => $avg !== null ? round((float) $avg, 1) : null,
            ],
        ];
    }
}
