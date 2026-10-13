<?php

// Market types and the catalog features each one unlocks for its owner.
// Keep in sync with web/src/lib/market-types.ts.
//
// Features:
//   multi_buy - "Buy X get Y free" deals such as 1+1 or 2+1
//   specs     - product specifications (brand, warranty, fitment, ...)

return [
    'grocery' => [
        'label' => 'Grocery',
        'features' => ['multi_buy'],
    ],
    'restaurant' => [
        'label' => 'Restaurant',
        'features' => ['multi_buy'],
    ],
    'cafe_bakery' => [
        'label' => 'Cafe & Bakery',
        'features' => ['multi_buy'],
    ],
    'electronics' => [
        'label' => 'Electronics',
        'features' => ['specs'],
    ],
    'auto_parts' => [
        'label' => 'Auto Parts',
        'features' => ['specs'],
    ],
    'home_appliances' => [
        'label' => 'Home Appliances',
        'features' => ['specs'],
    ],
    'pharmacy_beauty' => [
        'label' => 'Pharmacy & Beauty',
        'features' => ['multi_buy', 'specs'],
    ],
    'flowers_gifts' => [
        'label' => 'Flowers & Gifts',
        'features' => ['multi_buy'],
    ],
    'pet_supplies' => [
        'label' => 'Pet Supplies',
        'features' => ['multi_buy', 'specs'],
    ],
    'general' => [
        'label' => 'General Store',
        'features' => ['multi_buy', 'specs'],
    ],
];
