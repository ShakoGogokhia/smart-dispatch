import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Alert as RNAlert, StyleSheet, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { Ionicons } from "@expo/vector-icons";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import {
  Alert,
  AppText,
  Avatar,
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  EmptyState,
  IconButton,
  Input,
  ListItem,
  LoadingBlock,
  OptionCard,
  Panel,
  Row,
  SegmentedControl,
  Sheet,
  StatCard,
  StatGrid,
  Switch,
  useColors,
  withAlpha,
  type IconName,
} from "@/src/components/ui";
import {
  buildComboPayload,
  computeFinalPrice,
  emptyComboOffer,
  getComboSelectableItems,
  getItemImageUrls,
  getItemIngredientsPayload,
  getStockState,
  hasDiscount,
  hydrateComboOffers,
  normalizeAvailabilitySchedule,
  normalizeVariants,
  promoStatus,
  resolveMediaUrl,
  type AvailabilitySlot,
  type ComboOffer,
  type ItemIngredient,
  type ItemVariant,
  type PickedImage,
  type StaffUser,
} from "@/src/components/market-management/helpers";
import { ItemFormSheet, type ItemFormTab, type ItemFormValues } from "@/src/components/market-management/item-form-sheet";
import { ProductCard } from "@/src/components/market-management/product-card";
import { PromoCard, PromoFormSheet, usePromoValueLabel, type PromoFormValues } from "@/src/components/market-management/promo-components";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { toNumber } from "@/src/lib/format";
import type { Item, MarketLite, PromoCode } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type MarketSettingsProps = NativeStackScreenProps<RootStackParamList, "MarketSettings">;
type MarketItemsProps = NativeStackScreenProps<RootStackParamList, "MarketItems">;
type MarketPromoCodesProps = NativeStackScreenProps<RootStackParamList, "MarketPromoCodes">;

/** Short-lived success message (the mobile stand-in for the web toasts). */
function useFlash() {
  const [message, setMessage] = useState<string | null>(null);
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => setMessage(null), 3500);
    return () => clearTimeout(timer);
  }, [message]);
  return [message, setMessage] as const;
}

async function pickSingleImage(fallbackName: string): Promise<PickedImage | null> {
  const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!permission.granted) {
    return null;
  }

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ["images"],
    quality: 0.8,
  });

  if (result.canceled || !result.assets[0]) {
    return null;
  }

  const asset = result.assets[0];
  return {
    uri: asset.uri,
    name: asset.fileName || fallbackName,
    type: asset.mimeType || "image/jpeg",
  };
}

/* =================================================================================================
 * Market settings
 * ===============================================================================================*/

type SettingsTab = "general" | "branding" | "team" | "danger";

function SummaryTile({ label, value, badge, hint }: { label: string; value: string; badge?: ReactNode; hint?: string }) {
  return (
    <Card style={styles.summaryTile}>
      <Row justify="space-between" gap={6}>
        <AppText variant="caption" numberOfLines={1}>
          {label}
        </AppText>
        {badge}
      </Row>
      <AppText variant="label" numberOfLines={1}>
        {value}
      </AppText>
      {hint ? (
        <AppText variant="caption" numberOfLines={2}>
          {hint}
        </AppText>
      ) : null}
    </Card>
  );
}

