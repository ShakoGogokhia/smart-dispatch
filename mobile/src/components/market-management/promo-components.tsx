import { Share, StyleSheet, Text, View } from "react-native";

import { Alert, AppText, Badge, Button, Card, IconButton, InfoRow, Input, Panel, Progress, Row, SegmentedControl, Sheet, Switch, useColors } from "@/src/components/ui";
import { usePreferences } from "@/src/providers/app-providers";
import { formatDateTime, formatMoney, toNumber } from "@/src/lib/format";
import type { PromoCode } from "@/src/types/api";

import { MONO_FONT, PROMO_STATUS_META, promoStatus } from "./helpers";

export function usePromoValueLabel() {
  const { language } = usePreferences();
  return (promo: Pick<PromoCode, "type" | "value">) =>
    promo.type === "percent" ? `${toNumber(promo.value)}% off` : `${formatMoney(promo.value, language)} off`;
}

function shareCode(code: string) {
  void Share.share({ message: code }).catch(() => undefined);
}

export function PromoCard({ promo, now, onEdit }: { promo: PromoCode; now: number; onEdit: () => void }) {
  const c = useColors();
  const { language } = usePreferences();
  const valueLabel = usePromoValueLabel();
  const meta = PROMO_STATUS_META[promoStatus(promo, now)];
  const pct = promo.max_uses ? Math.min(100, (toNumber(promo.uses) / promo.max_uses) * 100) : null;

  return (
    <Card>
      <Row justify="space-between" align="flex-start" gap={12}>
        <View style={styles.flex}>
          <Row gap={4}>
            <Text numberOfLines={1} style={[styles.code, { color: c.foreground }]}>
              {promo.code}
            </Text>
            <IconButton icon="share-outline" size={32} onPress={() => shareCode(promo.code)} accessibilityLabel={`Share ${promo.code}`} />
          </Row>
          <AppText variant="label">{valueLabel(promo)}</AppText>
        </View>
        <Badge tone={meta.tone} dot>
          {meta.label}
        </Badge>
      </Row>

      <View style={styles.gap6}>
        <Row gap={4}>
          <AppText variant="label">{String(promo.uses)}</AppText>
          <AppText variant="small" tone="muted">
            {promo.max_uses ? `/ ${promo.max_uses} uses` : "uses · no limit"}
          </AppText>
        </Row>
        {pct != null ? <Progress value={pct} tone={pct >= 100 ? "destructive" : "primary"} /> : null}
      </View>

      <Panel>
        <InfoRow label="From" icon="calendar-outline" value={promo.starts_at ? formatDateTime(promo.starts_at, language) : "Any time"} />
        <InfoRow label="Until" icon="calendar-clear-outline" value={promo.ends_at ? formatDateTime(promo.ends_at, language) : "No end set"} />
        <AppText variant="caption">
          {promo.starts_at || promo.ends_at ? "This offer follows a schedule window." : "Unscheduled: governed only by active status."}
        </AppText>
      </Panel>

      <Row justify="space-between" gap={8}>
        <AppText variant="caption">#{promo.id}</AppText>
        <Button variant="outline" size="sm" icon="create-outline" onPress={onEdit}>
          Edit
        </Button>
      </Row>
    </Card>
  );
}

export type PromoFormValues = {
  code: string;
  type: PromoCode["type"];
  value: string;
  maxUses: string;
  startsAt: string;
  endsAt: string;
  active: boolean;
};

export function PromoFormSheet({
  visible,
  onClose,
  title,
  description,
  values,
  onChange,
  activeTitle,
  activeBody,
  error,
  canSubmit,
  submitting,
  submitLabel,
  onSubmit,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  description: string;
  values: PromoFormValues | null;
  onChange: (patch: Partial<PromoFormValues>) => void;
  activeTitle: string;
  activeBody: string;
  error?: string | null;
  canSubmit: boolean;
  submitting: boolean;
  submitLabel: string;
  onSubmit: () => void;
}) {
  return (
    <Sheet
      visible={visible}
      title={title}
      description={description}
      onClose={onClose}
      footer={
        <>
          <Button variant="outline" onPress={onClose} style={styles.flex}>
            Cancel
          </Button>
          <Button onPress={onSubmit} disabled={!canSubmit} loading={submitting} style={styles.flex}>
            {submitting ? "Saving..." : submitLabel}
          </Button>
        </>
      }
    >
      {values ? (
        <>
          <Input
            label="Code"
            value={values.code}
            onChangeText={(code) => onChange({ code })}
            placeholder="SAVE10"
            autoCapitalize="characters"
            icon="pricetag-outline"
            helper="Customers type this at checkout."
          />
          <View style={styles.gap8}>
            <AppText variant="label">Discount type</AppText>
            <SegmentedControl<PromoCode["type"]>
              value={values.type}
              onChange={(type) => onChange({ type })}
              options={[
                { value: "percent", label: "Percent" },
                { value: "fixed", label: "Fixed amount" },
              ]}
            />
          </View>
          <Input
            label={values.type === "percent" ? "Value (%)" : "Value (USD)"}
            value={values.value}
            onChangeText={(value) => onChange({ value })}
            keyboardType="decimal-pad"
            placeholder={values.type === "percent" ? "10" : "5.00"}
          />
          <Input
            label="Usage limit"
            value={values.maxUses}
            onChangeText={(maxUses) => onChange({ maxUses })}
            keyboardType="number-pad"
            placeholder="100"
            helper="Leave empty for unlimited uses."
          />
          <Input
            label="Starts at"
            value={values.startsAt}
            onChangeText={(startsAt) => onChange({ startsAt })}
            placeholder="YYYY-MM-DD HH:mm:ss"
            icon="calendar-outline"
            helper="Empty = any time."
          />
          <Input
            label="Ends at"
            value={values.endsAt}
            onChangeText={(endsAt) => onChange({ endsAt })}
            placeholder="YYYY-MM-DD HH:mm:ss"
            icon="calendar-clear-outline"
            helper="Empty = no end date."
          />
          <Panel>
            <Row justify="space-between" gap={12}>
              <View style={styles.flex}>
                <AppText variant="label">{activeTitle}</AppText>
                <AppText variant="caption">{activeBody}</AppText>
              </View>
              <Switch value={values.active} onValueChange={(active) => onChange({ active })} />
            </Row>
          </Panel>
          {error ? <Alert tone="destructive" title="Could not save the promo code" description={error} /> : null}
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  gap6: { gap: 6 },
  gap8: { gap: 8 },
  code: { fontFamily: MONO_FONT, fontSize: 16, fontWeight: "600", flexShrink: 1 },
});
