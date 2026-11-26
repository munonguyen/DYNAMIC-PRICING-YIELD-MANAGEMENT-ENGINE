import React, { useMemo, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { PublishedListing, VenueProviderInfo } from '@/types/domain';
import type { ProviderThread } from '@/hooks/useAppState';
import { SEED_PROVIDERS } from '@/data/seedData';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';
import { formatVnd, getInitials } from '@/utils/formatters';
import { SafetyWarningBanner } from '@/components/chat/SafetyWarningBanner';
import { CourtAttachmentCard } from '@/components/chat/CourtAttachmentCard';

interface ChatScreenProps {
  listings: PublishedListing[];
  activeProviderId: string;
  threadsByProvider: Record<string, ProviderThread>;
  onSelectProviderId: (providerId: string) => void;
  onSendMessage: (providerId: string, text: string, attachedCourt?: PublishedListing) => void;
  onOpenLessorShop: (providerId: string) => void;
  onSelectCourtFromChat: (listing: PublishedListing) => void;
  onClose: () => void;
}

const QUICK_CHIPS = [
  'Còn sân tối nay không?',
  'Mưa bão hoàn cọc 100% chứ?',
  'Có cho thuê vợt & bóng?',
];

export const ChatScreen: React.FC<ChatScreenProps> = ({
  listings,
  activeProviderId,
  threadsByProvider,
  onSelectProviderId,
  onSendMessage,
  onOpenLessorShop,
  onSelectCourtFromChat,
  onClose,
}) => {
  const [viewMode, setViewMode] = useState<'LIST' | 'THREAD'>('THREAD');
  const [searchQuery, setSearchQuery] = useState('');
  const [draftText, setDraftText] = useState('');
  const [showCourtPicker, setShowCourtPicker] = useState(false);

  const providers = useMemo<VenueProviderInfo[]>(() => Object.values(SEED_PROVIDERS), []);
  const activeProvider =
    providers.find((p) => p.providerId === activeProviderId) ?? providers[0];
  const activeThread = threadsByProvider[activeProvider.providerId] ?? {
    messages: [],
    unreadCount: 0,
    lastTimeLabel: 'Hôm nay',
  };

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return providers.filter(
      (p) => !q || p.providerName.toLowerCase().includes(q) || p.city.toLowerCase().includes(q)
    );
  }, [providers, searchQuery]);

  const activeProviderCourts = useMemo(
    () => listings.filter((l) => l.provider.providerId === activeProvider.providerId),
    [listings, activeProvider.providerId]
  );

  const submitDraft = () => {
    if (!draftText.trim()) return;
    onSendMessage(activeProvider.providerId, draftText);
    setDraftText('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Bar */}
        <View style={styles.header}>
          <Pressable
            onPress={() => (viewMode === 'THREAD' ? setViewMode('LIST') : onClose())}
            style={styles.headerBtn}
          >
            <Text style={styles.headerBtnText}>
              {viewMode === 'THREAD' ? '☰ Danh sách' : '← Đóng'}
            </Text>
          </Pressable>

          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {viewMode === 'LIST' ? 'Hội thoại Chủ sân' : activeProvider.providerName}
            </Text>
            {viewMode === 'THREAD' ? (
              <Text style={styles.headerSub}>{activeProvider.onlineStatusLabel}</Text>
            ) : null}
          </View>

          {viewMode === 'THREAD' ? (
            <Pressable
              onPress={() => onOpenLessorShop(activeProvider.providerId)}
              style={styles.shopBtn}
            >
              <Text style={styles.shopBtnText}>Gian hàng</Text>
            </Pressable>
          ) : (
            <View style={{ width: 64 }} />
          )}
        </View>

        {viewMode === 'LIST' ? (
          <View style={styles.flex}>
            <View style={styles.searchWrap}>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Tìm theo tên chủ sân..."
                placeholderTextColor={COLORS.subtleText}
                style={styles.searchInput}
              />
            </View>
            <ScrollView contentContainerStyle={styles.threadList}>
              {filteredProviders.map((prov) => {
                const state = threadsByProvider[prov.providerId];
                const lastMsg = state?.messages[state.messages.length - 1];
                return (
                  <Pressable
                    key={prov.providerId}
                    onPress={() => {
                      onSelectProviderId(prov.providerId);
                      setViewMode('THREAD');
                    }}
                    style={[
                      styles.threadRow,
                      prov.providerId === activeProvider.providerId && styles.threadSelected,
                    ]}
                  >
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{getInitials(prov.providerName)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.threadTop}>
                        <Text style={styles.threadName} numberOfLines={1}>
                          {prov.providerName}
                        </Text>
                        <Text style={styles.threadTime}>{state?.lastTimeLabel ?? 'Hôm nay'}</Text>
                      </View>
                      <View style={styles.threadBottom}>
                        <Text style={styles.threadPreview} numberOfLines={1}>
                          {lastMsg?.body ?? 'Bắt đầu nhắn tin...'}
                        </Text>
                        {(state?.unreadCount ?? 0) > 0 ? (
                          <View style={styles.unreadPill}>
                            <Text style={styles.unreadPillText}>{state?.unreadCount}</Text>
                          </View>
                        ) : null}
                      </View>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>
          </View>
        ) : (
          <View style={styles.flex}>
            <ScrollView
              style={styles.feed}
              contentContainerStyle={styles.feedContent}
              showsVerticalScrollIndicator={false}
            >
              <View style={styles.datePillWrap}>
                <Text style={styles.datePill}>Ngày hôm nay</Text>
              </View>

              <SafetyWarningBanner />

              {activeThread.messages.map((m) => {
                const isSelf = m.senderRole === 'USER';
                return (
                  <View
                    key={m.id}
                    style={[styles.msgGroup, isSelf ? styles.alignEnd : styles.alignStart]}
                  >
                    <Text style={styles.msgMeta}>
                      {m.senderName} • {m.createdAt}
                    </Text>
                    <View
                      style={[
                        styles.bubble,
                        isSelf ? styles.bubbleSelf : styles.bubblePartner,
                      ]}
                    >
                      {m.courtCard ? (
                        <CourtAttachmentCard
                          card={m.courtCard}
                          isOwnBubble={isSelf}
                          onPress={() => {
                            const matched = listings.find(
                              (l) => l.groupId === m.courtCard?.groupId
                            );
                            if (matched) onSelectCourtFromChat(matched);
                          }}
                        />
                      ) : null}
                      <Text style={[styles.bubbleText, isSelf && styles.bubbleTextSelf]}>
                        {m.body}
                      </Text>
                    </View>
                  </View>
                );
              })}
            </ScrollView>

            {/* Court Picker Sheet */}
            {showCourtPicker ? (
              <View style={styles.pickerSheet}>
                <Text style={styles.pickerHeading}>
                  Gửi thẻ cụm sân thuộc {activeProvider.providerName}:
                </Text>
                {activeProviderCourts.map((court) => (
                  <Pressable
                    key={court.groupId}
                    onPress={() => {
                      onSendMessage(
                        activeProvider.providerId,
                        `Hỏi thông tin đặt sân "${court.groupName}"`,
                        court
                      );
                      setShowCourtPicker(false);
                    }}
                    style={styles.pickerRow}
                  >
                    <Text style={styles.pickerName} numberOfLines={1}>
                      {court.groupName}
                    </Text>
                    <Text style={styles.pickerPrice}>Từ {formatVnd(court.minPrice)}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}

            {/* Quick Prompt Chips */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipsBar}
              style={styles.chipsScroll}
            >
              {QUICK_CHIPS.map((q) => (
                <Pressable
                  key={q}
                  onPress={() => onSendMessage(activeProvider.providerId, q)}
                  style={styles.quickChip}
                >
                  <Text style={styles.quickChipText}>{q}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Bottom Composer */}
            <View style={styles.composer}>
              <Pressable
                onPress={() => setShowCourtPicker((v) => !v)}
                style={styles.attachBtn}
              >
                <Text style={styles.attachBtnText}>🏟️</Text>
              </Pressable>
              <TextInput
                value={draftText}
                onChangeText={setDraftText}
                placeholder="Nhập nội dung tin nhắn..."
                placeholderTextColor={COLORS.subtleText}
                style={styles.composerInput}
              />
              <Pressable onPress={submitDraft} style={styles.sendBtn}>
                <Text style={styles.sendBtnText}>Gửi</Text>
              </Pressable>
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.white },
  flex: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    gap: SPACING.sm,
  },
  headerBtn: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: RADII.sm,
    backgroundColor: COLORS.surfaceSoft,
  },
  headerBtnText: { fontSize: 12, fontWeight: '700', color: COLORS.ink },
  headerCenter: { flex: 1, alignItems: 'center' },
  headerTitle: { ...TYPOGRAPHY.cardTitle, color: COLORS.ink },
  headerSub: { fontSize: 10.5, color: COLORS.success, fontWeight: '600' },
  shopBtn: {
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: COLORS.forest,
  },
  shopBtnText: { fontSize: 11.5, fontWeight: '700', color: COLORS.forest },
  searchWrap: { padding: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.borderLight },
  searchInput: {
    backgroundColor: COLORS.surfaceSoft,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 13,
    color: COLORS.ink,
  },
  threadList: { paddingVertical: SPACING.xs },
  threadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.borderLight,
  },
  threadSelected: { backgroundColor: COLORS.forestSoft },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: COLORS.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 13, fontWeight: '800', color: COLORS.mint },
  threadTop: { flexDirection: 'row', justifyContent: 'space-between', gap: SPACING.sm },
  threadName: { fontSize: 13.5, fontWeight: '700', color: COLORS.ink, flex: 1 },
  threadTime: { fontSize: 11, color: COLORS.subtleText },
  threadBottom: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 3 },
  threadPreview: { fontSize: 12, color: COLORS.muted, flex: 1 },
  unreadPill: {
    backgroundColor: COLORS.coral,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 5,
  },
  unreadPillText: { fontSize: 10, fontWeight: '800', color: COLORS.white },
  feed: { flex: 1, backgroundColor: COLORS.canvas },
  feedContent: { padding: SPACING.md, gap: SPACING.md },
  datePillWrap: { alignItems: 'center' },
  datePill: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.muted,
    backgroundColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADII.pill,
  },
  msgGroup: { gap: 4 },
  alignEnd: { alignItems: 'flex-end' },
  alignStart: { alignItems: 'flex-start' },
  msgMeta: { fontSize: 10, color: COLORS.subtleText },
  bubble: { maxWidth: '84%', borderRadius: RADII.lg, padding: SPACING.md },
  bubbleSelf: { backgroundColor: COLORS.forest, borderBottomRightRadius: 4 },
  bubblePartner: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderBottomLeftRadius: 4,
  },
  bubbleText: { fontSize: 13, lineHeight: 19, color: COLORS.ink },
  bubbleTextSelf: { color: COLORS.white },
  pickerSheet: {
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    gap: 6,
  },
  pickerHeading: { fontSize: 11.5, fontWeight: '700', color: COLORS.muted },
  pickerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: SPACING.sm,
    borderRadius: RADII.sm,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  pickerName: { fontSize: 12, fontWeight: '600', color: COLORS.ink, flex: 1 },
  pickerPrice: { fontSize: 12, fontWeight: '700', color: COLORS.forest },
  chipsScroll: {
    maxHeight: 46,
    borderTopWidth: 1,
    borderTopColor: COLORS.borderLight,
    backgroundColor: COLORS.white,
  },
  chipsBar: { paddingHorizontal: SPACING.md, alignItems: 'center', gap: SPACING.xs },
  quickChip: {
    borderRadius: RADII.pill,
    borderWidth: 1,
    borderColor: COLORS.border,
    paddingHorizontal: 10,
    paddingVertical: 6,
    backgroundColor: COLORS.surfaceSoft,
  },
  quickChipText: { fontSize: 11, fontWeight: '600', color: COLORS.ink },
  composer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
    backgroundColor: COLORS.white,
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: RADII.md,
    backgroundColor: COLORS.surfaceSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachBtnText: { fontSize: 18 },
  composerInput: {
    flex: 1,
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.pill,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 13,
    color: COLORS.ink,
  },
  sendBtn: {
    backgroundColor: COLORS.forest,
    borderRadius: RADII.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 10,
  },
  sendBtnText: { fontSize: 13, fontWeight: '700', color: COLORS.mint },
});