export function MarketSettingsScreen({ navigation, route }: MarketSettingsProps) {
  const { marketId } = route.params;
  const access = useProtectedAccess("MarketSettings", { marketId });
  const queryClient = useQueryClient();
  const c = useColors();
  const [tab, setTab] = useState<SettingsTab>("general");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedLogo, setSelectedLogo] = useState<PickedImage | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<PickedImage | null>(null);
  const [staffUserId, setStaffUserId] = useState("");
  const [flash, setFlash] = useFlash();

  const id = Number(marketId);
  const roles = access.me?.roles ?? [];
  const isAdmin = roles.includes("admin");

  const marketsQ = useQuery({
    queryKey: ["market-settings-source", id, isAdmin],
    queryFn: async () => {
      const url = isAdmin ? "/api/markets" : "/api/my/markets";
      return (await api.get(url)).data as MarketLite[];
    },
    enabled: access.ready && Number.isFinite(id),
  });

  const market = useMemo(() => (marketsQ.data ?? []).find((entry) => Number(entry.id) === id) ?? null, [id, marketsQ.data]);

  useEffect(() => {
    if (!market) {
      return;
    }
    setName(market.name ?? "");
    setAddress(market.address ?? "");
    setIsActive(typeof market.is_active === "boolean" ? market.is_active : true);
  }, [market]);

  const updateMarketM = useMutation({
    mutationFn: async () =>
      (
        await api.patch(`/api/markets/${id}`, {
          name: name.trim(),
          address: address.trim() || null,
          is_active: isActive,
        })
      ).data as MarketLite,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market-settings-source"] });
    },
  });

  const uploadLogoM = useMutation({
    mutationFn: async () => {
      if (!selectedLogo) {
        throw new Error("Select a logo first");
      }

      const formData = new FormData();
      formData.append("logo", {
        uri: selectedLogo.uri,
        type: selectedLogo.type,
        name: selectedLogo.name,
      } as never);

      return (
        await api.post(`/api/markets/${id}/logo`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: async () => {
      setSelectedLogo(null);
      await queryClient.invalidateQueries({ queryKey: ["market-settings-source"] });
    },
  });

  const uploadBannerM = useMutation({
    mutationFn: async () => {
      if (!selectedBanner) {
        throw new Error("Select a banner first");
      }

      const formData = new FormData();
      formData.append("banner", {
        uri: selectedBanner.uri,
        type: selectedBanner.type,
        name: selectedBanner.name,
      } as never);

      return (
        await api.post(`/api/markets/${id}/banner`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data;
    },
    onSuccess: async () => {
      setSelectedBanner(null);
      await queryClient.invalidateQueries({ queryKey: ["market-settings-source"] });
    },
  });

  const staffQ = useQuery({
    queryKey: ["market-staff", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/staff`)).data as StaffUser[],
    enabled: access.ready && Number.isFinite(id) && tab === "team",
    retry: false,
  });

  const assignableUsersQ = useQuery({
    queryKey: ["market-assignable-users", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/assignable-users`)).data as StaffUser[],
    enabled: access.ready && Number.isFinite(id) && tab === "team",
    retry: false,
  });

  const addStaffM = useMutation({
    mutationFn: async () => (await api.post(`/api/markets/${id}/staff`, { user_id: Number(staffUserId), role: "staff" })).data,
    onSuccess: async () => {
      setStaffUserId("");
      await queryClient.invalidateQueries({ queryKey: ["market-staff", id] });
      await queryClient.invalidateQueries({ queryKey: ["market-assignable-users", id] });
    },
  });

  const removeStaffM = useMutation({
    mutationFn: async (userId: number) => (await api.delete(`/api/markets/${id}/staff/${userId}`)).data,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market-staff", id] });
      await queryClient.invalidateQueries({ queryKey: ["market-assignable-users", id] });
    },
  });

  async function pickLogo() {
    const picked = await pickSingleImage("market-logo.jpg");
    if (picked) setSelectedLogo(picked);
  }

  async function pickBanner() {
    const picked = await pickSingleImage("market-banner.jpg");
    if (picked) setSelectedBanner(picked);
  }

  function confirmRemoveStaff(user: StaffUser) {
    RNAlert.alert(`Remove ${user.name}?`, "They will lose access to this market. You can add them again later.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: () => removeStaffM.mutate(user.id, { onSuccess: () => setFlash(`${user.name} removed`) }),
      },
    ]);
  }

  if (!access.ready) {
    return access.fallback;
  }

  const saveDisabled = updateMarketM.isPending || !name.trim();
  const saveFooter = (
    <View style={styles.footerStack}>
      {updateMarketM.error ? (
        <AppText variant="caption" tone="destructive">
          {getErrorMessage(updateMarketM.error)}
        </AppText>
      ) : (
        <AppText variant="caption">Saves the name, address and storefront visibility.</AppText>
      )}
      <Button
        onPress={() => updateMarketM.mutate(undefined, { onSuccess: () => setFlash("Market settings saved") })}
        disabled={saveDisabled}
        loading={updateMarketM.isPending}
        fullWidth
      >
        {updateMarketM.isPending ? "Saving..." : "Save changes"}
      </Button>
    </View>
  );

  const logoSrc = selectedLogo?.uri ?? resolveMediaUrl(market?.logo_url);
  const bannerSrc = selectedBanner?.uri ?? resolveMediaUrl(market?.banner_url);

  return (
    <AppShell
      navigation={navigation}
      screenName="MarketSettings"
      marketId={marketId}
      title={market?.name ?? "Market settings"}
      subtitle="Manage this market's details, branding, team and visibility."
    >
      <Row wrap gap={8}>
        <Button variant="outline" size="sm" icon="cube-outline" onPress={() => navigation.navigate("MarketItems", { marketId })}>
          Products
        </Button>
        <Button variant="outline" size="sm" icon="pricetags-outline" onPress={() => navigation.navigate("MarketPromoCodes", { marketId })}>
          Promo codes
        </Button>
      </Row>

      {marketsQ.isError ? <Alert tone="destructive" title="Could not load markets" description={getErrorMessage(marketsQ.error)} /> : null}

      {marketsQ.isLoading ? (
        <LoadingBlock message="Loading market..." rows={4} />
      ) : !market ? (
        <EmptyState
          icon="storefront-outline"
          title="Market not found"
          description="This market is not in your accessible list. It may have been removed, or you may not have access to it."
        />
      ) : (
        <>
          <View style={styles.tileGrid}>
            <SummaryTile label="Market code" value={market.code} />
            <SummaryTile
              label="Visibility"
              value={market.is_active === false ? "Hidden from marketplace" : "Publicly live"}
              badge={<Badge tone={market.is_active === false ? "neutral" : "success"} dot>{market.is_active === false ? "Hidden" : "Live"}</Badge>}
            />
            <SummaryTile label="Promotion" value={market.is_featured ? market.featured_badge || "Promoted" : "Standard placement"} />
            <SummaryTile label="Catalog" value={`${market.active_items_count ?? 0} visible items`} />
          </View>

          {flash ? <Alert tone="success" title={flash} /> : null}

          <SegmentedControl<SettingsTab>
            value={tab}
            onChange={setTab}
            options={[
              { value: "general", label: "General" },
              { value: "branding", label: "Branding" },
              { value: "team", label: "Team" },
              { value: "danger", label: "Danger" },
            ]}
          />

          {tab === "general" ? (
            <Card title="General" description="The market name and location shown to customers and used for deliveries." footer={saveFooter}>
              <Input label="Name" value={name} onChangeText={setName} placeholder="Market name" error={!name.trim() ? "A name is required." : null} />
              <Input label="Code" value={market.code} onChangeText={() => undefined} editable={false} helper="The market code can only be changed by an admin." />
              <Input label="Address" value={address} onChangeText={setAddress} placeholder="Address" multiline icon="location-outline" />
            </Card>
          ) : null}

          {tab === "branding" ? (
            <>
              <Card
                title="Market logo"
                description="A square image works best. It appears on the storefront and in market lists."
                footer={
                  <Button
                    icon="cloud-upload-outline"
                    onPress={() => uploadLogoM.mutate(undefined, { onSuccess: () => setFlash("Logo uploaded") })}
                    disabled={!selectedLogo}
                    loading={uploadLogoM.isPending}
                    fullWidth
                  >
                    {uploadLogoM.isPending ? "Uploading..." : "Upload logo"}
                  </Button>
                }
              >
                <Row gap={14}>
                  <View style={[styles.logo, { backgroundColor: c.muted, borderColor: c.border }]}>
                    {logoSrc ? <Image source={logoSrc} style={styles.fill} contentFit="cover" /> : <Ionicons name="storefront-outline" size={24} color={c.mutedForeground} />}
                  </View>
                  <View style={[styles.flex, styles.gap6]}>
                    <Button variant="outline" size="sm" icon="image-outline" onPress={() => void pickLogo()} style={styles.selfStart}>
                      Choose image
                    </Button>
                    <AppText variant="caption" numberOfLines={2}>
                      {selectedLogo ? `Previewing ${selectedLogo.name}. Upload to publish it.` : market.logo_url ? "A logo is already set." : "No logo yet."}
                    </AppText>
                  </View>
                </Row>
                {uploadLogoM.error ? <Alert tone="destructive" title="Logo upload failed" description={getErrorMessage(uploadLogoM.error)} /> : null}
              </Card>

              <Card
                title="Market banner"
                description="A wide image shown at the top of the storefront and on market cards."
                footer={
                  <Button
                    icon="cloud-upload-outline"
                    onPress={() => uploadBannerM.mutate(undefined, { onSuccess: () => setFlash("Banner uploaded") })}
                    disabled={!selectedBanner}
                    loading={uploadBannerM.isPending}
                    fullWidth
                  >
                    {uploadBannerM.isPending ? "Uploading..." : "Upload banner"}
                  </Button>
                }
              >
                <View style={[styles.banner, { backgroundColor: c.muted, borderColor: c.border }]}>
                  {bannerSrc ? <Image source={bannerSrc} style={styles.fill} contentFit="cover" /> : <Ionicons name="image-outline" size={26} color={c.mutedForeground} />}
                </View>
                <Row justify="space-between" gap={8}>
                  <AppText variant="caption" numberOfLines={2} style={styles.flex}>
                    {selectedBanner ? `Previewing ${selectedBanner.name}. Upload to publish it.` : market.banner_url ? "A banner is already set." : "No banner yet."}
                  </AppText>
                  <Button variant="outline" size="sm" icon="image-outline" onPress={() => void pickBanner()}>
                    Choose image
                  </Button>
                </Row>
                {uploadBannerM.error ? <Alert tone="destructive" title="Banner upload failed" description={getErrorMessage(uploadBannerM.error)} /> : null}
              </Card>

              <View style={styles.gap6}>
                <AppText variant="label">Storefront preview</AppText>
                <AppText variant="caption">How your market card looks to customers, including unsaved images.</AppText>
              </View>
              <Card padded={false}>
                <View style={[styles.previewBanner, { backgroundColor: c.muted }]}>
                  {bannerSrc ? <Image source={bannerSrc} style={styles.fill} contentFit="cover" /> : null}
                  {market.is_featured ? (
                    <View style={styles.previewBadge}>
                      <Badge tone="warning" variant="solid" icon="sparkles-outline">
                        {market.featured_badge || "Promoted"}
                      </Badge>
                    </View>
                  ) : null}
                </View>
                <Row align="flex-start" gap={12} style={styles.previewBody}>
                  <View style={[styles.previewLogo, { backgroundColor: c.card, borderColor: c.card }]}>
                    {logoSrc ? <Image source={logoSrc} style={styles.fill} contentFit="cover" /> : <Ionicons name="storefront-outline" size={20} color={c.mutedForeground} />}
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="heading" numberOfLines={1}>
                      {name || market.name}
                    </AppText>
                    <AppText variant="caption" numberOfLines={1}>
                      {address || "No address yet"}
                    </AppText>
                  </View>
                </Row>
                <View style={styles.previewFooter}>
                  <AppText variant="small" tone="muted" numberOfLines={2}>
                    {market.featured_headline || `Discover ${name || market.name}`}
                  </AppText>
                  <AppText variant="caption">{market.active_items_count ?? 0} items available</AppText>
                </View>
              </Card>
            </>
          ) : null}

          {tab === "team" ? (
            <>
              <Card
                title="Add staff"
                description="Select a user and attach them to this market as staff."
                footer={
                  <Button
                    icon="person-add-outline"
                    onPress={() => addStaffM.mutate(undefined, { onSuccess: () => setFlash("Staff member added") })}
                    disabled={!staffUserId}
                    loading={addStaffM.isPending}
                    fullWidth
                  >
                    {addStaffM.isPending ? "Adding..." : "Add staff"}
                  </Button>
                }
              >
                {assignableUsersQ.isLoading ? (
                  <LoadingBlock rows={2} message="Loading users..." />
                ) : assignableUsersQ.isError ? (
                  <Alert tone="destructive" title="Failed to load available users." />
                ) : (assignableUsersQ.data ?? []).length === 0 ? (
                  <EmptyState compact icon="people-outline" title="No assignable users available." />
                ) : (
                  <View style={styles.gap8}>
                    {(assignableUsersQ.data ?? []).map((user) => (
                      <OptionCard
                        key={user.id}
                        selected={staffUserId === String(user.id)}
                        onPress={() => setStaffUserId(String(user.id))}
                        title={user.name}
                        description={user.email}
                        right={user.is_owner ? <Badge tone="info">Owner</Badge> : undefined}
                      />
                    ))}
                  </View>
                )}
                {addStaffM.error ? <Alert tone="destructive" title="Could not add staff" description={getErrorMessage(addStaffM.error)} /> : null}
              </Card>

              <Card title="Team" description="People who can manage orders and products for this market.">
                {staffQ.isError ? <Alert tone="destructive" title="Could not load staff" description={getErrorMessage(staffQ.error)} /> : null}
                {staffQ.isLoading ? (
                  <LoadingBlock message="Loading staff..." rows={2} />
                ) : (staffQ.data ?? []).length === 0 ? (
                  <EmptyState compact icon="people-outline" title="No staff assigned yet" description="Add a user above to give them access to this market." />
                ) : (
                  <View style={styles.gap8}>
                    {(staffQ.data ?? []).map((user) => (
                      <Panel key={user.id}>
                        <Row gap={10}>
                          <Avatar name={user.name} size={36} />
                          <View style={styles.flex}>
                            <AppText variant="label" numberOfLines={1}>
                              {user.name}
                            </AppText>
                            <AppText variant="caption" numberOfLines={1}>
                              {user.email}
                            </AppText>
                          </View>
                          <Badge>{user.pivot?.role ?? "staff"}</Badge>
                        </Row>
                        <Button
                          variant="destructive"
                          size="sm"
                          icon="trash-outline"
                          onPress={() => confirmRemoveStaff(user)}
                          disabled={removeStaffM.isPending}
                          style={styles.selfEnd}
                        >
                          Remove
                        </Button>
                      </Panel>
                    ))}
                  </View>
                )}
                {removeStaffM.error ? <Alert tone="destructive" title="Could not remove staff" description={getErrorMessage(removeStaffM.error)} /> : null}
              </Card>
            </>
          ) : null}

          {tab === "danger" ? (
            <Card title="Danger zone" description="Changes here affect whether customers can find this market at all." footer={saveFooter} style={{ borderColor: withAlpha(c.destructive, 0.4) }}>
              <View style={[styles.dangerBox, { borderColor: withAlpha(c.destructive, 0.3), backgroundColor: withAlpha(c.destructive, 0.05) }]}>
                <View style={styles.flex}>
                  <AppText variant="label">Storefront active</AppText>
                  <AppText variant="caption">Controls public availability. Turning this off hides the market from the marketplace.</AppText>
                </View>
                <Switch value={isActive} onValueChange={setIsActive} />
              </View>
            </Card>
          ) : null}
        </>
      )}
    </AppShell>
  );
}

