import { Alert as RNAlert, Pressable, StyleSheet, View } from "react-native";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";

import {
  Alert,
  AppText,
  Badge,
  Button,
  Chip,
  ChipRow,
  Input,
  OptionCard,
  Panel,
  Row,
  SegmentedControl,
  Separator,
  Sheet,
  Switch,
  useColors,
  withAlpha,
  type IconName,
} from "@/src/components/ui";
import { usePreferences } from "@/src/providers/app-providers";
import { formatMoney } from "@/src/lib/format";

import { ComboOfferEditor, IngredientEditor, ScheduleEditor, VariantEditor } from "./item-editors";
import {
  computeFinalPrice,
  emptyComboOffer,
  type AvailabilitySlot,
  type ComboOffer,
  type ComboSelectableItem,
  type DiscountType,
  type ItemIngredient,
  type ItemKind,
  type ItemVariant,
  type PickedImage,
} from "./helpers";

export type ItemFormValues = {
  itemKind: ItemKind;
  name: string;
  sku: string;
  category: string;
  price: string;
  discountType: DiscountType;
  discountValue: string;
  stockQty: string;
  lowStockThreshold: string;
  isActive: boolean;
  imageUrl: string;
  images: PickedImage[];
  variants: ItemVariant[];
  schedule: AvailabilitySlot[];
  ingredients: ItemIngredient[];
  comboOffers: ComboOffer[];
};

export type ItemFormTab = "basics" | "pricing" | "inventory" | "media" | "composition" | "options";

type GalleryProps = {
  urls: string[];
  onDelete: (index: number) => void;
  onClearAll: () => void;
  busy: boolean;
};

function SwitchRow({ title, description, value, onValueChange }: { title: string; description: string; value: boolean; onValueChange: (value: boolean) => void }) {
  return (
    <Panel>
      <Row justify="space-between" gap={12}>
        <View style={styles.flex}>
          <AppText variant="label">{title}</AppText>
          <AppText variant="caption">{description}</AppText>
        </View>
        <Switch value={value} onValueChange={onValueChange} />
      </Row>
    </Panel>
  );
}

function SectionHeading({ title, description }: { title: string; description?: string }) {
  return (
    <View style={styles.gap2}>
      <AppText variant="heading">{title}</AppText>
      {description ? <AppText variant="small" tone="muted">{description}</AppText> : null}
    </View>
  );
}

