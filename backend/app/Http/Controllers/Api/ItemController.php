<?php
namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Item;
use App\Models\Market;
use App\Models\ProductReview;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
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
            'image_url' => ['nullable', 'string', 'max:2048'],
            'variants' => ['nullable', 'array'],
            'availability_schedule' => ['nullable', 'array'],
            'ingredients' => ['nullable', 'array'],
            'ingredients.*.name' => ['required_with:ingredients', 'string', 'max:120'],
            'ingredients.*.removable' => ['nullable', 'boolean'],
            'combo_offers' => ['nullable', 'array'],
            'combo_offers.*.name' => ['required_with:combo_offers', 'string', 'max:120'],
            'combo_offers.*.description' => ['nullable', 'string', 'max:255'],
            'combo_offers.*.combo_price' => ['required_with:combo_offers', 'numeric', 'min:0'],
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
            'ingredients' => $this->normalizeIngredients($data['ingredients'] ?? null),
            'combo_offers' => $this->normalizeComboOffers($data['combo_offers'] ?? null),
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
            'image_url' => ['nullable', 'string', 'max:2048'],
            'variants' => ['nullable', 'array'],
            'availability_schedule' => ['nullable', 'array'],
            'ingredients' => ['nullable', 'array'],
            'ingredients.*.name' => ['required_with:ingredients', 'string', 'max:120'],
            'ingredients.*.removable' => ['nullable', 'boolean'],
            'combo_offers' => ['nullable', 'array'],
            'combo_offers.*.name' => ['required_with:combo_offers', 'string', 'max:120'],
            'combo_offers.*.description' => ['nullable', 'string', 'max:255'],
            'combo_offers.*.combo_price' => ['required_with:combo_offers', 'numeric', 'min:0'],
            'low_stock_threshold' => ['sometimes', 'integer', 'min:0'],
        ]);

        if (array_key_exists('ingredients', $data)) {
            $data['ingredients'] = $this->normalizeIngredients($data['ingredients']);
        }

        if (array_key_exists('combo_offers', $data)) {
            $data['combo_offers'] = $this->normalizeComboOffers($data['combo_offers']);
        }

        $item->update($data);
        return $this->serializeItem($item->fresh());
    }

    public function uploadImage(Request $request, Market $market, Item $item)
    {
        if ($item->market_id !== $market->id) {
            return response()->json(['message' => 'Item does not belong to market'], 400);
        }

        $request->validate([
            'image' => ['nullable', 'image', 'max:4096'],
            'images' => ['nullable', 'array', 'max:8'],
            'images.*' => ['image', 'max:4096'],
        ]);

        $uploads = [];

        if ($request->hasFile('image')) {
            $uploads[] = $request->file('image');
        }

        if ($request->hasFile('images')) {
            foreach ($request->file('images') as $file) {
                $uploads[] = $file;
            }
        }

        if ($uploads === []) {
            return response()->json(['message' => 'At least one image is required'], 422);
        }

        $storedPaths = collect($uploads)
            ->map(fn ($file) => $file->store('item-images', 'public'))
            ->values()
            ->all();

        $this->deleteStoredImages($item);

        $item->update([
            'image_path' => $storedPaths[0] ?? null,
            'image_paths' => $storedPaths,
        ]);

        return response()->json($this->serializeItem($item->fresh()));
    }

    public function deleteImage(Market $market, Item $item, int $imageIndex)
    {
        if ($item->market_id !== $market->id) {
            return response()->json(['message' => 'Item does not belong to market'], 400);
        }

        $paths = collect($item->image_paths ?? [])
            ->values()
            ->all();

        if (!array_key_exists($imageIndex, $paths)) {
            return response()->json(['message' => 'Image not found'], 404);
        }

        $removedPath = $paths[$imageIndex];
        unset($paths[$imageIndex]);
        $paths = array_values($paths);

        if (is_string($removedPath) && $removedPath !== '') {
            Storage::disk('public')->delete($removedPath);
        }

        $item->update([
            'image_path' => $paths[0] ?? null,
            'image_paths' => $paths === [] ? null : $paths,
        ]);

        return response()->json($this->serializeItem($item->fresh()));
    }

    public function clearImages(Market $market, Item $item)
    {
        if ($item->market_id !== $market->id) {
            return response()->json(['message' => 'Item does not belong to market'], 400);
        }

        $this->deleteStoredImages($item);

        $item->update([
            'image_path' => null,
            'image_paths' => null,
        ]);

        return response()->json($this->serializeItem($item->fresh()));
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
                    'ingredients' => $this->normalizeIngredients(!empty($row['ingredients']) ? json_decode($row['ingredients'], true) : null),
                    'combo_offers' => $this->normalizeComboOffers(!empty($row['combo_offers']) ? json_decode($row['combo_offers'], true) : null),
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

        $columns = ['name', 'sku', 'category', 'price', 'discount_type', 'discount_value', 'stock_qty', 'low_stock_threshold', 'is_active', 'image_url', 'variants', 'availability_schedule', 'ingredients', 'combo_offers'];

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
                    $item->ingredients ? json_encode($item->ingredients) : '',
                    $item->combo_offers ? json_encode($item->combo_offers) : '',
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
            'image_urls' => $this->resolveImageUrls($item),
            'variants' => $item->variants,
            'availability_schedule' => $item->availability_schedule,
            'ingredients' => $item->ingredients ?? [],
            'combo_offers' => $item->combo_offers ?? [],
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

    private function normalizeIngredients(?array $ingredients): ?array
    {
        if (!is_array($ingredients)) {
            return null;
        }

        $normalized = collect($ingredients)
            ->filter(fn ($ingredient) => is_array($ingredient))
            ->map(function (array $ingredient) {
                $name = trim((string) ($ingredient['name'] ?? ''));

                if ($name === '') {
                    return null;
                }

                return [
                    'name' => $name,
                    'removable' => (bool) ($ingredient['removable'] ?? false),
                ];
            })
            ->filter()
            ->values()
            ->all();

        return $normalized === [] ? null : $normalized;
    }

    private function normalizeComboOffers(?array $comboOffers): ?array
    {
        if (!is_array($comboOffers)) {
            return null;
        }

        $normalized = collect($comboOffers)
            ->filter(fn ($comboOffer) => is_array($comboOffer))
            ->map(function (array $comboOffer) {
                $name = trim((string) ($comboOffer['name'] ?? ''));

                if ($name === '') {
                    return null;
                }

                return [
                    'name' => $name,
                    'description' => trim((string) ($comboOffer['description'] ?? '')) ?: null,
                    'combo_price' => round((float) ($comboOffer['combo_price'] ?? 0), 2),
                ];
            })
            ->filter()
            ->values()
            ->all();

        return $normalized === [] ? null : $normalized;
    }

    private function resolveImageUrls(Item $item): array
    {
        $urls = [];

        foreach (($item->image_paths ?? []) as $path) {
            if (is_string($path) && $path !== '') {
                $urls[] = url(Storage::disk('public')->url($path));
            }
        }

        if ($urls === [] && $item->image_path) {
            $urls[] = url(Storage::disk('public')->url($item->image_path));
        }

        if (is_string($item->getRawOriginal('image_url')) && trim((string) $item->getRawOriginal('image_url')) !== '') {
            $urls[] = trim((string) $item->getRawOriginal('image_url'));
        }

        return collect($urls)->filter()->unique()->values()->all();
    }

    private function deleteStoredImages(Item $item): void
    {
        $paths = collect($item->image_paths ?? [])
            ->push($item->image_path)
            ->filter(fn ($path) => is_string($path) && $path !== '')
            ->unique()
            ->values()
            ->all();

        if ($paths !== []) {
            Storage::disk('public')->delete($paths);
        }
    }
}
