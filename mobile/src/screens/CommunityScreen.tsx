import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import type { RoleCode, VenueAnnouncement } from '@/types/domain';
import {
  SEED_ARTICLES,
  SEED_PERSONAL_INBOX,
  SEED_TOP_LESSORS,
  SEED_TOP_USERS,
} from '@/data/seedData';
import { COLORS, RADII, SPACING, TYPOGRAPHY } from '@/theme';
import { PillChip } from '@/components/common/PillChip';
import { PrimaryButton } from '@/components/common/PrimaryButton';

interface CommunityScreenProps {
  announcements: VenueAnnouncement[];
  activeRole: RoleCode;
  isAuthenticated: boolean;
  onPublishAnnouncement: (draft: Omit<VenueAnnouncement, 'id' | 'publishedAt'>) => void;
  onOpenLessorShop: (providerId: string) => void;
}

type CommunityTab = 'ANNOUNCEMENTS' | 'NEWS' | 'RANKINGS';

export const CommunityScreen: React.FC<CommunityScreenProps> = ({
  announcements,
  activeRole,
  isAuthenticated,
  onPublishAnnouncement,
  onOpenLessorShop,
}) => {
  const [subTab, setSubTab] = useState<CommunityTab>('ANNOUNCEMENTS');
  const [selectedAnnouncementId, setSelectedAnnouncementId] = useState<string>(
    announcements[0]?.id ?? ''
  );
  const [newTitle, setNewTitle] = useState('');
  const [newSummary, setNewSummary] = useState('');
  const [rankingGroup, setRankingGroup] = useState<'USERS' | 'LESSORS'>('USERS');

  const isAdmin = isAuthenticated && activeRole === 'ADMIN';
  const activeAnnouncement =
    announcements.find((a) => a.id === selectedAnnouncementId) ?? announcements[0];

  const handlePublish = () => {
    if (!isAdmin || !newTitle.trim() || !newSummary.trim()) return;
    onPublishAnnouncement({
      venueName: 'Toàn hệ thống ArenaPulse',
      city: 'Toàn quốc',
      audience: 'ALL_USERS',
      category: 'SYSTEM_UPDATE',
      severity: 'IMPORTANT',
      title: newTitle.trim(),
      summary: newSummary.trim(),
      effectiveWindow: 'Áp dụng ngay hôm nay',
    });
    setNewTitle('');
    setNewSummary('');
  };

  return (
    <View style={styles.root}>
      {/* Sub-navigation bar */}
      <View style={styles.subNav}>
        <PillChip
          label="Thông báo"
          active={subTab === 'ANNOUNCEMENTS'}
          onPress={() => setSubTab('ANNOUNCEMENTS')}
        />
        <PillChip
          label="Bài viết"
          active={subTab === 'NEWS'}
          onPress={() => setSubTab('NEWS')}
        />
        <PillChip
          label="Xếp hạng"
          active={subTab === 'RANKINGS'}
          onPress={() => setSubTab('RANKINGS')}
        />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {subTab === 'ANNOUNCEMENTS' ? (
          <View style={styles.stack}>
            {/* Personal User Inbox Card */}
            <View style={styles.inboxCard}>
              <Text style={styles.inboxHeading}>Thông báo cá nhân của bạn</Text>
              {SEED_PERSONAL_INBOX.map((item) => (
                <View key={item.id} style={styles.inboxRow}>
                  <Text style={styles.inboxTitle}>{item.title}</Text>
                  <Text style={styles.inboxBody}>{item.body}</Text>
                  <Text style={styles.inboxTime}>{item.timestampLabel}</Text>
                </View>
              ))}
            </View>

            {/* System Bulletin Reader */}
            {activeAnnouncement ? (
              <View style={styles.readerCard}>
                <Text style={styles.readerTag}>
                  {activeAnnouncement.venueName} • {activeAnnouncement.publishedAt}
                </Text>
                <Text style={styles.readerTitle}>{activeAnnouncement.title}</Text>
                <Text style={styles.readerBody}>{activeAnnouncement.summary}</Text>
                <Text style={styles.readerWindow}>
                  Hiệu lực: {activeAnnouncement.effectiveWindow}
                </Text>
              </View>
            ) : null}

            {/* Selectable Bulletin List */}
            {announcements.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setSelectedAnnouncementId(item.id)}
                style={[
                  styles.bulletinItem,
                  item.id === activeAnnouncement?.id && styles.bulletinActive,
                ]}
              >
                <Text style={styles.bulletinMeta}>
                  {item.audience === 'VIP' ? 'VIP • ' : ''}
                  {item.venueName}
                </Text>
                <Text style={styles.bulletinTitle}>{item.title}</Text>
              </Pressable>
            ))}

            {/* ADMIN-Only Publish Box */}
            {isAdmin ? (
              <View style={styles.adminBox}>
                <Text style={styles.adminTitle}>Phát hành Thông báo Hệ thống (ADMIN)</Text>
                <TextInput
                  value={newTitle}
                  onChangeText={setNewTitle}
                  placeholder="Tiêu đề thông báo..."
                  style={styles.input}
                />
                <TextInput
                  value={newSummary}
                  onChangeText={setNewSummary}
                  placeholder="Nội dung chi tiết..."
                  multiline
                  style={[styles.input, { minHeight: 68 }]}
                />
                <PrimaryButton label="Đăng thông báo toàn sàn" onPress={handlePublish} />
              </View>
            ) : null}
          </View>
        ) : null}

        {subTab === 'NEWS' ? (
          <View style={styles.stack}>
            {SEED_ARTICLES.map((art) => (
              <View key={art.id} style={styles.articleCard}>
                <Text style={styles.articleTag}>
                  {art.categoryLabel} • {art.readMinutes} phút đọc
                </Text>
                <Text style={styles.articleTitle}>{art.title}</Text>
                <Text style={styles.articleSapo}>{art.sapo}</Text>
                {art.bodyParagraphs.map((p, i) => (
                  <Text key={i} style={styles.articlePara}>
                    {p}
                  </Text>
                ))}
              </View>
            ))}
          </View>
        ) : null}

        {subTab === 'RANKINGS' ? (
          <View style={styles.stack}>
            <View style={styles.rankSwitch}>
              <PillChip
                label="Top Người Chơi"
                active={rankingGroup === 'USERS'}
                onPress={() => setRankingGroup('USERS')}
              />
              <PillChip
                label="Top Người Cho Thuê"
                active={rankingGroup === 'LESSORS'}
                onPress={() => setRankingGroup('LESSORS')}
              />
            </View>

            {rankingGroup === 'USERS'
              ? SEED_TOP_USERS.map((u) => (
                  <View key={u.rank} style={styles.rankCard}>
                    <View style={styles.rankCircle}>
                      <Text style={styles.rankNum}>#{u.rank}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankName}>{u.fullName}</Text>
                      <Text style={styles.rankMeta}>
                        {u.city} • {u.favoriteSport} • Check-in {u.onTimeCheckInRate}%
                      </Text>
                    </View>
                    <Text style={styles.rankPoints}>{u.points.toLocaleString('vi-VN')} pts</Text>
                  </View>
                ))
              : SEED_TOP_LESSORS.map((l) => (
                  <Pressable
                    key={l.rank}
                    onPress={() => onOpenLessorShop(l.providerId)}
                    style={styles.rankCard}
                  >
                    <View style={[styles.rankCircle, { backgroundColor: COLORS.coral }]}>
                      <Text style={styles.rankNum}>#{l.rank}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rankName}>{l.venueName}</Text>
                      <Text style={styles.rankMeta}>
                        {l.city} • ★ {l.rating} • Lấp đầy {l.occupancyPct}%
                      </Text>
                    </View>
                    <Text style={styles.rankLink}>Gian hàng ›</Text>
                  </Pressable>
                ))}
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.canvas },
  subNav: {
    flexDirection: 'row',
    gap: SPACING.xs + 2,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  content: { padding: SPACING.lg, paddingBottom: 32 },
  stack: { gap: SPACING.md },
  inboxCard: {
    backgroundColor: COLORS.forestDark,
    borderRadius: RADII.xl,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  inboxHeading: { fontSize: 13.5, fontWeight: '800', color: COLORS.mint },
  inboxRow: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: RADII.md,
    padding: SPACING.md,
    gap: 3,
  },
  inboxTitle: { fontSize: 13, fontWeight: '700', color: COLORS.white },
  inboxBody: { fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 17 },
  inboxTime: { fontSize: 10.5, color: COLORS.mint, marginTop: 2 },
  readerCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: 6,
  },
  readerTag: { fontSize: 11, fontWeight: '700', color: COLORS.sky },
  readerTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  readerBody: { fontSize: 13, lineHeight: 19, color: COLORS.muted },
  readerWindow: { fontSize: 11.5, fontWeight: '700', color: COLORS.forest, marginTop: 4 },
  bulletinItem: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  bulletinActive: { borderColor: COLORS.forest, backgroundColor: COLORS.forestSoft },
  bulletinMeta: { fontSize: 10.5, fontWeight: '700', color: COLORS.coral },
  bulletinTitle: { fontSize: 13.5, fontWeight: '700', color: COLORS.ink, marginTop: 2 },
  adminBox: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.forest,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  adminTitle: { fontSize: 14, fontWeight: '700', color: COLORS.forest },
  input: {
    backgroundColor: COLORS.surfaceSoft,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADII.md,
    padding: SPACING.md,
    fontSize: 13,
    color: COLORS.ink,
  },
  articleCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADII.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  articleTag: { fontSize: 11, fontWeight: '700', color: COLORS.forest },
  articleTitle: { ...TYPOGRAPHY.sectionTitle, color: COLORS.ink },
  articleSapo: { fontSize: 13, fontWeight: '600', color: COLORS.muted, lineHeight: 19 },
  articlePara: { fontSize: 13, color: COLORS.ink, lineHeight: 20 },
  rankSwitch: { flexDirection: 'row', gap: SPACING.sm },
  rankCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADII.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.md,
  },
  rankCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.forest,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankNum: { fontSize: 12, fontWeight: '800', color: COLORS.white },
  rankName: { fontSize: 14, fontWeight: '700', color: COLORS.ink },
  rankMeta: { fontSize: 11.5, color: COLORS.muted, marginTop: 2 },
  rankPoints: { fontSize: 13, fontWeight: '800', color: COLORS.forest },
  rankLink: { fontSize: 12, fontWeight: '700', color: COLORS.coral },
});