/* =================================================================================================
 * Products
 * ===============================================================================================*/

type StatusFilter = "all" | "active" | "hidden";
type StockFilter = "all" | "in" | "low" | "out" | "attention";
type PriceFilter = "all" | "discounted";
type SortKey = "default" | "name" | "price-asc" | "price-desc" | "stock-asc" | "newest";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "default", label: "Default order" },
  { value: "name", label: "Name A-Z" },
  { value: "price-asc", label: "Price: low to high" },
  { value: "price-desc", label: "Price: high to low" },
  { value: "stock-asc", label: "Stock: lowest first" },
  { value: "newest", label: "Newest first" },
];

const STOCK_OPTIONS: { value: StockFilter; label: string }[] = [
  { value: "all", label: "Any stock" },
  { value: "in", label: "In stock" },
  { value: "attention", label: "Low or out" },
  { value: "low", label: "Low stock" },
  { value: "out", label: "Out of stock" },
];

export function MarketItemsScreen({ navigation, route }: MarketItemsProps) {
  const { marketId } = route.params;
  const access = useProtectedAccess("MarketItems", { marketId });
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [name, setName] = useState("");
  const [sku, setSku] = useState("");
  const [price, setPrice] = useState("");
  const [discountType, setDiscountType] = useState<NonNullable<Item["discount_type"]>>("none");
  const [discountValue, setDiscountValue] = useState("");
  const [stockQty, setStockQty] = useState("0");
  const [category, setCategory] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [lowStockThreshold, setLowStockThreshold] = useState("5");
  const [createVariants, setCreateVariants] = useState<ItemVariant[]>([]);
  const [createSchedule, setCreateSchedule] = useState<AvailabilitySlot[]>([]);
  const [createSelectedImages, setCreateSelectedImages] = useState<PickedImage[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [createItemKind, setCreateItemKind] = useState<"regular" | "combo">("regular");
  const [createIngredients, setCreateIngredients] = useState<ItemIngredient[]>([]);
  const [createComboOffers, setCreateComboOffers] = useState<ComboOffer[]>([]);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editVariants, setEditVariants] = useState<ItemVariant[]>([]);
  const [editSchedule, setEditSchedule] = useState<AvailabilitySlot[]>([]);
  const [editSelectedImages, setEditSelectedImages] = useState<PickedImage[]>([]);
  const [createTab, setCreateTab] = useState<ItemFormTab>("basics");
  const [editTab, setEditTab] = useState<ItemFormTab>("basics");
  const [actionItem, setActionItem] = useState<Item | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [flash, setFlash] = useFlash();

  /* list presentation state */
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [stockFilter, setStockFilter] = useState<StockFilter>("all");
  const [priceFilter, setPriceFilter] = useState<PriceFilter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("default");

  const id = Number(marketId);
  const itemsQ = useQuery({
    queryKey: ["market-items", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/items`)).data as Item[],
    enabled: access.ready && Number.isFinite(id),
  });
  const items = useMemo(() => itemsQ.data ?? [], [itemsQ.data]);
  const createComboSelectableItems = getComboSelectableItems(items);
  const editComboSelectableItems = getComboSelectableItems(items, editItem?.id ?? null);
  const editItemKind: "regular" | "combo" = editItem?.item_kind === "combo" ? "combo" : "regular";

  const createM = useMutation({
    mutationFn: async () => {
      const created = (
        await api.post(`/api/markets/${id}/items`, {
          name,
          sku,
          item_kind: createItemKind,
          category: category.trim() || null,
          image_url: imageUrl.trim() || null,
          variants: normalizeVariants(createVariants),
          availability_schedule: normalizeAvailabilitySchedule(createSchedule),
          ingredients: getItemIngredientsPayload(createItemKind, createIngredients),
          combo_offers: buildComboPayload(createItemKind, createComboOffers, price),
          price: Number(price),
          discount_type: discountType,
          discount_value: Number(discountValue || 0),
          stock_qty: Number(stockQty || 0),
          low_stock_threshold: Number(lowStockThreshold || 5),
          is_active: isActive,
        })
      ).data as Item;

      if (createSelectedImages.length === 0) {
        return created;
      }

      const formData = new FormData();
      createSelectedImages.forEach((image) => {
        formData.append("images[]", {
          uri: image.uri,
          type: image.type,
          name: image.name,
        } as never);
      });

      return (
        await api.post(`/api/markets/${id}/items/${created.id}/image`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data as Item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market-items", id] });
      setCreateOpen(false);
      setFlash("Product added");
      setName("");
      setSku("");
      setPrice("");
      setDiscountType("none");
      setDiscountValue("");
      setStockQty("0");
      setCategory("");
      setImageUrl("");
      setLowStockThreshold("5");
      setCreateVariants([]);
      setCreateSchedule([]);
      setCreateItemKind("regular");
      setCreateIngredients([]);
      setCreateComboOffers([]);
      setCreateSelectedImages([]);
      setIsActive(true);
      setCreateTab("basics");
    },
  });

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editItem) {
        throw new Error("No item selected");
      }

      const updated = (
        await api.patch(`/api/markets/${id}/items/${editItem.id}`, {
          name: editItem.name,
          sku: editItem.sku,
          item_kind: editItem.item_kind ?? "regular",
          price: Number(editItem.price),
          discount_type: editItem.discount_type,
          discount_value: Number(editItem.discount_value || 0),
          stock_qty: Number(editItem.stock_qty || 0),
          category: editItem.category ?? null,
          image_url: editItem.image_url?.trim() || null,
          variants: normalizeVariants(editVariants),
          availability_schedule: normalizeAvailabilitySchedule(editSchedule),
          ingredients: getItemIngredientsPayload(editItemKind, (editItem.ingredients as ItemIngredient[] | null) ?? []),
          combo_offers: buildComboPayload(editItemKind, (editItem.combo_offers as ComboOffer[] | null) ?? [], editItem.price),
          low_stock_threshold: Number(editItem.low_stock_threshold || 5),
          is_active: !!editItem.is_active,
        })
      ).data as Item;

      if (editSelectedImages.length === 0) {
        return updated;
      }

      const formData = new FormData();
      editSelectedImages.forEach((image) => {
        formData.append("images[]", {
          uri: image.uri,
          type: image.type,
          name: image.name,
        } as never);
      });

      return (
        await api.post(`/api/markets/${id}/items/${editItem.id}/image`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        })
      ).data as Item;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["market-items", id] });
      setEditOpen(false);
      setFlash("Product saved");
      setEditItem(null);
      setEditVariants([]);
      setEditSchedule([]);
      setEditSelectedImages([]);
    },
  });

  const deleteImageM = useMutation({
    mutationFn: async (imageIndex: number) => {
      if (!editItem) {
        throw new Error("No item selected");
      }

      return (await api.delete(`/api/markets/${id}/items/${editItem.id}/images/${imageIndex}`)).data as Item;
    },
    onSuccess: async (updatedItem) => {
      await queryClient.invalidateQueries({ queryKey: ["market-items", id] });
      setEditItem(updatedItem);
    },
  });

  const clearImagesM = useMutation({
    mutationFn: async () => {
      if (!editItem) {
        throw new Error("No item selected");
      }

      return (await api.delete(`/api/markets/${id}/items/${editItem.id}/images`)).data as Item;
    },
    onSuccess: async (updatedItem) => {
      await queryClient.invalidateQueries({ queryKey: ["market-items", id] });
      setEditItem(updatedItem);
    },
  });

  async function pickItemImage(mode: "create" | "edit") {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const selectedImages = result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.fileName || "item-image.jpg",
      type: asset.mimeType || "image/jpeg",
    }));

    if (mode === "create") {
      setCreateSelectedImages(selectedImages);
      return;
    }

    setEditSelectedImages(selectedImages);
  }

  function openEdit(item: Item, tab: ItemFormTab) {
    setEditItem({
      ...item,
      item_kind: item.item_kind ?? "regular",
      ingredients: item.ingredients ?? [],
      combo_offers: hydrateComboOffers(item.combo_offers, getComboSelectableItems(items, item.id)),
    });
    setEditVariants((item.variants as ItemVariant[] | null) ?? []);
    setEditSchedule((item.availability_schedule as AvailabilitySlot[] | null) ?? []);
    setEditSelectedImages([]);
    setEditTab(tab);
    setEditOpen(true);
  }

  /* ---------------- form adapters ---------------- */
  const createValues: ItemFormValues = {
    itemKind: createItemKind,
    name,
    sku,
    category,
    price,
    discountType,
    discountValue,
    stockQty,
    lowStockThreshold,
    isActive,
    imageUrl,
    images: createSelectedImages,
    variants: createVariants,
    schedule: createSchedule,
    ingredients: createIngredients,
    comboOffers: createComboOffers,
  };

  const patchCreate = (patch: Partial<ItemFormValues>) => {
    if (patch.itemKind !== undefined) setCreateItemKind(patch.itemKind);
    if (patch.name !== undefined) setName(patch.name);
    if (patch.sku !== undefined) setSku(patch.sku);
    if (patch.category !== undefined) setCategory(patch.category);
    if (patch.price !== undefined) setPrice(patch.price);
    if (patch.discountType !== undefined) setDiscountType(patch.discountType);
    if (patch.discountValue !== undefined) setDiscountValue(patch.discountValue);
    if (patch.stockQty !== undefined) setStockQty(patch.stockQty);
    if (patch.lowStockThreshold !== undefined) setLowStockThreshold(patch.lowStockThreshold);
    if (patch.isActive !== undefined) setIsActive(patch.isActive);
    if (patch.imageUrl !== undefined) setImageUrl(patch.imageUrl);
    if (patch.images !== undefined) setCreateSelectedImages(patch.images);
    if (patch.variants !== undefined) setCreateVariants(patch.variants);
    if (patch.schedule !== undefined) setCreateSchedule(patch.schedule);
    if (patch.ingredients !== undefined) setCreateIngredients(patch.ingredients);
    if (patch.comboOffers !== undefined) setCreateComboOffers(patch.comboOffers);
  };

  const editValues: ItemFormValues | null = editItem
    ? {
        itemKind: editItemKind,
        name: editItem.name,
        sku: editItem.sku,
        category: editItem.category ?? "",
        price: String(editItem.price),
        discountType: editItem.discount_type ?? "none",
        discountValue: String(editItem.discount_value ?? 0),
        stockQty: String(editItem.stock_qty),
        lowStockThreshold: String(editItem.low_stock_threshold ?? 5),
        isActive: !!editItem.is_active,
        imageUrl: editItem.image_url ?? "",
        images: editSelectedImages,
        variants: editVariants,
        schedule: editSchedule,
        ingredients: (editItem.ingredients as ItemIngredient[] | null) ?? [],
        comboOffers: (editItem.combo_offers as ComboOffer[] | null) ?? [],
      }
    : null;

  const patchEdit = (patch: Partial<ItemFormValues>) => {
    if (patch.images !== undefined) setEditSelectedImages(patch.images);
    if (patch.variants !== undefined) setEditVariants(patch.variants);
    if (patch.schedule !== undefined) setEditSchedule(patch.schedule);
    if (!editItem) return;
    const next: Item = { ...editItem };
    let changed = false;
    if (patch.itemKind !== undefined) {
      next.item_kind = patch.itemKind;
      changed = true;
    }
    if (patch.name !== undefined) {
      next.name = patch.name;
      changed = true;
    }
    if (patch.sku !== undefined) {
      next.sku = patch.sku;
      changed = true;
    }
    if (patch.category !== undefined) {
      next.category = patch.category;
      changed = true;
    }
    if (patch.price !== undefined) {
      next.price = patch.price;
      changed = true;
    }
    if (patch.discountType !== undefined) {
      next.discount_type = patch.discountType;
      changed = true;
    }
    if (patch.discountValue !== undefined) {
      next.discount_value = patch.discountValue;
      changed = true;
    }
    if (patch.stockQty !== undefined) {
      next.stock_qty = Number(patch.stockQty);
      changed = true;
    }
    if (patch.lowStockThreshold !== undefined) {
      next.low_stock_threshold = Number(patch.lowStockThreshold || 0);
      changed = true;
    }
    if (patch.isActive !== undefined) {
      next.is_active = patch.isActive;
      changed = true;
    }
    if (patch.imageUrl !== undefined) {
      next.image_url = patch.imageUrl;
      changed = true;
    }
    if (patch.ingredients !== undefined) {
      next.ingredients = patch.ingredients;
      changed = true;
    }
    if (patch.comboOffers !== undefined) {
      next.combo_offers = patch.comboOffers;
      changed = true;
    }
    if (changed) setEditItem(next);
  };

  const createMissing = [
    !name.trim() ? "Name" : null,
    !sku.trim() ? "SKU" : null,
    !price.trim() ? "Price" : null,
    createItemKind === "combo" && !buildComboPayload("combo", createComboOffers, price) ? "Combo products" : null,
  ].filter((entry): entry is string => Boolean(entry));

  /* ---------------- derived list data ---------------- */
  const categories = useMemo(
    () =>
      Array.from(new Set(items.map((item) => item.category?.trim()).filter((value): value is string => Boolean(value)))).sort((a, b) =>
        a.localeCompare(b),
      ),
    [items],
  );

  const stats = useMemo(() => {
    let active = 0;
    let low = 0;
    let out = 0;
    let discounted = 0;
    for (const item of items) {
      if (item.is_active) active += 1;
      const state = getStockState(item);
      if (state === "low") low += 1;
      if (state === "out") out += 1;
      if (hasDiscount(item)) discounted += 1;
    }
    return { total: items.length, active, hidden: items.length - active, low, out, discounted };
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const result = items.filter((item) => {
      if (query) {
        const haystack = `${item.name} ${item.sku} ${item.category ?? ""} ${item.id}`.toLowerCase();
        if (!haystack.includes(query)) return false;
      }
      if (categoryFilter !== "all") {
        if (categoryFilter === "__none__" ? Boolean(item.category?.trim()) : item.category?.trim() !== categoryFilter) return false;
      }
      if (statusFilter === "active" && !item.is_active) return false;
      if (statusFilter === "hidden" && item.is_active) return false;
      if (stockFilter !== "all") {
        const state = getStockState(item);
        if (stockFilter === "attention" ? state === "in" : state !== stockFilter) return false;
      }
      if (priceFilter === "discounted" && !hasDiscount(item)) return false;
      return true;
    });

    const finalPrice = (item: Item) => computeFinalPrice(item.price, item.discount_type, item.discount_value);
    switch (sortKey) {
      case "name":
        return [...result].sort((a, b) => a.name.localeCompare(b.name));
      case "price-asc":
        return [...result].sort((a, b) => finalPrice(a) - finalPrice(b));
      case "price-desc":
        return [...result].sort((a, b) => finalPrice(b) - finalPrice(a));
      case "stock-asc":
        return [...result].sort((a, b) => Number(a.stock_qty || 0) - Number(b.stock_qty || 0));
      case "newest":
        return [...result].sort((a, b) => b.id - a.id);
      default:
        return result;
    }
  }, [items, search, categoryFilter, statusFilter, stockFilter, priceFilter, sortKey]);

  const sheetFilterCount = (statusFilter !== "all" ? 1 : 0) + (stockFilter !== "all" ? 1 : 0) + (priceFilter !== "all" ? 1 : 0) + (sortKey !== "default" ? 1 : 0);
  const filtersActive = search.trim() !== "" || categoryFilter !== "all" || statusFilter !== "all" || stockFilter !== "all" || priceFilter !== "all";

  const resetFilters = () => {
    setSearch("");
    setCategoryFilter("all");
    setStatusFilter("all");
    setStockFilter("all");
    setPriceFilter("all");
  };

  if (!access.ready) {
    return access.fallback;
  }

  const openCreate = () => {
    setCreateTab("basics");
    setCreateOpen(true);
  };

  const quickActions: { label: string; icon: IconName; tab: ItemFormTab }[] = actionItem
    ? [
        { label: "Edit details", icon: "create-outline", tab: "basics" },
        { label: "Price & discount", icon: "pricetag-outline", tab: "pricing" },
        { label: "Update stock", icon: "cube-outline", tab: "inventory" },
        { label: "Manage images", icon: "images-outline", tab: "media" },
        { label: "Variants & schedule", icon: "options-outline", tab: "options" },
        { label: actionItem.item_kind === "combo" ? "Combo contents" : "Ingredients & combos", icon: "layers-outline", tab: "composition" },
      ]
    : [];

  return (
    <AppShell
      navigation={navigation}
      screenName="MarketItems"
      marketId={marketId}
      title="Products"
      subtitle="Prices, discounts, stock, images, ingredients and combos."
    >
      <Button icon="add" onPress={openCreate} fullWidth>
        Add product
      </Button>

      {flash ? <Alert tone="success" title={flash} /> : null}

      <StatGrid>
        <StatCard
          label="Total products"
          value={stats.total}
          icon="cube-outline"
          tone="primary"
          note={`${categories.length} categor${categories.length === 1 ? "y" : "ies"}`}
          onPress={resetFilters}
          active={!filtersActive && stats.total > 0}
        />
        <StatCard
          label="Active"
          value={stats.active}
          icon="checkmark-circle-outline"
          tone="success"
          note={stats.hidden > 0 ? `${stats.hidden} hidden` : "All visible in store"}
          onPress={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
          active={statusFilter === "active"}
        />
        <StatCard
          label="Low / out of stock"
          value={`${stats.low} / ${stats.out}`}
          icon="warning-outline"
          tone={stats.out > 0 ? "destructive" : stats.low > 0 ? "warning" : "neutral"}
          note={stats.low + stats.out > 0 ? "Needs restocking" : "Stock looks healthy"}
          onPress={() => setStockFilter(stockFilter === "attention" ? "all" : "attention")}
          active={stockFilter === "attention"}
        />
        <StatCard
          label="Discounted"
          value={stats.discounted}
          icon="pricetags-outline"
          tone="info"
          note="Products with an active discount"
          onPress={() => setPriceFilter(priceFilter === "discounted" ? "all" : "discounted")}
          active={priceFilter === "discounted"}
        />
      </StatGrid>

      <View style={styles.gap10}>
        <Row gap={8} align="flex-start">
          <View style={styles.flex}>
            <Input
              value={search}
              onChangeText={setSearch}
              placeholder="Search name, SKU or category"
              icon="search-outline"
              autoCapitalize="none"
              right={search ? <IconButton icon="close" size={30} onPress={() => setSearch("")} accessibilityLabel="Clear search" /> : undefined}
            />
          </View>
          <IconButton icon="options-outline" variant="outline" onPress={() => setFiltersOpen(true)} accessibilityLabel="Filter and sort" badge={sheetFilterCount} size={42} />
        </Row>
        {categories.length > 0 ? (
          <ChipRow>
            <Chip label="All categories" selected={categoryFilter === "all"} onPress={() => setCategoryFilter("all")} />
            {categories.map((entry) => (
              <Chip key={entry} label={entry} selected={categoryFilter === entry} onPress={() => setCategoryFilter(categoryFilter === entry ? "all" : entry)} />
            ))}
            <Chip label="No category" selected={categoryFilter === "__none__"} onPress={() => setCategoryFilter(categoryFilter === "__none__" ? "all" : "__none__")} />
          </ChipRow>
        ) : null}
        <Row justify="space-between" gap={8}>
          <AppText variant="caption">
            Showing {filteredItems.length} of {items.length}
            {sortKey !== "default" ? ` · ${SORT_OPTIONS.find((option) => option.value === sortKey)?.label}` : ""}
          </AppText>
          {filtersActive ? (
            <Button variant="ghost" size="sm" icon="close" onPress={resetFilters}>
              Clear filters
            </Button>
          ) : null}
        </Row>
      </View>

      {itemsQ.isLoading ? (
        <LoadingBlock message="Loading items..." rows={4} />
      ) : itemsQ.isError ? (
        <Alert
          tone="destructive"
          title="Failed to load products"
          description={getErrorMessage(itemsQ.error, "Something went wrong while loading this market's products.")}
          action={
            <Button variant="outline" size="sm" icon="refresh" onPress={() => void itemsQ.refetch()} style={styles.selfStart}>
              Try again
            </Button>
          }
        />
      ) : items.length === 0 ? (
        <EmptyState
          icon="cube-outline"
          title="No products yet"
          description="Add your first product to start selling in this market."
          action={
            <Button icon="add" onPress={openCreate}>
              Add product
            </Button>
          }
        />
      ) : filteredItems.length === 0 ? (
        <EmptyState
          icon="search-outline"
          title="No products match your filters"
          description="Try a different search term or clear the filters to see all products."
          action={
            <Button variant="outline" icon="close" onPress={resetFilters}>
              Clear filters
            </Button>
          }
        />
      ) : (
        <View style={styles.gap12}>
          {filteredItems.map((item) => (
            <ProductCard key={item.id} item={item} onEdit={() => openEdit(item, "basics")} onMore={() => setActionItem(item)} />
          ))}
        </View>
      )}

      {/* Filter & sort */}
      <Sheet
        visible={filtersOpen}
        title="Filter & sort"
        description={`Showing ${filteredItems.length} of ${items.length} products`}
        onClose={() => setFiltersOpen(false)}
        footer={
          <>
            <Button
              variant="outline"
              onPress={() => {
                resetFilters();
                setSortKey("default");
              }}
              style={styles.flex}
            >
              Reset
            </Button>
            <Button onPress={() => setFiltersOpen(false)} style={styles.flex}>
              Done
            </Button>
          </>
        }
      >
        <View style={styles.gap8}>
          <AppText variant="label">Status</AppText>
          <SegmentedControl<StatusFilter>
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: "all", label: "Any" },
              { value: "active", label: "Active" },
              { value: "hidden", label: "Hidden" },
            ]}
          />
        </View>
        <View style={styles.gap8}>
          <AppText variant="label">Stock</AppText>
          <Row wrap gap={8}>
            {STOCK_OPTIONS.map((option) => (
              <Chip key={option.value} label={option.label} selected={stockFilter === option.value} onPress={() => setStockFilter(option.value)} />
            ))}
          </Row>
        </View>
        <View style={styles.gap8}>
          <AppText variant="label">Price</AppText>
          <SegmentedControl<PriceFilter>
            value={priceFilter}
            onChange={setPriceFilter}
            options={[
              { value: "all", label: "Any price" },
              { value: "discounted", label: "Discounted only" },
            ]}
          />
        </View>
        <View style={styles.gap8}>
          <AppText variant="label">Sort by</AppText>
          {SORT_OPTIONS.map((option) => (
            <OptionCard key={option.value} selected={sortKey === option.value} onPress={() => setSortKey(option.value)} title={option.label} />
          ))}
        </View>
      </Sheet>

      {/* Quick actions */}
      <Sheet visible={!!actionItem} title={actionItem?.name ?? "Product"} description={actionItem ? `${actionItem.sku} · #${actionItem.id}` : undefined} onClose={() => setActionItem(null)}>
        <View>
          {quickActions.map((action) => (
            <ListItem
              key={action.tab}
              title={action.label}
              icon={action.icon}
              onPress={() => {
                const target = actionItem;
                setActionItem(null);
                if (target) openEdit(target, action.tab);
              }}
            />
          ))}
        </View>
      </Sheet>

      <ItemFormSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        mode="create"
        tab={createTab}
        onTabChange={setCreateTab}
        values={createValues}
        onChange={patchCreate}
        comboItems={createComboSelectableItems}
        categories={categories}
        onPickImages={() => void pickItemImage("create")}
        error={createM.error ? getErrorMessage(createM.error) : null}
        missing={createMissing}
        canSubmit={!createM.isPending && createMissing.length === 0}
        submitting={createM.isPending}
        onSubmit={() => createM.mutate()}
      />

      <ItemFormSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        mode="edit"
        tab={editTab}
        onTabChange={setEditTab}
        values={editValues}
        onChange={(patch) => {
          if (patch.itemKind !== undefined && editItem) {
            // Same kind switch rules as before: combos drop ingredients and keep a single combo offer.
            const nextKind = patch.itemKind;
            setEditItem({
              ...editItem,
              item_kind: nextKind,
              ingredients: nextKind === "combo" ? [] : editItem.ingredients ?? [],
              combo_offers:
                nextKind === "combo"
                  ? (editItem.combo_offers ?? []).length > 0
                    ? [((editItem.combo_offers ?? [])[0] as ComboOffer) ?? emptyComboOffer()]
                    : [emptyComboOffer()]
                  : [],
            });
            return;
          }
          patchEdit(patch);
        }}
        comboItems={editComboSelectableItems}
        categories={categories}
        gallery={{
          urls: getItemImageUrls(editItem),
          onDelete: (index) => deleteImageM.mutate(index, { onSuccess: () => setFlash("Image deleted") }),
          onClearAll: () => clearImagesM.mutate(undefined, { onSuccess: () => setFlash("All images deleted") }),
          busy: deleteImageM.isPending || clearImagesM.isPending,
        }}
        onPickImages={() => void pickItemImage("edit")}
        error={
          updateM.error
            ? getErrorMessage(updateM.error)
            : deleteImageM.error
              ? getErrorMessage(deleteImageM.error)
              : clearImagesM.error
                ? getErrorMessage(clearImagesM.error)
                : null
        }
        missing={[]}
        canSubmit={!!editItem && !updateM.isPending}
        submitting={updateM.isPending}
        onSubmit={() => updateM.mutate()}
      />
    </AppShell>
  );
}

/* =================================================================================================
 * Promo codes
 * ===============================================================================================*/

export function MarketPromoCodesScreen({ navigation, route }: MarketPromoCodesProps) {
  const { marketId } = route.params;
  const access = useProtectedAccess("MarketPromoCodes", { marketId });
  const queryClient = useQueryClient();
  const valueLabel = usePromoValueLabel();
  const [createOpen, setCreateOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [code, setCode] = useState("");
  const [type, setType] = useState<PromoCode["type"]>("percent");
  const [value, setValue] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [maxUses, setMaxUses] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [editPromo, setEditPromo] = useState<PromoCode | null>(null);
  const [now] = useState(() => Date.now());
  const [flash, setFlash] = useFlash();

  const id = Number(marketId);
  const q = useQuery({
    queryKey: ["promo-codes", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/promo-codes`)).data as PromoCode[],
    enabled: access.ready && Number.isFinite(id),
  });

  const promos = useMemo(() => q.data ?? [], [q.data]);
  const activePromo = useMemo(() => promos.find((promo) => promo.is_active) ?? null, [promos]);

  const stats = useMemo(() => {
    let live = 0;
    let expired = 0;
    let scheduled = 0;
    let uses = 0;
    for (const promo of promos) {
      const status = promoStatus(promo, now);
      if (status === "active") live += 1;
      if (status === "expired") expired += 1;
      if (promo.starts_at || promo.ends_at) scheduled += 1;
      uses += toNumber(promo.uses);
    }
    return { live, expired, scheduled, uses };
  }, [promos, now]);

  const createM = useMutation({
    mutationFn: async () => {
      const payload: Record<string, unknown> = {
        code,
        type,
        value: Number(value),
        is_active: isActive,
      };
      if (startsAt) payload.starts_at = startsAt;
      if (endsAt) payload.ends_at = endsAt;
      if (maxUses) payload.max_uses = Number(maxUses);
      return (await api.post(`/api/markets/${id}/promo-codes`, payload)).data as PromoCode;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["promo-codes", id] });
      setCreateOpen(false);
      setFlash("Promo code created");
      setCode("");
      setType("percent");
      setValue("");
      setStartsAt("");
      setEndsAt("");
      setMaxUses("");
      setIsActive(true);
    },
  });

  const updateM = useMutation({
    mutationFn: async () => {
      if (!editPromo) {
        throw new Error("No promo selected");
      }

      return (
        await api.patch(`/api/markets/${id}/promo-codes/${editPromo.id}`, {
          code: editPromo.code,
          type: editPromo.type,
          value: Number(editPromo.value),
          is_active: !!editPromo.is_active,
          starts_at: editPromo.starts_at ?? null,
          ends_at: editPromo.ends_at ?? null,
          max_uses: editPromo.max_uses ?? null,
        })
      ).data as PromoCode;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["promo-codes", id] });
      setEditOpen(false);
      setFlash("Promo code updated");
      setEditPromo(null);
    },
  });

  if (!access.ready) {
    return access.fallback;
  }

  const createValues: PromoFormValues = { code, type, value, maxUses, startsAt, endsAt, active: isActive };
  const patchCreate = (patch: Partial<PromoFormValues>) => {
    if (patch.code !== undefined) setCode(patch.code);
    if (patch.type !== undefined) setType(patch.type);
    if (patch.value !== undefined) setValue(patch.value);
    if (patch.maxUses !== undefined) setMaxUses(patch.maxUses);
    if (patch.startsAt !== undefined) setStartsAt(patch.startsAt);
    if (patch.endsAt !== undefined) setEndsAt(patch.endsAt);
    if (patch.active !== undefined) setIsActive(patch.active);
  };

  const editValues: PromoFormValues | null = editPromo
    ? {
        code: editPromo.code,
        type: editPromo.type,
        value: String(editPromo.value),
        maxUses: editPromo.max_uses?.toString() ?? "",
        startsAt: editPromo.starts_at ?? "",
        endsAt: editPromo.ends_at ?? "",
        active: !!editPromo.is_active,
      }
    : null;
  const patchEdit = (patch: Partial<PromoFormValues>) => {
    if (!editPromo) return;
    const next: PromoCode = { ...editPromo };
    if (patch.code !== undefined) next.code = patch.code;
    if (patch.type !== undefined) next.type = patch.type;
    if (patch.value !== undefined) next.value = patch.value;
    if (patch.maxUses !== undefined) next.max_uses = patch.maxUses ? Number(patch.maxUses) : null;
    if (patch.startsAt !== undefined) next.starts_at = patch.startsAt || null;
    if (patch.endsAt !== undefined) next.ends_at = patch.endsAt || null;
    if (patch.active !== undefined) next.is_active = patch.active;
    setEditPromo(next);
  };

  const createDescription =
    code || value
      ? `${code || "New promo"} · ${value.trim() ? valueLabel({ type, value }) : "Set discount value"} · ${maxUses.trim() ? `0 / ${maxUses} uses` : "Unlimited uses"}`
      : "Set the discount, an optional schedule and usage limit, and whether it goes live now.";

  return (
    <AppShell
      navigation={navigation}
      screenName="MarketPromoCodes"
      marketId={marketId}
      title="Promo codes"
      subtitle="Discount codes customers can apply at checkout in this market."
    >
      <Button icon="add" onPress={() => setCreateOpen(true)} fullWidth>
        Create promo code
      </Button>

      {flash ? <Alert tone="success" title={flash} /> : null}

      <StatGrid>
        <StatCard label="Live now" value={stats.live} icon="sparkles-outline" tone="success" note={`${promos.length} codes in total`} />
        <StatCard label="Expired" value={stats.expired} icon="timer-outline" tone="destructive" />
        <StatCard label="Scheduled" value={stats.scheduled} icon="calendar-outline" tone="info" note="Codes with start or end dates" />
        <StatCard label="Total uses" value={stats.uses} icon="people-outline" tone="primary" />
      </StatGrid>

      {!q.isLoading && !q.isError ? (
        activePromo ? (
          <Alert
            icon="sparkles-outline"
            title={`Active offer: ${activePromo.code} · ${activePromo.uses} uses`}
            description={`${valueLabel(activePromo)} is live for this market.`}
          />
        ) : promos.length > 0 ? (
          <Alert icon="pricetags-outline" title="No active offer" description="No active promo code yet. Create one to add a public-facing offer to this storefront." />
        ) : null
      ) : null}

      {q.isLoading ? (
        <LoadingBlock message="Loading promo codes..." rows={3} />
      ) : q.isError ? (
        <Alert
          tone="destructive"
          title="Failed to load promo codes."
          description="Try again in a moment."
          action={
            <Button variant="outline" size="sm" icon="refresh" onPress={() => void q.refetch()} style={styles.selfStart}>
              Try again
            </Button>
          }
        />
      ) : promos.length === 0 ? (
        <EmptyState
          icon="pricetags-outline"
          title="No promo codes yet"
          description="Create a public-facing offer customers can apply at checkout in this storefront."
          action={
            <Button icon="add" onPress={() => setCreateOpen(true)}>
              Create promo code
            </Button>
          }
        />
      ) : (
        <View style={styles.gap12}>
          {promos.map((promo) => (
            <PromoCard
              key={promo.id}
              promo={promo}
              now={now}
              onEdit={() => {
                setEditPromo({ ...promo });
                setEditOpen(true);
              }}
            />
          ))}
        </View>
      )}

      <PromoFormSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create promo code"
        description={createDescription}
        values={createValues}
        onChange={patchCreate}
        activeTitle="Activate immediately"
        activeBody="When enabled, the public storefront can surface this live offer."
        error={createM.error ? getErrorMessage(createM.error) : null}
        canSubmit={!createM.isPending && !!code.trim() && !!value.trim()}
        submitting={createM.isPending}
        submitLabel="Save promo"
        onSubmit={() => createM.mutate()}
      />

      <PromoFormSheet
        visible={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit promo code"
        description={
          editPromo
            ? `${editPromo.code || "Promo code"} · ${valueLabel(editPromo)} · used ${editPromo.uses}${editPromo.max_uses ? ` / ${editPromo.max_uses}` : ""} times`
            : "Update the code, schedule, limit and live state."
        }
        values={editValues}
        onChange={patchEdit}
        activeTitle="Active"
        activeBody="Only active promo codes appear as live offers."
        error={updateM.error ? getErrorMessage(updateM.error) : null}
        canSubmit={!!editPromo && !updateM.isPending}
        submitting={updateM.isPending}
        submitLabel="Save changes"
        onSubmit={() => updateM.mutate()}
      />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  fill: { width: "100%", height: "100%" },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  gap10: { gap: 10 },
  gap12: { gap: 12 },
  selfStart: { alignSelf: "flex-start" },
  selfEnd: { alignSelf: "flex-end" },
  footerStack: { flex: 1, gap: 10 },
  tileGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  summaryTile: { flexGrow: 1, flexBasis: "46%", paddingHorizontal: 14, paddingVertical: 12, gap: 4 },
  logo: { width: 80, height: 80, borderRadius: 14, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  banner: { height: 150, borderRadius: 10, borderWidth: 1, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  previewBanner: { height: 120, overflow: "hidden" },
  previewBadge: { position: "absolute", top: 10, left: 10 },
  previewBody: { paddingHorizontal: 16, paddingTop: 12 },
  previewLogo: { width: 56, height: 56, marginTop: -36, borderRadius: 12, borderWidth: 2, overflow: "hidden", alignItems: "center", justifyContent: "center" },
  previewFooter: { paddingHorizontal: 16, paddingBottom: 16, gap: 6 },
  dangerBox: { flexDirection: "row", alignItems: "center", gap: 12, borderWidth: 1, borderRadius: 10, padding: 14 },
});
