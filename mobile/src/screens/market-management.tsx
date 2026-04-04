import { useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { Image } from "expo-image";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";

import { AppShell } from "@/src/components/app-shell";
import { AppButton, AppModal, EmptyBlock, HelperText, InputField, LoadingBlock, Pill, SectionCard, ToggleRow, uiStyles } from "@/src/components/ui";
import { useProtectedAccess } from "@/src/hooks/use-protected-access";
import { api } from "@/src/lib/api";
import { getErrorMessage } from "@/src/lib/errors";
import { formatMoney } from "@/src/lib/format";
import type { Item, MarketLite, PromoCode, UserLite } from "@/src/types/api";
import type { RootStackParamList } from "@/src/types/navigation";

type MarketSettingsProps = NativeStackScreenProps<RootStackParamList, "MarketSettings">;
type MarketItemsProps = NativeStackScreenProps<RootStackParamList, "MarketItems">;
type MarketPromoCodesProps = NativeStackScreenProps<RootStackParamList, "MarketPromoCodes">;

type StaffUser = UserLite & {
  roles?: string[];
  is_owner?: boolean;
  pivot?: { role?: string };
};

type ItemVariant = {
  name: string;
  value: string;
  price_delta?: number | string;
};

type AvailabilitySlot = {
  day: string;
  from: string;
  to: string;
};

const SCHEDULE_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function emptyVariant(): ItemVariant {
  return {
    name: "",
    value: "",
    price_delta: 0,
  };
}

function emptyScheduleSlot(): AvailabilitySlot {
  return {
    day: "Mon",
    from: "",
    to: "",
  };
}

function normalizeVariants(variants: ItemVariant[]) {
  const normalized = variants
    .map((variant) => ({
      name: variant.name.trim(),
      value: variant.value.trim(),
      price_delta: Number(variant.price_delta || 0),
    }))
    .filter((variant) => variant.name.length > 0 && variant.value.length > 0);

  return normalized.length > 0 ? normalized : null;
}

function normalizeAvailabilitySchedule(slots: AvailabilitySlot[]) {
  const normalized = slots
    .map((slot) => ({
      day: slot.day.trim(),
      from: slot.from.trim(),
      to: slot.to.trim(),
    }))
    .filter((slot) => slot.day && slot.from && slot.to);

  return normalized.length > 0 ? normalized : null;
}

function resolveMediaUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  try {
    const apiOrigin = new URL(api.defaults.baseURL ?? "http://127.0.0.1:8000").origin;
    const parsed = new URL(url, apiOrigin);

    if (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1") {
      return `${apiOrigin}${parsed.pathname}${parsed.search}${parsed.hash}`;
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

function getItemImageUrls(item?: Item | null) {
  const urls = [...(item?.image_urls ?? [])];

  if (item?.image_url) {
    urls.push(item.image_url);
  }

  return Array.from(
    new Set(
      urls
        .map((url) => resolveMediaUrl(url))
        .filter((url): url is string => typeof url === "string" && url.length > 0),
    ),
  );
}

function OptionPicker<T extends { id: number }>({
  options,
  value,
  onChange,
  getLabel,
  emptyText = "No options available.",
}: {
  options: T[];
  value: string;
  onChange: (value: string) => void;
  getLabel: (option: T) => string;
  emptyText?: string;
}) {
  if (options.length === 0) {
    return <HelperText>{emptyText}</HelperText>;
  }

  return (
    <View style={uiStyles.listGap}>
      {options.map((option) => {
        const selected = value === String(option.id);
        return (
          <Pressable key={option.id} onPress={() => onChange(String(option.id))} style={[styles.optionRow, selected && styles.optionRowSelected]}>
            <Text style={styles.optionLabel}>{getLabel(option)}</Text>
            {selected ? <Pill tone="success">Selected</Pill> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

function ChoiceRow({
  value,
  onChange,
  options,
}: {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <View style={styles.choiceWrap}>
      {options.map((option) => (
        <Pressable key={option} onPress={() => onChange(option)} style={[styles.choiceChip, value === option && styles.choiceChipActive]}>
          <Text style={styles.choiceChipText}>{option}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function VariantEditor({
  variants,
  onChange,
}: {
  variants: ItemVariant[];
  onChange: (variants: ItemVariant[]) => void;
}) {
  return (
    <View style={uiStyles.listGap}>
      {variants.map((variant, index) => (
        <SectionCard key={`variant-${index}`} title={`Variant ${index + 1}`}>
          <InputField
            label="Option group"
            value={variant.name}
            onChangeText={(value) =>
              onChange(variants.map((entry, entryIndex) => (entryIndex === index ? { ...entry, name: value } : entry)))
            }
            placeholder="Size"
          />
          <InputField
            label="Option value"
            value={variant.value}
            onChangeText={(value) =>
              onChange(variants.map((entry, entryIndex) => (entryIndex === index ? { ...entry, value } : entry)))
            }
            placeholder="Large"
          />
          <InputField
            label="Price delta"
            value={String(variant.price_delta ?? 0)}
            onChangeText={(value) =>
              onChange(variants.map((entry, entryIndex) => (entryIndex === index ? { ...entry, price_delta: value } : entry)))
            }
            placeholder="0 or 1.50"
            keyboardType="numeric"
          />
          <AppButton variant="secondary" onPress={() => onChange(variants.filter((_, entryIndex) => entryIndex !== index))}>
            Remove variant
          </AppButton>
        </SectionCard>
      ))}

      <AppButton variant="secondary" onPress={() => onChange([...variants, emptyVariant()])}>
        Add variant
      </AppButton>
    </View>
  );
}

function ScheduleEditor({
  schedule,
  onChange,
}: {
  schedule: AvailabilitySlot[];
  onChange: (schedule: AvailabilitySlot[]) => void;
}) {
  return (
    <View style={uiStyles.listGap}>
      {schedule.map((slot, index) => (
        <SectionCard key={`schedule-${index}`} title={`Schedule ${index + 1}`}>
          <HelperText>Day</HelperText>
          <ChoiceRow
            value={slot.day}
            onChange={(value) =>
              onChange(schedule.map((entry, entryIndex) => (entryIndex === index ? { ...entry, day: value } : entry)))
            }
            options={SCHEDULE_DAYS}
          />
          <InputField
            label="From"
            value={slot.from}
            onChangeText={(value) =>
              onChange(schedule.map((entry, entryIndex) => (entryIndex === index ? { ...entry, from: value } : entry)))
            }
            placeholder="09:00"
          />
          <InputField
            label="To"
            value={slot.to}
            onChangeText={(value) =>
              onChange(schedule.map((entry, entryIndex) => (entryIndex === index ? { ...entry, to: value } : entry)))
            }
            placeholder="18:00"
          />
          <AppButton variant="secondary" onPress={() => onChange(schedule.filter((_, entryIndex) => entryIndex !== index))}>
            Remove slot
          </AppButton>
        </SectionCard>
      ))}

      <AppButton variant="secondary" onPress={() => onChange([...schedule, emptyScheduleSlot()])}>
        Add schedule row
      </AppButton>
    </View>
  );
}

export function MarketSettingsScreen({ navigation, route }: MarketSettingsProps) {
  const { marketId } = route.params;
  const access = useProtectedAccess("MarketSettings", { marketId });
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"details" | "staff">("details");
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedLogo, setSelectedLogo] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [selectedBanner, setSelectedBanner] = useState<{ uri: string; name: string; type: string } | null>(null);
  const [staffUserId, setStaffUserId] = useState("");

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
    enabled: access.ready && Number.isFinite(id) && tab === "staff",
    retry: false,
  });

  const assignableUsersQ = useQuery({
    queryKey: ["market-assignable-users", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/assignable-users`)).data as StaffUser[],
    enabled: access.ready && Number.isFinite(id) && tab === "staff",
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
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setSelectedLogo({
      uri: asset.uri,
      name: asset.fileName || "market-logo.jpg",
      type: asset.mimeType || "image/jpeg",
    });
  }

  async function pickBanner() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.8,
    });

    if (result.canceled || !result.assets[0]) {
      return;
    }

    const asset = result.assets[0];
    setSelectedBanner({
      uri: asset.uri,
      name: asset.fileName || "market-banner.jpg",
      type: asset.mimeType || "image/jpeg",
    });
  }

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell navigation={navigation} screenName="MarketSettings" title="Market Settings" subtitle="Edit market details, upload a logo, and manage assigned staff.">
      {marketsQ.isLoading ? (
        <LoadingBlock message="Loading market..." />
      ) : !market ? (
        <EmptyBlock message="Market not found in your accessible list." />
      ) : (
        <>
          <SectionCard title={market.name} subtitle={`${market.code} • ${market.address || "No address set"}`}>
            <View style={styles.row}>
              <AppButton variant={tab === "details" ? "primary" : "secondary"} compact onPress={() => setTab("details")}>
                Details
              </AppButton>
              <AppButton variant={tab === "staff" ? "primary" : "secondary"} compact onPress={() => setTab("staff")}>
                Staff
              </AppButton>
              <AppButton compact variant="secondary" onPress={() => navigation.navigate("MarketItems", { marketId })}>
                Items
              </AppButton>
              <AppButton compact variant="secondary" onPress={() => navigation.navigate("MarketPromoCodes", { marketId })}>
                Promos
              </AppButton>
            </View>
          </SectionCard>

          {tab === "details" ? (
            <SectionCard title="Market details">
              <InputField label="Name" value={name} onChangeText={setName} placeholder="Market name" />
              <InputField label="Address" value={address} onChangeText={setAddress} placeholder="Address" multiline />
              <ToggleRow label="Active" value={isActive} onValueChange={setIsActive} />
              {updateMarketM.error ? <HelperText tone="danger">{getErrorMessage(updateMarketM.error)}</HelperText> : null}
              <AppButton onPress={() => updateMarketM.mutate()} disabled={updateMarketM.isPending || !name.trim()}>
                {updateMarketM.isPending ? "Saving..." : "Save changes"}
              </AppButton>
              <HelperText>{market.logo_url ? "A logo already exists on the backend." : "Upload a market logo here."}</HelperText>
              {resolveMediaUrl(market.logo_url) ? <Image source={resolveMediaUrl(market.logo_url)} style={styles.marketBrandLogo} contentFit="cover" /> : null}
              <AppButton variant="secondary" onPress={() => void pickLogo()}>
                Choose logo
              </AppButton>
              {selectedLogo ? <HelperText>{selectedLogo.name}</HelperText> : null}
              {uploadLogoM.error ? <HelperText tone="danger">{getErrorMessage(uploadLogoM.error)}</HelperText> : null}
              <AppButton onPress={() => uploadLogoM.mutate()} disabled={!selectedLogo || uploadLogoM.isPending}>
                {uploadLogoM.isPending ? "Uploading..." : "Upload logo"}
              </AppButton>

              <HelperText>{market.banner_url ? "A banner already exists on the backend." : "Upload a market banner here."}</HelperText>
              {resolveMediaUrl(market.banner_url) ? <Image source={resolveMediaUrl(market.banner_url)} style={styles.marketBannerPreview} contentFit="cover" /> : null}
              <AppButton variant="secondary" onPress={() => void pickBanner()}>
                Choose banner
              </AppButton>
              {selectedBanner ? <HelperText>{selectedBanner.name}</HelperText> : null}
              {uploadBannerM.error ? <HelperText tone="danger">{getErrorMessage(uploadBannerM.error)}</HelperText> : null}
              <AppButton onPress={() => uploadBannerM.mutate()} disabled={!selectedBanner || uploadBannerM.isPending}>
                {uploadBannerM.isPending ? "Uploading..." : "Upload banner"}
              </AppButton>
            </SectionCard>
          ) : (
            <>
              <SectionCard title="Add staff">
                <OptionPicker
                  options={assignableUsersQ.data ?? []}
                  value={staffUserId}
                  onChange={setStaffUserId}
                  getLabel={(user) => `${user.name} (${user.email})${user.is_owner ? " - owner" : ""}`}
                  emptyText="No assignable users available."
                />
                {addStaffM.error ? <HelperText tone="danger">{getErrorMessage(addStaffM.error)}</HelperText> : null}
                <AppButton onPress={() => addStaffM.mutate()} disabled={addStaffM.isPending || !staffUserId}>
                  {addStaffM.isPending ? "Adding..." : "Add staff"}
                </AppButton>
              </SectionCard>

              <SectionCard title="Staff list">
                {staffQ.isLoading ? (
                  <LoadingBlock message="Loading staff..." />
                ) : (staffQ.data ?? []).length === 0 ? (
                  <HelperText>No staff loaded.</HelperText>
                ) : (
                  <View style={uiStyles.listGap}>
                    {(staffQ.data ?? []).map((user) => (
                      <SectionCard key={user.id} title={user.name} subtitle={user.email} right={<Pill>{user.pivot?.role ?? "-"}</Pill>}>
                        <AppButton variant="danger" compact onPress={() => removeStaffM.mutate(user.id)}>
                          Remove
                        </AppButton>
                      </SectionCard>
                    ))}
                  </View>
                )}
              </SectionCard>
            </>
          )}
        </>
      )}
    </AppShell>
  );
}

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
  const [createSelectedImages, setCreateSelectedImages] = useState<{ uri: string; name: string; type: string }[]>([]);
  const [isActive, setIsActive] = useState(true);
  const [editItem, setEditItem] = useState<Item | null>(null);
  const [editVariants, setEditVariants] = useState<ItemVariant[]>([]);
  const [editSchedule, setEditSchedule] = useState<AvailabilitySlot[]>([]);
  const [editSelectedImages, setEditSelectedImages] = useState<{ uri: string; name: string; type: string }[]>([]);

  const id = Number(marketId);
  const itemsQ = useQuery({
    queryKey: ["market-items", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/items`)).data as Item[],
    enabled: access.ready && Number.isFinite(id),
  });

  const createM = useMutation({
    mutationFn: async () => {
      const created = (
        await api.post(`/api/markets/${id}/items`, {
          name,
          sku,
          category: category.trim() || null,
          image_url: imageUrl.trim() || null,
          variants: normalizeVariants(createVariants),
          availability_schedule: normalizeAvailabilitySchedule(createSchedule),
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
      setCreateSelectedImages([]);
      setIsActive(true);
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
          price: Number(editItem.price),
          discount_type: editItem.discount_type,
          discount_value: Number(editItem.discount_value || 0),
          stock_qty: Number(editItem.stock_qty || 0),
          category: editItem.category ?? null,
          image_url: editItem.image_url?.trim() || null,
          variants: normalizeVariants(editVariants),
          availability_schedule: normalizeAvailabilitySchedule(editSchedule),
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

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell navigation={navigation} screenName="MarketItems" title="Market Items" subtitle={`Catalog management for market #${marketId}.`}>
      <SectionCard title="Catalog tools">
        <AppButton onPress={() => setCreateOpen(true)}>Add item</AppButton>
      </SectionCard>

      {itemsQ.isLoading ? (
        <LoadingBlock message="Loading items..." />
      ) : itemsQ.isError ? (
        <EmptyBlock message="Failed to load items." />
      ) : (
        <View style={uiStyles.listGap}>
          {(itemsQ.data ?? []).map((item) => (
            <SectionCard key={item.id} title={item.name} subtitle={`${item.sku} • ${formatMoney(item.price, "en")}`}>
              {getItemImageUrls(item)[0] ? <Image source={getItemImageUrls(item)[0]} style={styles.itemPreview} contentFit="cover" /> : null}
              <HelperText>Discount: {item.discount_type === "none" ? "None" : `${item.discount_type} ${item.discount_value}`}</HelperText>
              <HelperText>Stock: {item.stock_qty}</HelperText>
              <HelperText>Status: {item.is_active ? "Active" : "Inactive"}</HelperText>
              <AppButton
                compact
                variant="secondary"
                onPress={() => {
                  setEditItem({ ...item });
                  setEditVariants((item.variants as ItemVariant[] | null) ?? []);
                  setEditSchedule((item.availability_schedule as AvailabilitySlot[] | null) ?? []);
                  setEditSelectedImages([]);
                  setEditOpen(true);
                }}
              >
                Edit item
              </AppButton>
            </SectionCard>
          ))}
        </View>
      )}

      <AppModal visible={createOpen} title="Add item" onClose={() => setCreateOpen(false)}>
        <InputField label="Name" value={name} onChangeText={setName} placeholder="Item name" />
        <InputField label="SKU" value={sku} onChangeText={setSku} placeholder="SKU" />
        <InputField label="Category" value={category} onChangeText={setCategory} placeholder="General" />
        <InputField label="Price" value={price} onChangeText={setPrice} keyboardType="numeric" />
        <HelperText>Discount type</HelperText>
        <ChoiceRow value={discountType} onChange={setDiscountType as (value: string) => void} options={["none", "percent", "fixed"]} />
        <InputField label="Discount value" value={discountValue} onChangeText={setDiscountValue} keyboardType="numeric" />
        <InputField label="Stock quantity" value={stockQty} onChangeText={setStockQty} keyboardType="numeric" />
        <InputField label="Low stock threshold" value={lowStockThreshold} onChangeText={setLowStockThreshold} keyboardType="numeric" />
        <InputField label="External image URL" value={imageUrl} onChangeText={setImageUrl} placeholder="Optional fallback URL" />
        <AppButton variant="secondary" onPress={() => void pickItemImage("create")}>
          Choose item images
        </AppButton>
        {createSelectedImages.length > 0 ? <HelperText>{createSelectedImages.length} image(s) selected</HelperText> : null}
        <SectionCard title="Variants" subtitle="Add choices like size, color, or packaging.">
          <VariantEditor variants={createVariants} onChange={setCreateVariants} />
        </SectionCard>
        <SectionCard title="Availability schedule" subtitle="Show when this item should be available.">
          <ScheduleEditor schedule={createSchedule} onChange={setCreateSchedule} />
        </SectionCard>
        <ToggleRow label="Active" value={isActive} onValueChange={setIsActive} />
        {createM.error ? <HelperText tone="danger">{getErrorMessage(createM.error)}</HelperText> : null}
        <AppButton onPress={() => createM.mutate()} disabled={createM.isPending || !name.trim() || !sku.trim() || !price.trim()}>
          {createM.isPending ? "Saving..." : "Save item"}
        </AppButton>
      </AppModal>

      <AppModal visible={editOpen} title="Edit item" onClose={() => setEditOpen(false)}>
        {editItem ? (
          <>
            <InputField label="Name" value={editItem.name} onChangeText={(value) => setEditItem({ ...editItem, name: value })} placeholder="Item name" />
            <InputField label="SKU" value={editItem.sku} onChangeText={(value) => setEditItem({ ...editItem, sku: value })} placeholder="SKU" />
            <InputField
              label="Category"
              value={editItem.category ?? ""}
              onChangeText={(value) => setEditItem({ ...editItem, category: value })}
              placeholder="General"
            />
            <InputField label="Price" value={String(editItem.price)} onChangeText={(value) => setEditItem({ ...editItem, price: value })} keyboardType="numeric" />
            <ChoiceRow value={editItem.discount_type ?? "none"} onChange={(value) => setEditItem({ ...editItem, discount_type: value as Item["discount_type"] })} options={["none", "percent", "fixed"]} />
            <InputField label="Discount value" value={String(editItem.discount_value ?? 0)} onChangeText={(value) => setEditItem({ ...editItem, discount_value: value })} keyboardType="numeric" />
            <InputField label="Stock quantity" value={String(editItem.stock_qty)} onChangeText={(value) => setEditItem({ ...editItem, stock_qty: Number(value) })} keyboardType="numeric" />
            <InputField
              label="Low stock threshold"
              value={String(editItem.low_stock_threshold ?? 5)}
              onChangeText={(value) => setEditItem({ ...editItem, low_stock_threshold: Number(value || 0) })}
              keyboardType="numeric"
            />
            <InputField
              label="External image URL"
              value={editItem.image_url ?? ""}
              onChangeText={(value) => setEditItem({ ...editItem, image_url: value })}
              placeholder="Optional fallback URL"
            />
            <AppButton variant="secondary" onPress={() => void pickItemImage("edit")}>
              Choose item images
            </AppButton>
            {editSelectedImages.length > 0 ? <HelperText>{editSelectedImages.length} new image(s) selected</HelperText> : null}
            {getItemImageUrls(editItem).length > 0 ? (
              <SectionCard title="Current gallery" subtitle={`${getItemImageUrls(editItem).length} image(s)`}>
                <View style={styles.galleryGrid}>
                  {getItemImageUrls(editItem).map((url, index) => (
                    <View key={`${url}-${index}`} style={styles.galleryCard}>
                      <Image source={url} style={styles.galleryImage} contentFit="cover" />
                      <AppButton
                        variant="secondary"
                        compact
                        onPress={() => deleteImageM.mutate(index)}
                        disabled={deleteImageM.isPending || clearImagesM.isPending}
                      >
                        Delete
                      </AppButton>
                    </View>
                  ))}
                </View>
                <AppButton
                  variant="secondary"
                  onPress={() => clearImagesM.mutate()}
                  disabled={deleteImageM.isPending || clearImagesM.isPending}
                >
                  Delete all images
                </AppButton>
              </SectionCard>
            ) : null}
            <SectionCard title="Variants" subtitle="Add customer-selectable options without JSON.">
              <VariantEditor variants={editVariants} onChange={setEditVariants} />
            </SectionCard>
            <SectionCard title="Availability schedule" subtitle="Use rows to control item time slots.">
              <ScheduleEditor schedule={editSchedule} onChange={setEditSchedule} />
            </SectionCard>
            <ToggleRow label="Active" value={!!editItem.is_active} onValueChange={(value) => setEditItem({ ...editItem, is_active: value })} />
            {updateM.error ? <HelperText tone="danger">{getErrorMessage(updateM.error)}</HelperText> : null}
            <AppButton onPress={() => updateM.mutate()} disabled={updateM.isPending}>
              {updateM.isPending ? "Saving..." : "Save changes"}
            </AppButton>
          </>
        ) : null}
      </AppModal>
    </AppShell>
  );
}

export function MarketPromoCodesScreen({ navigation, route }: MarketPromoCodesProps) {
  const { marketId } = route.params;
  const access = useProtectedAccess("MarketPromoCodes", { marketId });
  const queryClient = useQueryClient();
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

  const id = Number(marketId);
  const q = useQuery({
    queryKey: ["promo-codes", id],
    queryFn: async () => (await api.get(`/api/markets/${id}/promo-codes`)).data as PromoCode[],
    enabled: access.ready && Number.isFinite(id),
  });

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
      setEditPromo(null);
    },
  });

  if (!access.ready) {
    return access.fallback;
  }

  return (
    <AppShell navigation={navigation} screenName="MarketPromoCodes" title="Promo Codes" subtitle={`Promotion management for market #${marketId}.`}>
      <SectionCard title="Promotion tools">
        <AppButton onPress={() => setCreateOpen(true)}>Add promo code</AppButton>
      </SectionCard>

      {q.isLoading ? (
        <LoadingBlock message="Loading promo codes..." />
      ) : q.isError ? (
        <EmptyBlock message="Failed to load promo codes." />
      ) : (
        <View style={uiStyles.listGap}>
          {(q.data ?? []).map((promo) => (
            <SectionCard key={promo.id} title={promo.code} subtitle={`${promo.type} • ${promo.value}`} right={<Pill tone={promo.is_active ? "success" : "warning"}>{promo.is_active ? "Active" : "Inactive"}</Pill>}>
              <HelperText>
                Uses: {promo.uses}
                {promo.max_uses ? ` / ${promo.max_uses}` : ""}
              </HelperText>
              <HelperText>Starts: {promo.starts_at || "-"} • Ends: {promo.ends_at || "-"}</HelperText>
              <AppButton
                compact
                variant="secondary"
                onPress={() => {
                  setEditPromo({ ...promo });
                  setEditOpen(true);
                }}
              >
                Edit promo
              </AppButton>
            </SectionCard>
          ))}
        </View>
      )}

      <AppModal visible={createOpen} title="Add promo code" onClose={() => setCreateOpen(false)}>
        <InputField label="Code" value={code} onChangeText={setCode} placeholder="SAVE10" />
        <HelperText>Promo type</HelperText>
        <ChoiceRow value={type} onChange={setType as (value: string) => void} options={["percent", "fixed"]} />
        <InputField label="Value" value={value} onChangeText={setValue} keyboardType="numeric" />
        <InputField label="Starts at" value={startsAt} onChangeText={setStartsAt} placeholder="YYYY-MM-DD HH:mm:ss" />
        <InputField label="Ends at" value={endsAt} onChangeText={setEndsAt} placeholder="YYYY-MM-DD HH:mm:ss" />
        <InputField label="Max uses" value={maxUses} onChangeText={setMaxUses} keyboardType="numeric" placeholder="Optional" />
        <ToggleRow label="Active" value={isActive} onValueChange={setIsActive} />
        {createM.error ? <HelperText tone="danger">{getErrorMessage(createM.error)}</HelperText> : null}
        <AppButton onPress={() => createM.mutate()} disabled={createM.isPending || !code.trim() || !value.trim()}>
          {createM.isPending ? "Saving..." : "Save promo"}
        </AppButton>
      </AppModal>

      <AppModal visible={editOpen} title="Edit promo code" onClose={() => setEditOpen(false)}>
        {editPromo ? (
          <>
            <InputField label="Code" value={editPromo.code} onChangeText={(nextValue) => setEditPromo({ ...editPromo, code: nextValue })} placeholder="SAVE10" />
            <ChoiceRow value={editPromo.type} onChange={(nextValue) => setEditPromo({ ...editPromo, type: nextValue as PromoCode["type"] })} options={["percent", "fixed"]} />
            <InputField label="Value" value={String(editPromo.value)} onChangeText={(nextValue) => setEditPromo({ ...editPromo, value: nextValue })} keyboardType="numeric" />
            <InputField label="Starts at" value={editPromo.starts_at ?? ""} onChangeText={(nextValue) => setEditPromo({ ...editPromo, starts_at: nextValue || null })} placeholder="YYYY-MM-DD HH:mm:ss" />
            <InputField label="Ends at" value={editPromo.ends_at ?? ""} onChangeText={(nextValue) => setEditPromo({ ...editPromo, ends_at: nextValue || null })} placeholder="YYYY-MM-DD HH:mm:ss" />
            <InputField label="Max uses" value={editPromo.max_uses?.toString() ?? ""} onChangeText={(nextValue) => setEditPromo({ ...editPromo, max_uses: nextValue ? Number(nextValue) : null })} keyboardType="numeric" />
            <ToggleRow label="Active" value={!!editPromo.is_active} onValueChange={(nextValue) => setEditPromo({ ...editPromo, is_active: nextValue })} />
            {updateM.error ? <HelperText tone="danger">{getErrorMessage(updateM.error)}</HelperText> : null}
            <AppButton onPress={() => updateM.mutate()} disabled={updateM.isPending}>
              {updateM.isPending ? "Saving..." : "Save changes"}
            </AppButton>
          </>
        ) : null}
      </AppModal>
    </AppShell>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  itemPreview: {
    width: "100%",
    height: 160,
    borderRadius: 18,
    marginBottom: 12,
    backgroundColor: "#e5e7eb",
  },
  marketBrandLogo: {
    width: 88,
    height: 88,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: "#ffffff",
  },
  marketBannerPreview: {
    width: "100%",
    height: 180,
    borderRadius: 20,
    marginBottom: 12,
    backgroundColor: "#e5e7eb",
  },
  galleryGrid: {
    gap: 12,
  },
  galleryCard: {
    gap: 8,
  },
  galleryImage: {
    width: "100%",
    height: 160,
    borderRadius: 18,
    backgroundColor: "#e5e7eb",
  },
  choiceWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
  },
  choiceChip: {
    minHeight: 40,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#d7deed",
    backgroundColor: "#eef2ff",
    justifyContent: "center",
    paddingHorizontal: 14,
  },
  choiceChipActive: {
    backgroundColor: "#bae6fd",
    borderColor: "#38bdf8",
  },
  choiceChipText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#0f172a",
  },
  optionRow: {
    minHeight: 54,
    borderWidth: 1,
    borderColor: "#d7deed",
    borderRadius: 16,
    backgroundColor: "#ffffff",
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  optionRowSelected: {
    backgroundColor: "#ecfeff",
    borderColor: "#06b6d4",
  },
  optionLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: "#0f172a",
  },
});