export function ItemFormSheet({
  visible,
  onClose,
  mode,
  tab,
  onTabChange,
  values,
  onChange,
  comboItems,
  categories,
  gallery,
  onPickImages,
  error,
  missing,
  canSubmit,
  submitting,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  tab: ItemFormTab;
  onTabChange: (tab: ItemFormTab) => void;
  values: ItemFormValues | null;
  onChange: (patch: Partial<ItemFormValues>) => void;
  comboItems: ComboSelectableItem[];
  categories: string[];
  gallery?: GalleryProps;
  onPickImages: () => void;
  error?: string | null;
  missing: string[];
  canSubmit: boolean;
  submitting: boolean;
  onSubmit: () => void;
}) {
  const c = useColors();
  const { language } = usePreferences();

  const title = mode === "create" ? "Add product" : `Edit ${values?.name || "product"}`;
  const description =
    mode === "create"
      ? "Fill in the basics and price. Everything else is optional."
      : "Changes are saved when you tap Save changes.";

  const footer = (
    <>
      <Button variant="outline" onPress={onClose} style={styles.flex}>
        Cancel
      </Button>
      <Button onPress={onSubmit} disabled={!canSubmit} loading={submitting} style={styles.flex}>
        {submitting ? "Saving..." : mode === "create" ? "Add product" : "Save changes"}
      </Button>
    </>
  );

  if (!values) {
    return <Sheet visible={visible} title={title} onClose={onClose} />;
  }

  const isCombo = values.itemKind === "combo";
  const basePrice = Number(values.price || 0);
  const finalPrice = computeFinalPrice(values.price, values.discountType, values.discountValue);
  const savings = Math.max(0, basePrice - finalPrice);
  const priceIsValid = values.price.trim() === "" || Number.isFinite(Number(values.price));

  const basicsMissing = missing.some((entry) => entry === "Name" || entry === "SKU");
  const pricingMissing = missing.includes("Price");
  const compositionMissing = missing.some((entry) => entry.startsWith("Combo"));

  const tabs: { value: ItemFormTab; label: string; icon: IconName; flag?: boolean }[] = [
    { value: "basics", label: "Basics", icon: "document-text-outline", flag: basicsMissing },
    { value: "pricing", label: "Pricing", icon: "pricetag-outline", flag: pricingMissing },
    { value: "inventory", label: "Inventory", icon: "cube-outline" },
    { value: "media", label: "Media", icon: "images-outline" },
    { value: "composition", label: isCombo ? "Combo" : "Ingredients", icon: isCombo ? "layers-outline" : "nutrition-outline", flag: compositionMissing },
    { value: "options", label: "Options", icon: "options-outline" },
  ];

  const setKind = (kind: ItemKind) => {
    if (kind === values.itemKind) return;
    if (kind === "regular") {
      onChange({ itemKind: "regular", comboOffers: [] });
    } else {
      onChange({
        itemKind: "combo",
        ingredients: [],
        comboOffers: values.comboOffers.length > 0 ? [values.comboOffers[0]] : [emptyComboOffer()],
      });
    }
  };

  const confirmDelete = (target: number | "all") => {
    if (!gallery) return;
    RNAlert.alert(
      target === "all" ? "Delete all images?" : "Delete this image?",
      target === "all"
        ? "Every image of this product will be removed right away. This cannot be undone."
        : "The image will be removed from this product right away. This cannot be undone.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: () => (target === "all" ? gallery.onClearAll() : gallery.onDelete(target)),
        },
      ],
    );
  };

  return (
    <Sheet visible={visible} title={title} description={description} onClose={onClose} footer={footer}>
      <ChipRow>
        {tabs.map((entry) => (
          <Chip
            key={entry.value}
            label={entry.flag ? `${entry.label} •` : entry.label}
            icon={entry.icon}
            selected={tab === entry.value}
            onPress={() => onTabChange(entry.value)}
          />
        ))}
      </ChipRow>

      {tab === "basics" ? (
        <>
          <View style={styles.gap8}>
            <AppText variant="label">Product type</AppText>
            <OptionCard
              selected={values.itemKind === "regular"}
              onPress={() => setKind("regular")}
              icon="cube-outline"
              title="Regular product"
              description="A single product with its own ingredients."
            />
            <OptionCard
              selected={values.itemKind === "combo"}
              onPress={() => (comboItems.length === 0 ? undefined : setKind("combo"))}
              icon="layers-outline"
              title="Combo product"
              description={
                comboItems.length === 0
                  ? "Available once this market has other products."
                  : "A bundle made from other products in this market."
              }
            />
          </View>
          <Input label="Product name" value={values.name} onChangeText={(name) => onChange({ name })} placeholder="e.g. Margherita pizza" />
          <Input
            label="SKU"
            value={values.sku}
            onChangeText={(sku) => onChange({ sku })}
            placeholder="e.g. PIZ-001"
            autoCapitalize="characters"
            helper="Your internal code. Must be unique inside this market."
          />
          <Input
            label="Category"
            value={values.category}
            onChangeText={(category) => onChange({ category })}
            placeholder="e.g. Pizza"
            helper="Pick an existing category or type a new one."
          />
          {categories.length > 0 ? (
            <ChipRow>
              {categories.map((entry) => (
                <Chip key={entry} label={entry} selected={values.category.trim() === entry} onPress={() => onChange({ category: entry })} />
              ))}
            </ChipRow>
          ) : null}
          <SwitchRow
            title="Visible in store"
            description="When off, the product is hidden from the public storefront."
            value={values.isActive}
            onValueChange={(isActive) => onChange({ isActive })}
          />
        </>
      ) : null}

      {tab === "pricing" ? (
        <>
          <Input
            label={isCombo ? "Combo price" : "Price"}
            value={values.price}
            onChangeText={(price) => onChange({ price })}
            keyboardType="decimal-pad"
            placeholder={isCombo ? "e.g. 17.50" : "e.g. 10.50"}
            error={!priceIsValid ? "Enter a number, e.g. 10.50" : null}
            helper="Price before any discount."
          />
          <View style={styles.gap8}>
            <AppText variant="label">Discount type</AppText>
            <SegmentedControl<DiscountType>
              value={values.discountType}
              onChange={(discountType) => onChange({ discountType })}
              options={[
                { value: "none", label: "None" },
                { value: "percent", label: "Percent" },
                { value: "fixed", label: "Fixed" },
              ]}
            />
          </View>
          <Input
            label="Discount value"
            value={values.discountValue}
            onChangeText={(discountValue) => onChange({ discountValue })}
            keyboardType="decimal-pad"
            placeholder={values.discountType === "percent" ? "e.g. 10" : "e.g. 2.00"}
            helper={
              values.discountType === "percent"
                ? "Percentage taken off the price."
                : values.discountType === "fixed"
                  ? "Amount taken off the price."
                  : "Not used while there is no discount."
            }
          />
          <Panel>
            <AppText variant="caption">Customer pays (estimate)</AppText>
            <Row justify="space-between" align="flex-end" gap={12} wrap>
              <Row gap={8} align="flex-end">
                <AppText variant="title">{formatMoney(finalPrice, language)}</AppText>
                {savings > 0 ? (
                  <AppText variant="small" tone="muted" style={styles.strike}>
                    {formatMoney(basePrice, language)}
                  </AppText>
                ) : null}
              </Row>
              {savings > 0 ? (
                <Badge tone="success">{`Saves ${formatMoney(savings, language)}`}</Badge>
              ) : (
                <AppText variant="caption">No discount applied</AppText>
              )}
            </Row>
          </Panel>
        </>
      ) : null}

      {tab === "inventory" ? (
        <>
          <Input
            label="Stock quantity"
            value={values.stockQty}
            onChangeText={(stockQty) => onChange({ stockQty })}
            keyboardType="number-pad"
            helper="Units currently available to sell."
          />
          <Input
            label="Low stock alert at"
            value={values.lowStockThreshold}
            onChangeText={(lowStockThreshold) => onChange({ lowStockThreshold })}
            keyboardType="number-pad"
            helper="The product is flagged as low stock at or below this number."
          />
        </>
      ) : null}

      {tab === "media" ? (
        <>
          {gallery ? (
            <View style={styles.gap12}>
              <Row justify="space-between" gap={8} wrap>
                <SectionHeading title="Current images" description="Images customers see on the product page." />
                {gallery.urls.length > 0 ? (
                  <Button variant="outline" size="sm" icon="trash-outline" onPress={() => confirmDelete("all")} disabled={gallery.busy}>
                    Delete all
                  </Button>
                ) : null}
              </Row>
              {gallery.urls.length > 0 ? (
                <View style={styles.grid}>
                  {gallery.urls.map((url, index) => (
                    <View key={`${url}-${index}`} style={[styles.galleryTile, { borderColor: c.border, backgroundColor: c.muted }]}>
                      <Image source={url} style={styles.galleryImage} contentFit="cover" />
                      {index === 0 ? (
                        <View style={[styles.coverTag, { backgroundColor: withAlpha(c.background, 0.9) }]}>
                          <AppText variant="caption" tone="default">
                            Cover
                          </AppText>
                        </View>
                      ) : null}
                      <Pressable
                        onPress={() => confirmDelete(index)}
                        disabled={gallery.busy}
                        accessibilityRole="button"
                        accessibilityLabel={`Delete image ${index + 1}`}
                        style={[styles.deleteTile, { backgroundColor: c.secondary, opacity: gallery.busy ? 0.5 : 1 }]}
                      >
                        <Ionicons name="trash-outline" size={16} color={c.secondaryForeground} />
                      </Pressable>
                    </View>
                  ))}
                </View>
              ) : (
                <View style={[styles.dashed, { borderColor: c.border }]}>
                  <Ionicons name="image-outline" size={16} color={c.mutedForeground} />
                  <AppText variant="small" tone="muted">
                    This product has no images yet.
                  </AppText>
                </View>
              )}
              <Separator />
            </View>
          ) : null}

          <AppText variant="label">{gallery ? "Upload new images" : "Upload images"}</AppText>
          <Pressable
            onPress={onPickImages}
            accessibilityRole="button"
            style={({ pressed }) => [styles.dropzone, { borderColor: c.border, backgroundColor: withAlpha(c.muted, pressed ? 0.9 : 0.5) }]}
          >
            <View style={[styles.dropIcon, { backgroundColor: c.background }]}>
              <Ionicons name="image-outline" size={20} color={c.mutedForeground} />
            </View>
            <AppText variant="label">Tap to choose images</AppText>
            <AppText variant="caption" style={styles.center}>
              {values.images.length > 0
                ? `${values.images.length} ${gallery ? "new " : ""}image${values.images.length === 1 ? "" : "s"} selected. They upload when you save.`
                : "You can select several images at once. They upload when you save."}
            </AppText>
          </Pressable>
          {values.images.length > 0 ? (
            <View style={styles.grid}>
              {values.images.map((image, index) => (
                <Image key={`${image.uri}-${index}`} source={image.uri} style={[styles.thumb, { backgroundColor: c.muted, borderColor: c.border }]} contentFit="cover" />
              ))}
            </View>
          ) : null}
          <Input
            label="External image URL"
            value={values.imageUrl}
            onChangeText={(imageUrl) => onChange({ imageUrl })}
            placeholder="https://..."
            autoCapitalize="none"
            keyboardType="url"
            helper="Optional. Used as a fallback when no image is uploaded."
          />
        </>
      ) : null}

      {tab === "composition" ? (
        isCombo ? (
          <>
            <SectionHeading title="Combo contents" description="Select the products from this market that are included in this combo." />
            <ComboOfferEditor comboOffers={values.comboOffers} availableItems={comboItems} itemKind="combo" onChange={(comboOffers) => onChange({ comboOffers })} />
          </>
        ) : (
          <>
            <SectionHeading title="Ingredients" description="List every ingredient used in this product and mark the optional ones as removable." />
            <IngredientEditor ingredients={values.ingredients} onChange={(ingredients) => onChange({ ingredients })} />
            {values.comboOffers.length > 0 ? (
              <>
                <Separator />
                <SectionHeading title="Combo offers" description="Optional bundle prices customers can choose during checkout." />
                <ComboOfferEditor comboOffers={values.comboOffers} availableItems={comboItems} itemKind="regular" onChange={(comboOffers) => onChange({ comboOffers })} />
              </>
            ) : (
              <Panel>
                <Row gap={8}>
                  <Ionicons name="restaurant-outline" size={14} color={c.mutedForeground} />
                  <AppText variant="caption" style={styles.flex}>
                    Want to sell a bundle? Switch the product type to Combo in Basics.
                  </AppText>
                </Row>
              </Panel>
            )}
          </>
        )
      ) : null}

      {tab === "options" ? (
        <>
          <SectionHeading title="Variants" description="Customer choices like size, color or pack type. Extra price is added to the base price." />
          <VariantEditor variants={values.variants} onChange={(variants) => onChange({ variants })} />
          <Separator />
          <SectionHeading title="Availability schedule" description="Leave empty if the product is always available, or add day and time slots (e.g. 09:00 - 18:00)." />
          <ScheduleEditor schedule={values.schedule} onChange={(schedule) => onChange({ schedule })} />
        </>
      ) : null}

      {error ? <Alert tone="destructive" title="Could not save the product" description={error} /> : null}

      {mode === "create" ? (
        <AppText variant="caption" tone={missing.length > 0 ? "muted" : "success"}>
          {missing.length > 0 ? `Still required: ${missing.join(", ")}` : "All required fields are filled in."}
        </AppText>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { textAlign: "center" },
  gap2: { gap: 2, flexShrink: 1 },
  gap8: { gap: 8 },
  gap12: { gap: 12 },
  strike: { textDecorationLine: "line-through", marginBottom: 3 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  galleryTile: { width: "48%", aspectRatio: 4 / 3, borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  galleryImage: { width: "100%", height: "100%" },
  coverTag: { position: "absolute", top: 6, left: 6, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  deleteTile: { position: "absolute", top: 6, right: 6, width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  dashed: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 14 },
  dropzone: { alignItems: "center", justifyContent: "center", gap: 6, borderWidth: 1, borderStyle: "dashed", borderRadius: 10, paddingVertical: 20, paddingHorizontal: 16 },
  dropIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  thumb: { width: 64, height: 64, borderRadius: 8, borderWidth: 1 },
});
